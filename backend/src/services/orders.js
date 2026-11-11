const { query, one, withTransaction } = require('../config/db');
const { ApiError } = require('../utils/http');
const { orderNumber, trackingNumber, randomCode, round2, safeJson } = require('../utils/helpers');
const { computeQuote } = require('./pricing');
const { adjustStock, restockOrder } = require('./stock');
const { notify, notifyStaff } = require('../utils/notify');
const { sendMail, esc } = require('../utils/mailer');
const { env } = require('../config/env');

const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivering', 'delivered', 'delivery_failed'],
  delivering: ['delivered', 'delivery_failed'],
  delivery_failed: ['delivering', 'shipped', 'returned'],
  delivered: ['completed', 'returned'],
  completed: ['returned'],
  returned: [],
  cancelled: [],
};
const ORDER_TO_SHIPMENT = {
  pending: 'pending', confirmed: 'confirmed', preparing: 'preparing', shipped: 'shipped', delivering: 'out_for_delivery',
  delivered: 'delivered', completed: 'delivered', delivery_failed: 'failed', returned: 'returned', cancelled: 'cancelled',
};
const SHIPMENT_TO_ORDER = {
  confirmed: 'confirmed', preparing: 'preparing', shipped: 'shipped', out_for_delivery: 'delivering',
  delivered: 'delivered', failed: 'delivery_failed', returned: 'returned',
};
const STATUS_LABEL = {
  pending: 'en attente', confirmed: 'confirmée', preparing: 'en préparation', shipped: 'expédiée', delivering: 'en cours de livraison',
  delivered: 'livrée', completed: 'clôturée', cancelled: 'annulée', delivery_failed: 'échec de livraison', returned: 'retournée',
};
const NOTIFY_TYPE = { confirmed: 'order_confirmed', preparing: 'order_preparing', shipped: 'order_shipped', delivering: 'order_shipped', delivered: 'order_delivered', cancelled: 'order_cancelled' };

async function ensureInvoice(conn, order) {
  const existing = await one('SELECT id, invoice_number FROM invoices WHERE order_id=?', [order.id], conn);
  if (existing) return existing;
  const number = randomCode('FAC', 8);
  await query('INSERT INTO invoices (invoice_number, order_id, total) VALUES (?,?,?)', [number, order.id, order.grand_total], conn);
  return { invoice_number: number };
}

async function addHistory(conn, orderId, status, note, userId) {
  await query('INSERT INTO order_status_history (order_id, status, note, user_id) VALUES (?,?,?,?)', [orderId, status, note || null, userId || null], conn);
}

/**
 * Applique un changement de statut (règles de transition, historique, expédition synchronisée).
 * Doit être appelé dans une transaction.
 */
async function applyStatus(conn, orderId, newStatus, { userId = null, note = null, fromShipment = false } = {}) {
  const order = await one('SELECT * FROM orders WHERE id=? FOR UPDATE', [orderId], conn);
  if (!order) throw new ApiError(404, 'Commande introuvable');
  if (order.status === newStatus) return order;
  if (newStatus === 'cancelled') throw new ApiError(400, 'Utilisez la procédure d\'annulation');
  if (!TRANSITIONS[order.status]?.includes(newStatus)) {
    throw new ApiError(409, `Transition interdite : ${STATUS_LABEL[order.status]} → ${STATUS_LABEL[newStatus]}`);
  }
  if (newStatus === 'confirmed') {
    const pay = await one('SELECT method, status FROM payments WHERE order_id=? ORDER BY id DESC LIMIT 1', [orderId], conn);
    if (!pay || (pay.method !== 'cod' && pay.status !== 'paid')) throw new ApiError(409, 'Paiement non confirmé : impossible de confirmer la commande');
    await ensureInvoice(conn, order);
  }
  await query('UPDATE orders SET status=? WHERE id=?', [newStatus, orderId], conn);
  await addHistory(conn, orderId, newStatus, note, userId);

  const shipment = await one('SELECT * FROM shipments WHERE order_id=? FOR UPDATE', [orderId], conn);
  if (shipment && !fromShipment) {
    const ss = ORDER_TO_SHIPMENT[newStatus];
    const sets = ['status=?']; const vals = [ss];
    if (ss === 'shipped' && !shipment.shipped_at) sets.push('shipped_at=NOW()');
    if (ss === 'delivered') sets.push('delivered_at=NOW()');
    await query(`UPDATE shipments SET ${sets.join(',')} WHERE id=?`, [...vals, shipment.id], conn);
    await query('INSERT INTO shipment_tracking (shipment_id, status, note, user_id) VALUES (?,?,?,?)', [shipment.id, ss, note, userId], conn);
  }
  // paiement à la livraison : encaissé à la livraison
  if (newStatus === 'delivered') {
    const pay = await one("SELECT id, amount FROM payments WHERE order_id=? AND method='cod' AND status='pending' LIMIT 1", [orderId], conn);
    if (pay) {
      const receipt = randomCode('RC', 8);
      await query("UPDATE payments SET status='paid', paid_at=NOW(), receipt_number=? WHERE id=?", [receipt, pay.id], conn);
      await query("INSERT INTO payment_transactions (payment_id, type, status, amount, note, user_id) VALUES (?,?,?,?,?,?)", [pay.id, 'manual', 'paid', pay.amount, 'Encaissé à la livraison', userId], conn);
      await query("UPDATE orders SET payment_status='paid' WHERE id=?", [orderId], conn);
    }
  }
  return { ...order, status: newStatus };
}

