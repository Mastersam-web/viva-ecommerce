const { query, one, withTransaction } = require('../../config/db');
const { ApiError, ok } = require('../../utils/http');
const { pagination, pageMeta, likeEscape, round2, randomCode } = require('../../utils/helpers');
const { audit } = require('../../utils/audit');
const orders = require('../../services/orders');
const payments = require('../../services/payments');
const { adjustStock } = require('../../services/stock');
const { buildOrderPdf } = require('../../utils/pdf');
const { notify } = require('../../utils/notify');
const { refreshRating } = require('../customer');

/* ------------------------------------------------------------ Commandes */
exports.listOrders = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = ['1=1']; const params = [];
  const q = req.query;
  if (q.q) { const l = `%${likeEscape(q.q)}%`; where.push('(o.order_number LIKE ? OR o.customer_email LIKE ? OR u.last_name LIKE ? OR u.first_name LIKE ?)'); params.push(l, l, l, l); }
  if (q.status) { where.push('o.status=?'); params.push(q.status); }
  if (q.paymentStatus) { where.push('o.payment_status=?'); params.push(q.paymentStatus); }
  if (q.from) { where.push('o.created_at >= ?'); params.push(new Date(q.from)); }
  if (q.to) { where.push('o.created_at < ?'); params.push(new Date(new Date(q.to).getTime() + 86400000)); }
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM orders o JOIN users u ON u.id=o.user_id WHERE ${w}`, params)).n;
  const rows = await query(`SELECT o.id, o.order_number, o.status, o.payment_status, o.grand_total, o.currency, o.created_at, o.customer_email,
    CONCAT(u.first_name,' ',u.last_name) AS customer_name,
    (SELECT method FROM payments WHERE order_id=o.id ORDER BY id DESC LIMIT 1) AS payment_method,
    (SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=o.id) AS item_count
    FROM orders o JOIN users u ON u.id=o.user_id WHERE ${w} ORDER BY o.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { orders: rows, meta: pageMeta(total, page, limit) });
};
exports.getOrder = async (req, res) => {
  const o = await orders.getOrderDetail(Number(req.params.id));
  if (!o) throw new ApiError(404, 'Commande introuvable');
  o.customer = await one('SELECT id, first_name, last_name, email, phone FROM users WHERE id=?', [o.user_id]);
  o.allowedNext = (orders.TRANSITIONS[o.status] || []).filter((s) => s !== 'cancelled');
  o.canCancel = ['pending', 'confirmed', 'preparing'].includes(o.status);
  o.refundable = o.payments.filter((p) => ['paid', 'partially_refunded'].includes(p.status)).map((p) => ({ paymentId: p.id, refundable: round2(p.amount - p.refunded_amount) }));
  o.statusLabels = orders.STATUS_LABEL;
  ok(res, { order: o });
};
exports.setOrderStatus = async (req, res) => {
  const id = Number(req.params.id); const { status, note } = req.body;
  let order;
  if (status === 'cancelled') order = await orders.cancelOrder(id, { userId: req.user.id, reason: note || 'Annulée par l\'administration' });
  else {
    if (!orders.STATUS_LABEL[status]) throw new ApiError(422, 'Statut inconnu');
    order = await orders.changeStatus(id, status, { userId: req.user.id, note });
  }
  await audit(req, 'order.status', 'order', id, { status, note });
  ok(res, { order: { id: order.id, status: order.status, paymentStatus: order.payment_status } });
};
exports.orderDocument = (kind) => async (req, res) => {
  const o = await orders.getOrderDetail(Number(req.params.id));
  if (!o) throw new ApiError(404, 'Commande introuvable');
  let invoice = o.invoice;
  if (kind === 'invoice' && !invoice) invoice = await withTransaction(async (c) => orders.ensureInvoice(c, o)).then((i) => ({ ...i, issued_at: new Date() }));
  const payment = o.payments.find((p) => p.receipt_number);
  if (kind === 'receipt' && !payment) throw new ApiError(409, 'Aucun paiement encaissé');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${kind}-${o.order_number}.pdf"`);
  buildOrderPdf(res, { kind, order: o, items: o.items, invoice, payment });
};