/** Notifie le client après changement de statut (hors transaction). */
async function notifyStatus(order, status) {
  const type = NOTIFY_TYPE[status];
  if (!type) return;
  await notify(order.user_id, {
    type, title: `Commande ${order.order_number} ${STATUS_LABEL[status]}`,
    message: `Votre commande ${order.order_number} est maintenant « ${STATUS_LABEL[status]} ».`, link: `/compte/commandes/${order.id}`,
  });
}

async function changeStatus(orderId, status, opts = {}) {
  const order = await withTransaction((conn) => applyStatus(conn, orderId, status, opts));
  await notifyStatus(order, status);
  return one('SELECT * FROM orders WHERE id=?', [orderId]);
}

/** Annulation : remise en stock, rétablissement du coupon, remboursement si payé. */
async function cancelOrder(orderId, { userId = null, reason = null, byCustomer = false, customerId = null } = {}) {
  let paidPayment = null;
  const order = await withTransaction(async (conn) => {
    const o = await one('SELECT * FROM orders WHERE id=? FOR UPDATE', [orderId], conn);
    if (!o) throw new ApiError(404, 'Commande introuvable');
    if (byCustomer && o.user_id !== customerId) throw new ApiError(404, 'Commande introuvable');
    const allowed = byCustomer ? ['pending', 'confirmed'] : ['pending', 'confirmed', 'preparing'];
    if (!allowed.includes(o.status)) throw new ApiError(409, `Annulation impossible : commande ${STATUS_LABEL[o.status]}`);
    await query("UPDATE orders SET status='cancelled', cancelled_at=NOW(), cancel_reason=? WHERE id=?", [reason, orderId], conn);
    await addHistory(conn, orderId, 'cancelled', reason, userId);
    await restockOrder(conn, orderId, 'cancel', userId);
    if (o.coupon_id) {
      const del = await query('DELETE FROM coupon_usages WHERE order_id=?', [orderId], conn);
      if (del.affectedRows) await query('UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id=?', [o.coupon_id], conn);
    }
    await query("UPDATE shipments SET status='cancelled', failure_reason='Commande annulée' WHERE order_id=?", [orderId], conn);
    await query("UPDATE payments SET status='cancelled' WHERE order_id=? AND status='pending'", [orderId], conn);
    paidPayment = await one("SELECT id, amount, refunded_amount FROM payments WHERE order_id=? AND status IN ('paid','partially_refunded') LIMIT 1", [orderId], conn);
    return o;
  });
  if (paidPayment) {
    const { refundPayment } = require('./payments');
    try {
      await refundPayment({ paymentId: paidPayment.id, amount: round2(paidPayment.amount - paidPayment.refunded_amount), reason: `Annulation : ${reason || 'commande annulée'}`, userId });
    } catch (e) { console.error('[cancel] remboursement échoué', e.message); }
  }
  await notifyStatus(order, 'cancelled');
  return one('SELECT * FROM orders WHERE id=?', [orderId]);
}