/* ------------------------------------------------------------ Paiements */
exports.listPayments = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = ['1=1']; const params = [];
  if (req.query.status) { where.push('p.status=?'); params.push(req.query.status); }
  if (req.query.method) { where.push('p.method=?'); params.push(req.query.method); }
  if (req.query.proof === '1') where.push("p.status='pending' AND p.proof_submitted_at IS NOT NULL");
  if (req.query.q) { const l = `%${likeEscape(req.query.q)}%`; where.push('(o.order_number LIKE ? OR p.provider_ref LIKE ? OR p.receipt_number LIKE ?)'); params.push(l, l, l); }
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM payments p JOIN orders o ON o.id=p.order_id WHERE ${w}`, params)).n;
  const rows = await query(`SELECT p.id, p.order_id, o.order_number, p.method, p.provider, p.status, p.amount, p.refunded_amount, p.currency, p.receipt_number, p.provider_ref, p.paid_at, p.created_at, p.failure_reason, p.operator, p.payer_phone, p.payer_reference, p.proof_submitted_at
    FROM payments p JOIN orders o ON o.id=p.order_id WHERE ${w} ORDER BY p.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { payments: rows, meta: pageMeta(total, page, limit) });
};
exports.paymentTransactions = async (req, res) => ok(res, { transactions: await query('SELECT t.*, p.method FROM payment_transactions t JOIN payments p ON p.id=t.payment_id WHERE t.payment_id=? ORDER BY t.id DESC', [req.params.id]) });
exports.allTransactions = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 30 });
  const total = (await one('SELECT COUNT(*) AS n FROM payment_transactions')).n;
  const rows = await query(`SELECT t.id, t.type, t.status, t.amount, t.note, t.created_at, o.order_number, p.method FROM payment_transactions t JOIN payments p ON p.id=t.payment_id JOIN orders o ON o.id=p.order_id ORDER BY t.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
  ok(res, { transactions: rows, meta: pageMeta(total, page, limit) });
};
/** Confirmation manuelle (virement reçu, etc.) — journalisée. */
exports.confirmPayment = async (req, res) => {
  const pay = await one('SELECT * FROM payments WHERE id=?', [req.params.id]);
  if (!pay) throw new ApiError(404, 'Paiement introuvable');
  if (pay.method === 'card' && pay.provider !== 'sandbox') throw new ApiError(409, 'Un paiement par carte est confirmé uniquement par le prestataire');
  const r = await payments.markPaid({ paymentId: pay.id, source: 'manual', userId: req.user.id, providerRef: req.body?.reference || null });
  await audit(req, 'payment.confirm', 'payment', pay.id, { method: pay.method });
  ok(res, r);
};
exports.rejectPayment = async (req, res) => {
  const r = await payments.rejectPayment({ paymentId: Number(req.params.id), reason: req.body.reason, userId: req.user.id });
  await audit(req, 'payment.reject', 'payment', Number(req.params.id), { reason: req.body.reason });
  ok(res, r);
};
const paymentConfig = require('../../services/paymentConfig');
exports.getPaymentConfig = async (_req, res) => ok(res, { config: await paymentConfig.getConfig(), mode: require('../../config/env').env.payment.mode, stripe: require('../../services/payments/stripe').enabled() });
exports.savePaymentConfig = async (req, res) => {
  const config = await paymentConfig.saveConfig(req.body);
  await audit(req, 'payment.config', 'settings', null, { methods: Object.keys(req.body) });
  ok(res, { config });
};
exports.refund = async (req, res) => {
  const r = await payments.refundPayment({ paymentId: req.body.paymentId, amount: req.body.amount, reason: req.body.reason, userId: req.user.id });
  await audit(req, 'payment.refund', 'payment', req.body.paymentId, { amount: r.amount, reason: req.body.reason });
  ok(res, r, 201);
};
exports.listRefunds = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const total = (await one('SELECT COUNT(*) AS n FROM refunds')).n;
  const rows = await query(`SELECT r.*, o.order_number FROM refunds r JOIN orders o ON o.id=r.order_id ORDER BY r.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
  ok(res, { refunds: rows, meta: pageMeta(total, page, limit) });
};

/* ------------------------------------------------------------ Livraisons */
exports.zones = async (_req, res) => {
  const zones = await query('SELECT * FROM shipping_zones ORDER BY id');
  const methods = await query('SELECT * FROM shipping_methods ORDER BY zone_id, fee');
  ok(res, { zones: zones.map((z) => ({ ...z, methods: methods.filter((m) => m.zone_id === z.id) })) });
};
exports.saveZone = async (req, res) => {
  const b = req.body; const id = req.params.id ? Number(req.params.id) : null;
  if (id) await query('UPDATE shipping_zones SET name=?, countries=?, is_active=? WHERE id=?', [b.name, b.countries.toUpperCase().replace(/\s/g, ''), b.is_active === 0 ? 0 : 1, id]);
  else req.params.id = (await query('INSERT INTO shipping_zones (name, countries, is_active) VALUES (?,?,?)', [b.name, b.countries.toUpperCase().replace(/\s/g, ''), b.is_active === 0 ? 0 : 1])).insertId;
  await audit(req, id ? 'shipping_zone.update' : 'shipping_zone.create', 'shipping_zone', req.params.id);
  ok(res, { id: Number(req.params.id) }, id ? 200 : 201);
};
exports.deleteZone = async (req, res) => { await query('DELETE FROM shipping_zones WHERE id=?', [req.params.id]); await audit(req, 'shipping_zone.delete', 'shipping_zone', req.params.id); ok(res, { deleted: true }); };
exports.saveMethod = async (req, res) => {
  const b = req.body; const id = req.params.id ? Number(req.params.id) : null;
  const vals = [b.zone_id, b.code, b.name, b.fee, b.free_over ?? null, b.min_days, b.max_days, b.is_active === 0 ? 0 : 1];
  if (id) await query('UPDATE shipping_methods SET zone_id=?, code=?, name=?, fee=?, free_over=?, min_days=?, max_days=?, is_active=? WHERE id=?', [...vals, id]);
  else req.params.id = (await query('INSERT INTO shipping_methods (zone_id, code, name, fee, free_over, min_days, max_days, is_active) VALUES (?,?,?,?,?,?,?,?)', vals)).insertId;
  await audit(req, id ? 'shipping_method.update' : 'shipping_method.create', 'shipping_method', req.params.id, { fee: b.fee });
  ok(res, { id: Number(req.params.id) }, id ? 200 : 201);
};
exports.deleteMethod = async (req, res) => { await query('DELETE FROM shipping_methods WHERE id=?', [req.params.id]); await audit(req, 'shipping_method.delete', 'shipping_method', req.params.id); ok(res, { deleted: true }); };