/** Création d'une commande — le serveur recalcule tout (règle 16) dans une transaction (règle 17). */
async function createOrder({ user, items, couponCode, shippingMethodId, address, paymentMethod, notes, idempotencyKey }) {
  const payments = require('./payments');
  if (!(await payments.enabledMethods()).some((m) => m.code === paymentMethod)) throw new ApiError(422, 'Moyen de paiement non disponible');

  const created = await withTransaction(async (conn) => {
    if (idempotencyKey) {
      const dup = await one('SELECT * FROM orders WHERE idempotency_key=? AND user_id=?', [idempotencyKey, user.id], conn);
      if (dup) return { order: dup, duplicate: true };
    }
    const quote = await computeQuote({ items, couponCode, userId: user.id, shippingMethodId, country: address.country, conn, lock: true });
    if (quote.issues.length) throw new ApiError(409, quote.issues[0].message, quote.issues);
    if (couponCode && quote.couponError) throw new ApiError(422, quote.couponError);
    if (!quote.shippingMethod || (shippingMethodId && quote.shippingMethod.id !== Number(shippingMethodId))) {
      throw new ApiError(422, 'Mode de livraison indisponible pour cette adresse');
    }
    const number = orderNumber();
    const res = await query(
      `INSERT INTO orders (order_number, user_id, status, payment_status, subtotal, discount_total, shipping_total, tax_total, grand_total, currency,
         coupon_id, coupon_code, shipping_method_id, shipping_method_name, shipping_address, customer_email, customer_phone, notes, idempotency_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [number, user.id, 'pending', 'pending', quote.subtotal, quote.discount, quote.shipping, quote.tax, quote.grandTotal, env.currency,
        quote.coupon?.id || null, quote.coupon?.code || null, quote.shippingMethod.id, quote.shippingMethod.name,
        JSON.stringify(address), user.email, address.phone || user.phone || null, notes || null, idempotencyKey || null], conn);
    const orderId = res.insertId;
    for (const l of quote.lines) {
      const lineTotal = round2(l.lineTotal - l.discount);
      await query(
        'INSERT INTO order_items (order_id, product_id, variant_id, sku, name, variant_name, image, unit_price, quantity, discount, line_total) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [orderId, l.productId, l.variantId, l.sku, l.name, l.variantName, l.image, l.unitPrice, l.quantity, l.discount, lineTotal], conn);
      await adjustStock(conn, { productId: l.productId, variantId: l.variantId, delta: -l.quantity, type: 'sale', refType: 'order', refId: orderId, userId: user.id, productName: l.name });
      await query('UPDATE products SET sold_count = sold_count + ? WHERE id=?', [l.quantity, l.productId], conn);
    }
    if (quote.coupon) {
      const upd = await query('UPDATE coupons SET used_count = used_count + 1 WHERE id=? AND (usage_limit IS NULL OR used_count < usage_limit)', [quote.coupon.id], conn);
      if (!upd.affectedRows) throw new ApiError(422, "Ce code promotionnel n'est plus disponible");
      await query('INSERT INTO coupon_usages (coupon_id, user_id, order_id, discount) VALUES (?,?,?,?)', [quote.coupon.id, user.id, orderId, quote.discount], conn);
    }
    await addHistory(conn, orderId, 'pending', 'Commande créée', user.id);
    const est = new Date(Date.now() + quote.shippingMethod.max_days * 86400000).toISOString().slice(0, 10);
    const ship = await query('INSERT INTO shipments (order_id, tracking_number, method_name, status, estimated_delivery) VALUES (?,?,?,?,?)',
      [orderId, trackingNumber(), quote.shippingMethod.name, 'pending', est], conn);
    await query('INSERT INTO shipment_tracking (shipment_id, status, note) VALUES (?,?,?)', [ship.insertId, 'pending', 'Commande reçue'], conn);
    const payment = await payments.createPayment(conn, { id: orderId, order_number: number, grand_total: quote.grandTotal, currency: env.currency }, paymentMethod);
    // vide le panier serveur
    await query('DELETE ci FROM cart_items ci JOIN carts c ON c.id=ci.cart_id WHERE c.user_id=?', [user.id], conn);
    const order = await one('SELECT * FROM orders WHERE id=?', [orderId], conn);
    return { order, payment };
  });

  if (created.duplicate) {
    const payment = await one('SELECT * FROM payments WHERE order_id=? ORDER BY id DESC LIMIT 1', [created.order.id]);
    return { order: created.order, payment: payments.publicPayment(payment), duplicate: true };
  }
  const { order, payment } = created;
  const instructions = await payments.initiate(order, payment, user);
  await notify(user.id, {
    type: 'order_created', title: `Commande ${order.order_number} enregistrée`,
    message: `Merci ! Votre commande de ${Number(order.grand_total).toFixed(2)} ${order.currency} a bien été enregistrée.`, link: `/compte/commandes/${order.id}`, email: false,
  });
  await notifyStaff(['orders.view', 'orders.manage'], {
    type: 'new_order', title: `Nouvelle commande ${order.order_number}`,
    message: `${user.first_name} ${user.last_name} · ${Number(order.grand_total).toFixed(2)} ${order.currency} · ${{ cod: 'paiement à la livraison', card: 'carte', mobile_money: 'Mobile Money', bank_transfer: 'virement' }[paymentMethod] || paymentMethod}`, link: `/admin/commandes/${order.id}`, email: true,
  });
  try {
    const low = await query(
      `SELECT p.name, i.quantity FROM inventories i JOIN products p ON p.id=i.product_id
        JOIN order_items oi ON oi.product_id=i.product_id AND oi.variant_id=i.variant_id AND oi.order_id=?
       WHERE i.quantity <= i.low_stock_threshold`, [order.id]);
    for (const l of low) {
      await notifyStaff(['stock.view', 'stock.manage'], { type: 'low_stock', title: l.quantity <= 0 ? `Rupture de stock : ${l.name}` : `Stock faible : ${l.name}`, message: `Il reste ${l.quantity} unité(s).`, link: '/admin/stocks' });
    }
  } catch (e) { console.error('[low-stock]', e.message); }
  sendMail({
    to: user.email, subject: `Confirmation de commande ${order.order_number}`, title: 'Merci pour votre commande !',
    html: `<p>Bonjour ${esc(user.first_name)},</p><p>Votre commande <b>${esc(order.order_number)}</b> d'un montant de <b>${Number(order.grand_total).toFixed(2)} ${esc(order.currency)}</b> a bien été enregistrée.</p>`,
    cta: { url: `${env.frontendUrl}/compte/commandes/${order.id}`, label: 'Suivre ma commande' },
  });
  return { order, payment: payments.publicPayment(payment), instructions };
}

async function getOrderDetail(orderId, { userId = null } = {}) {
  const order = await one('SELECT * FROM orders WHERE id=?' + (userId ? ' AND user_id=?' : ''), userId ? [orderId, userId] : [orderId]);
  if (!order) return null;
  const [items, history, payments, shipment, invoice] = await Promise.all([
    query('SELECT oi.*, (SELECT COALESCE(SUM(r.quantity),0) FROM returns r WHERE r.order_item_id=oi.id AND r.status<>\'rejected\') AS returned_qty FROM order_items oi WHERE oi.order_id=?', [orderId]),
    query('SELECT status, note, created_at FROM order_status_history WHERE order_id=? ORDER BY id', [orderId]),
    query('SELECT id, method, provider, status, amount, refunded_amount, currency, receipt_number, paid_at, created_at, failure_reason, operator, payer_phone, payer_reference, proof_submitted_at FROM payments WHERE order_id=? ORDER BY id DESC', [orderId]),
    one('SELECT s.*, u.first_name AS courier_first_name, u.last_name AS courier_last_name FROM shipments s LEFT JOIN users u ON u.id=s.courier_id WHERE s.order_id=?', [orderId]),
    one('SELECT invoice_number, issued_at FROM invoices WHERE order_id=?', [orderId]),
  ]);
  let tracking = [];
  if (shipment) tracking = await query('SELECT status, note, location, created_at FROM shipment_tracking WHERE shipment_id=? ORDER BY id', [shipment.id]);
  return { ...order, shipping_address: safeJson(order.shipping_address, {}), items, history, payments, shipment, tracking, invoice };
}

/** Annule automatiquement les commandes à paiement en ligne jamais réglées (libère le stock). */
async function expireUnpaidOrders() {
  const rows = await query(
    `SELECT o.id FROM orders o JOIN payments p ON p.order_id=o.id
     WHERE o.status='pending' AND p.method IN ('card','mobile_money') AND p.status IN ('pending','failed') AND p.proof_submitted_at IS NULL
       AND o.created_at < (NOW() - INTERVAL ? MINUTE) GROUP BY o.id`, [env.paymentTimeoutMin]);
  for (const r of rows) {
    try { await cancelOrder(r.id, { reason: 'Paiement non reçu dans le délai imparti' }); } catch (e) { console.error('[expire]', r.id, e.message); }
  }
  return rows.length;
}

module.exports = { TRANSITIONS, STATUS_LABEL, SHIPMENT_TO_ORDER, ORDER_TO_SHIPMENT, ensureInvoice, applyStatus, changeStatus, cancelOrder, createOrder, getOrderDetail, expireUnpaidOrders, addHistory };