exports.listShipments = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = ['1=1']; const params = [];
  const onlyMine = !req.user.isAdmin && !req.user.permissions.includes('shipments.manage');
  if (onlyMine) { where.push('s.courier_id=?'); params.push(req.user.id); }
  if (req.query.status) { where.push('s.status=?'); params.push(req.query.status); }
  if (req.query.courier) { where.push('s.courier_id=?'); params.push(Number(req.query.courier)); }
  if (req.query.q) { const l = `%${likeEscape(req.query.q)}%`; where.push('(o.order_number LIKE ? OR s.tracking_number LIKE ?)'); params.push(l, l); }
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM shipments s JOIN orders o ON o.id=s.order_id WHERE ${w}`, params)).n;
  const rows = await query(`SELECT s.id, s.order_id, o.order_number, o.status AS order_status, s.tracking_number, s.status, s.method_name, s.estimated_delivery, s.shipped_at, s.delivered_at, s.failure_reason, s.courier_id,
    CONCAT(c.first_name,' ',c.last_name) AS courier_name, o.shipping_address, o.customer_phone, o.payment_status, o.grand_total, o.currency,
    (SELECT method FROM payments WHERE order_id=o.id ORDER BY id DESC LIMIT 1) AS payment_method
    FROM shipments s JOIN orders o ON o.id=s.order_id LEFT JOIN users c ON c.id=s.courier_id WHERE ${w} ORDER BY s.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { shipments: rows.map((r) => ({ ...r, shipping_address: (() => { try { return JSON.parse(r.shipping_address); } catch { return {}; } })() })), meta: pageMeta(total, page, limit) });
};
exports.couriers = async (_req, res) => ok(res, { couriers: await query(`SELECT u.id, u.first_name, u.last_name FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='courier' AND u.is_active=1 AND u.deleted_at IS NULL`) });
exports.assignCourier = async (req, res) => {
  const sh = await one('SELECT * FROM shipments WHERE id=?', [req.params.id]);
  if (!sh) throw new ApiError(404, 'Livraison introuvable');
  if (req.body.courier_id) {
    const c = await one(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=? AND r.code='courier' AND u.is_active=1`, [req.body.courier_id]);
    if (!c) throw new ApiError(422, 'Livreur invalide');
  }
  await query('UPDATE shipments SET courier_id=? WHERE id=?', [req.body.courier_id, sh.id]);
  await query('INSERT INTO shipment_tracking (shipment_id, status, note, user_id) VALUES (?,?,?,?)', [sh.id, sh.status, req.body.courier_id ? 'Livreur attribué' : 'Livreur retiré', req.user.id]);
  await audit(req, 'shipment.assign', 'shipment', sh.id, { courier: req.body.courier_id });
  ok(res, { ok: true });
};
/** Mise à jour du statut de livraison (gestionnaire, ou livreur sur ses propres colis). */
exports.updateShipment = async (req, res) => {
  const sh = await one('SELECT * FROM shipments WHERE id=?', [req.params.id]);
  if (!sh) throw new ApiError(404, 'Livraison introuvable');
  const manager = req.user.isAdmin || req.user.permissions.includes('shipments.manage');
  if (!manager) {
    if (sh.courier_id !== req.user.id) throw new ApiError(403, 'Cette livraison ne vous est pas attribuée');
    if (!['out_for_delivery', 'delivered', 'failed'].includes(req.body.status)) throw new ApiError(403, 'Statut non autorisé pour un livreur');
  }
  const target = orders.SHIPMENT_TO_ORDER[req.body.status];
  if (!target) throw new ApiError(422, 'Statut invalide');
  if (req.body.status === 'failed' && !req.body.failure_reason && !req.body.note) throw new ApiError(422, 'Précisez le motif de l\'échec');
  const order = await withTransaction(async (conn) => {
    const o = await orders.applyStatus(conn, sh.order_id, target, { userId: req.user.id, note: req.body.note || req.body.failure_reason, fromShipment: true });
    const sets = ['status=?']; const vals = [req.body.status];
    if (req.body.status === 'shipped' && !sh.shipped_at) sets.push('shipped_at=NOW()');
    if (req.body.status === 'delivered') sets.push('delivered_at=NOW()');
    if (req.body.status === 'failed') { sets.push('failure_reason=?'); vals.push(req.body.failure_reason || req.body.note); }
    await query(`UPDATE shipments SET ${sets.join(',')} WHERE id=?`, [...vals, sh.id], conn);
    await query('INSERT INTO shipment_tracking (shipment_id, status, note, location, user_id) VALUES (?,?,?,?,?)', [sh.id, req.body.status, req.body.note || req.body.failure_reason || null, req.body.location || null, req.user.id], conn);
    return o;
  });
  await audit(req, 'shipment.status', 'shipment', sh.id, { status: req.body.status });
  const full = await one('SELECT * FROM orders WHERE id=?', [sh.order_id]);
  await notifyShipment(full, req.body.status);
  ok(res, { ok: true, orderStatus: full.status });
  return order;
};
async function notifyShipment(order, status) {
  const t = { shipped: ['order_shipped', 'expédiée'], out_for_delivery: ['order_shipped', 'en cours de livraison'], delivered: ['order_delivered', 'livrée'], failed: ['delivery_failed', 'en échec de livraison'] }[status];
  if (!t) return;
  await notify(order.user_id, { type: t[0], title: `Commande ${order.order_number} ${t[1]}`, message: `Votre commande ${order.order_number} est ${t[1]}.`, link: `/compte/commandes/${order.id}` });
}

/* ------------------------------------------------------------ Retours */
exports.listReturns = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = ['1=1']; const params = [];
  if (req.query.status) { where.push('r.status=?'); params.push(req.query.status); }
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM returns r WHERE ${w}`, params)).n;
  const rows = await query(`SELECT r.*, o.order_number, oi.name AS product_name, oi.unit_price, CONCAT(u.first_name,' ',u.last_name) AS customer_name
    FROM returns r JOIN orders o ON o.id=r.order_id JOIN order_items oi ON oi.id=r.order_item_id JOIN users u ON u.id=r.user_id WHERE ${w} ORDER BY r.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { returns: rows, meta: pageMeta(total, page, limit) });
};
const RETURN_FLOW = { requested: ['approved', 'rejected'], approved: ['received', 'rejected'], received: ['refunded', 'closed'], refunded: ['closed'], rejected: [], closed: [] };
exports.decideReturn = async (req, res) => {
  const ret = await one(`SELECT r.*, oi.product_id, oi.variant_id, oi.name, oi.line_total, oi.quantity AS item_qty FROM returns r JOIN order_items oi ON oi.id=r.order_item_id WHERE r.id=?`, [req.params.id]);
  if (!ret) throw new ApiError(404, 'Retour introuvable');
  const { status, admin_note, restock, refund_amount } = req.body;
  if (!RETURN_FLOW[ret.status].includes(status)) throw new ApiError(409, `Transition interdite : ${ret.status} → ${status}`);
  let refundResult = null;
  if (status === 'refunded') {
    if (ret.status !== 'received') throw new ApiError(409, 'Le produit doit d\'abord être reçu et vérifié');
    const pay = await one("SELECT id, amount, refunded_amount FROM payments WHERE order_id=? AND status IN ('paid','partially_refunded') ORDER BY id DESC LIMIT 1", [ret.order_id]);
    if (!pay) throw new ApiError(409, 'Aucun paiement encaissé à rembourser pour cette commande');
    const share = round2((ret.line_total / ret.item_qty) * ret.quantity);
    refundResult = await payments.refundPayment({ paymentId: pay.id, amount: Math.min(refund_amount ?? share, round2(pay.amount - pay.refunded_amount)), reason: `Retour ${ret.rma_number}`, userId: req.user.id, returnId: ret.id });
  }
  await withTransaction(async (conn) => {
    let restocked = ret.restocked;
    if (status === 'received' && restock && ret.product_id && !ret.restocked) {
      await adjustStock(conn, { productId: ret.product_id, variantId: ret.variant_id, delta: ret.quantity, type: 'return', refType: 'return', refId: ret.id, userId: req.user.id, note: `Retour ${ret.rma_number} vérifié` });
      restocked = 1;
    }
    await query('UPDATE returns SET status=?, admin_note=COALESCE(?, admin_note), restocked=? WHERE id=?', [status, admin_note, restocked, ret.id], conn);
    if (status === 'received') {
      const total = await one('SELECT SUM(quantity) AS q FROM order_items WHERE order_id=?', [ret.order_id], conn);
      const back = await one("SELECT COALESCE(SUM(quantity),0) AS q FROM returns WHERE order_id=? AND status IN ('received','refunded','closed')", [ret.order_id], conn);
      if (back.q >= total.q) { try { await orders.applyStatus(conn, ret.order_id, 'returned', { userId: req.user.id, note: 'Tous les articles ont été retournés' }); } catch (_) { /* statut déjà final */ } }
    }
  });
  await audit(req, 'return.decision', 'return', ret.id, { status, restock: !!restock });
  await notify(ret.user_id, { type: 'return', title: `Retour ${ret.rma_number} : ${status}`, message: admin_note || `Votre demande de retour est maintenant « ${status} ».`, link: '/compte/retours' });
  ok(res, { ok: true, refund: refundResult });
};

/* ------------------------------------------------------------ Promotions */
exports.listCoupons = async (_req, res) => {
  const rows = await query('SELECT * FROM coupons ORDER BY id DESC');
  const targets = await query('SELECT * FROM coupon_targets');
  ok(res, { coupons: rows.map((c) => ({ ...c, targets: targets.filter((t) => t.coupon_id === c.id).map((t) => t.target_id) })) });
};
exports.saveCoupon = async (req, res) => {
  const b = req.body; const id = req.params.id ? Number(req.params.id) : null;
  if (b.applies_to !== 'all' && !(b.targets || []).length) throw new ApiError(422, 'Sélectionnez au moins un produit/une catégorie');
  const vals = [b.code, b.description, b.type, b.value, b.min_order, b.max_discount ?? null, b.starts_at ? new Date(b.starts_at) : null, b.ends_at ? new Date(b.ends_at) : null, b.usage_limit ?? null, b.per_user_limit ?? null, b.applies_to, b.is_active === 0 ? 0 : 1];
  await withTransaction(async (conn) => {
    let cid = id;
    if (id) await query('UPDATE coupons SET code=?, description=?, type=?, value=?, min_order=?, max_discount=?, starts_at=?, ends_at=?, usage_limit=?, per_user_limit=?, applies_to=?, is_active=? WHERE id=?', [...vals, id], conn);
    else cid = (await query('INSERT INTO coupons (code, description, type, value, min_order, max_discount, starts_at, ends_at, usage_limit, per_user_limit, applies_to, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', vals, conn)).insertId;
    await query('DELETE FROM coupon_targets WHERE coupon_id=?', [cid], conn);
    if (b.applies_to !== 'all') for (const t of b.targets) await query('INSERT INTO coupon_targets (coupon_id, target_type, target_id) VALUES (?,?,?)', [cid, b.applies_to === 'products' ? 'product' : 'category', t], conn);
    req.params.id = cid;
  });
  await audit(req, id ? 'coupon.update' : 'coupon.create', 'coupon', req.params.id, { code: b.code });
  ok(res, { id: Number(req.params.id) }, id ? 200 : 201);
};
exports.deleteCoupon = async (req, res) => {
  const used = await one('SELECT COUNT(*) AS n FROM coupon_usages WHERE coupon_id=?', [req.params.id]);
  if (used.n) { await query('UPDATE coupons SET is_active=0 WHERE id=?', [req.params.id]); await audit(req, 'coupon.disable', 'coupon', req.params.id); return ok(res, { disabled: true, message: 'Code déjà utilisé : désactivé au lieu d\'être supprimé.' }); }
  await query('DELETE FROM coupons WHERE id=?', [req.params.id]);
  await audit(req, 'coupon.delete', 'coupon', req.params.id);
  ok(res, { deleted: true });
};

/* ------------------------------------------------------------ Avis (modération) */
exports.listReviews = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = ['1=1']; const params = [];
  if (req.query.status) { where.push('r.status=?'); params.push(req.query.status); }
  if (req.query.rating) { where.push('r.rating=?'); params.push(Number(req.query.rating)); }
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM reviews r WHERE ${w}`, params)).n;
  const rows = await query(`SELECT r.*, p.name AS product_name, CONCAT(u.first_name,' ',u.last_name) AS author FROM reviews r JOIN products p ON p.id=r.product_id JOIN users u ON u.id=r.user_id WHERE ${w} ORDER BY r.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { reviews: rows, meta: pageMeta(total, page, limit) });
};
exports.moderateReview = async (req, res) => {
  const r = await one('SELECT product_id FROM reviews WHERE id=?', [req.params.id]);
  if (!r) throw new ApiError(404, 'Avis introuvable');
  await withTransaction(async (c) => { await query('UPDATE reviews SET status=? WHERE id=?', [req.body.status, req.params.id], c); await refreshRating(r.product_id, c); });
  await audit(req, 'review.moderate', 'review', req.params.id, { status: req.body.status });
  ok(res, { ok: true });
};
exports.deleteReview = async (req, res) => {
  const r = await one('SELECT product_id FROM reviews WHERE id=?', [req.params.id]);
  if (!r) throw new ApiError(404, 'Avis introuvable');
  await withTransaction(async (c) => { await query('DELETE FROM reviews WHERE id=?', [req.params.id], c); await refreshRating(r.product_id, c); });
  await audit(req, 'review.delete', 'review', req.params.id);
  ok(res, { deleted: true });
};
