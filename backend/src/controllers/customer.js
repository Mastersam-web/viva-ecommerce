const { query, one, withTransaction } = require('../config/db');
const { ApiError, ok } = require('../utils/http');
const { pagination, pageMeta, randomCode, round2 } = require('../utils/helpers');
const { computeQuote } = require('../services/pricing');
const orders = require('../services/orders');
const payments = require('../services/payments');
const { buildOrderPdf } = require('../utils/pdf');
const { getSetting } = require('../services/settings');
const { adjustStock } = require('../services/stock');
const { toCard, SELECT_CARD, FROM_CARD } = require('./catalog');
const { requireVerifiedIfEnabled } = require('./auth');
const { sendMail, esc } = require('../utils/mailer');
const { notify, notifyStaff } = require('../utils/notify');

/* ------------------------------------------------------------------ Panier (synchronisé) */
async function ensureCart(userId, conn) {
  await query('INSERT IGNORE INTO carts (user_id) VALUES (?)', [userId], conn);
  return one('SELECT id FROM carts WHERE user_id=?', [userId], conn);
}
async function cartPayload(userId) {
  const rows = await query(
    `SELECT ci.product_id AS productId, ci.variant_id AS variantId, ci.quantity FROM cart_items ci JOIN carts c ON c.id=ci.cart_id WHERE c.user_id=?`, [userId]);
  return rows;
}
exports.getCart = async (req, res) => ok(res, { items: await cartPayload(req.user.id) });
exports.putCart = async (req, res) => {
  await withTransaction(async (conn) => {
    const cart = await ensureCart(req.user.id, conn);
    await query('DELETE FROM cart_items WHERE cart_id=?', [cart.id], conn);
    for (const it of req.body.items) {
      const p = await one("SELECT id FROM products WHERE id=? AND status='active'", [it.productId], conn);
      if (p) await query('INSERT INTO cart_items (cart_id, product_id, variant_id, quantity) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity)', [cart.id, it.productId, it.variantId, it.quantity], conn);
    }
  });
  ok(res, { items: await cartPayload(req.user.id) });
};

/** POST /cart/quote — valide le panier côté serveur (visiteur autorisé) : prix, stock, promo, livraison. */
exports.quote = async (req, res) => {
  const q = await computeQuote({ items: req.body.items, couponCode: req.body.couponCode, userId: req.user?.id, shippingMethodId: req.body.shippingMethodId, country: req.body.country });
  ok(res, {
    lines: q.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, slug: l.slug, name: l.name, variantName: l.variantName, image: l.image, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal, discount: l.discount, stock: l.stock })),
    issues: q.issues, subtotal: q.subtotal, discount: q.discount, couponCode: q.coupon?.code || null, couponError: q.couponError,
    shipping: q.shipping, shippingMethod: q.shippingMethod && { id: q.shippingMethod.id, name: q.shippingMethod.name }, shippingMethods: q.shippingMethods.map((m) => ({ id: m.id, name: m.name, price: m.price, minDays: m.min_days, maxDays: m.max_days })),
    tax: q.tax, taxRate: q.taxRate, grandTotal: q.grandTotal,
  });
};

/* ------------------------------------------------------------------ Adresses */
exports.listAddresses = async (req, res) => ok(res, { addresses: await query('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, id DESC', [req.user.id]) });
async function saveAddress(conn, userId, a, id) {
  if (a.is_default) await query('UPDATE addresses SET is_default=0 WHERE user_id=?', [userId], conn);
  const cols = [a.label, a.full_name, a.phone, a.line1, a.line2, a.city, a.state, a.postal_code, a.country, a.is_default ? 1 : 0];
  if (id) {
    const r = await query('UPDATE addresses SET label=?, full_name=?, phone=?, line1=?, line2=?, city=?, state=?, postal_code=?, country=?, is_default=? WHERE id=? AND user_id=?', [...cols, id, userId], conn);
    if (!r.affectedRows) throw new ApiError(404, 'Adresse introuvable');
    return id;
  }
  const count = await one('SELECT COUNT(*) AS n FROM addresses WHERE user_id=?', [userId], conn);
  if (!count.n) cols[9] = 1; // première adresse = par défaut
  return (await query('INSERT INTO addresses (label, full_name, phone, line1, line2, city, state, postal_code, country, is_default, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [...cols, userId], conn)).insertId;
}
exports.createAddress = async (req, res) => { const id = await withTransaction((c) => saveAddress(c, req.user.id, req.body)); ok(res, { address: await one('SELECT * FROM addresses WHERE id=?', [id]) }, 201); };
exports.updateAddress = async (req, res) => { await withTransaction((c) => saveAddress(c, req.user.id, req.body, Number(req.params.id))); ok(res, { address: await one('SELECT * FROM addresses WHERE id=?', [req.params.id]) }); };
exports.deleteAddress = async (req, res) => { await query('DELETE FROM addresses WHERE id=? AND user_id=?', [req.params.id, req.user.id]); ok(res, { message: 'Adresse supprimée' }); };

/* ------------------------------------------------------------------ Commandes */
exports.createOrder = async (req, res) => {
  await requireVerifiedIfEnabled(req.user);
  const b = req.body;
  let address = b.address;
  if (b.addressId) {
    const a = await one('SELECT * FROM addresses WHERE id=? AND user_id=?', [b.addressId, req.user.id]);
    if (!a) throw new ApiError(404, 'Adresse introuvable');
    address = { label: a.label, full_name: a.full_name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postal_code: a.postal_code, country: a.country };
  } else if (b.address?.is_default !== undefined || true) {
    // adresse saisie à la volée : on l'enregistre si le client n'en a pas encore
    const n = await one('SELECT COUNT(*) AS n FROM addresses WHERE user_id=?', [req.user.id]);
    if (!n.n) await withTransaction((c) => saveAddress(c, req.user.id, { ...b.address, is_default: 1 }));
  }
  const result = await orders.createOrder({ user: req.user, items: b.items, couponCode: b.couponCode || null, shippingMethodId: b.shippingMethodId, address, paymentMethod: b.paymentMethod, notes: b.notes, idempotencyKey: b.idempotencyKey });
  ok(res, { order: { id: result.order.id, orderNumber: result.order.order_number, status: result.order.status, paymentStatus: result.order.payment_status, grandTotal: result.order.grand_total }, payment: result.payment, instructions: result.instructions || null, duplicate: !!result.duplicate }, result.duplicate ? 200 : 201);
};

exports.listOrders = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 10 });
  const where = ['o.user_id=?']; const params = [req.user.id];
  if (req.query.status) { where.push('o.status=?'); params.push(String(req.query.status)); }
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM orders o WHERE ${w}`, params)).n;
  const rows = await query(`SELECT o.id, o.order_number, o.status, o.payment_status, o.grand_total, o.currency, o.created_at,
    (SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=o.id) AS item_count,
    (SELECT image FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1) AS image,
    (SELECT tracking_number FROM shipments WHERE order_id=o.id) AS tracking_number
    FROM orders o WHERE ${w} ORDER BY o.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { orders: rows, meta: pageMeta(total, page, limit) });
};
exports.getOrder = async (req, res) => {
  const o = await orders.getOrderDetail(Number(req.params.id), { userId: req.user.id }); // règle 9 : uniquement ses commandes
  if (!o) throw new ApiError(404, 'Commande introuvable');
  const days = Number(await getSetting('store.return_days', '30'));
  // Le client ne change jamais un statut : il peut seulement demander une annulation à l'équipe.
  o.canRequestCancel = ['pending', 'confirmed', 'preparing'].includes(o.status);
  const last = o.payments[0];
  o.canPay = o.status === 'pending' && !!last && ['failed', 'pending', 'unpaid'].includes(o.payment_status) && last.method !== 'cod';
  const deliveredAt = o.shipment?.delivered_at ? new Date(o.shipment.delivered_at) : null;
  o.canReturn = ['delivered', 'completed'].includes(o.status) && (!deliveredAt || Date.now() - deliveredAt.getTime() < days * 86400000);
  ok(res, { order: o });
};
/** Demande d'annulation : crée une demande pour l'équipe, qui décide. */
exports.requestCancel = async (req, res) => {
  const o = await one('SELECT id, order_number, status FROM orders WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!o) throw new ApiError(404, 'Commande introuvable');
  if (!['pending', 'confirmed', 'preparing'].includes(o.status)) throw new ApiError(409, "Cette commande ne peut plus faire l'objet d'une demande d'annulation");
  const dup = await one("SELECT id FROM support_tickets WHERE order_id=? AND user_id=? AND subject LIKE 'Demande d\\'annulation%' AND status IN ('open','in_progress')", [o.id, req.user.id]);
  if (dup) throw new ApiError(409, "Une demande d'annulation est déjà en cours de traitement");
  const number = randomCode('TCK', 7);
  const r = await query('INSERT INTO support_tickets (ticket_number, user_id, name, email, subject, type, order_id) VALUES (?,?,?,?,?,?,?)',
    [number, req.user.id, `${req.user.first_name} ${req.user.last_name}`, req.user.email, `Demande d'annulation - ${o.order_number}`, 'complaint', o.id]);
  await query('INSERT INTO support_messages (ticket_id, user_id, is_staff, message) VALUES (?,?,0,?)', [r.insertId, req.user.id, req.body.reason || "Je souhaite annuler ma commande."]);
  await notifyStaff(['orders.manage', 'support.manage'], { type: 'cancel_request', title: `Demande d'annulation - ${o.order_number}`, message: req.body.reason || 'Le client souhaite annuler sa commande.', link: `/admin/commandes/${o.id}`, email: true });
  await notify(req.user.id, { type: 'cancel_request', title: `Demande d'annulation envoyée - ${o.order_number}`, message: 'Notre équipe étudie votre demande et vous répondra rapidement.', link: `/compte/commandes/${o.id}`, email: false });
  ok(res, { ticketNumber: number, message: "Votre demande d'annulation a été transmise à notre équipe." }, 201);
};
exports.paymentContext = async (req, res) => ok(res, await payments.getPaymentContext(Number(req.params.id), req.user.id));
exports.payCard = async (req, res) => ok(res, await payments.payCardSandbox(Number(req.params.id), req.user.id, req.body));
exports.payStripe = async (req, res) => ok(res, await payments.startStripe(Number(req.params.id), req.user.id));
exports.payMobile = async (req, res) => ok(res, await payments.mobileInit(Number(req.params.id), req.user.id, req.body));
exports.payMobileSandbox = async (req, res) => ok(res, await payments.mobileSandbox(Number(req.params.id), req.user.id, req.body));
exports.payProof = async (req, res) => ok(res, await payments.submitProof(Number(req.params.id), req.user.id, req.body), 201);
exports.retryPayment = async (req, res) => ok(res, await payments.retryPayment(Number(req.params.id), req.user.id, req.body.paymentMethod));
exports.tracking = async (req, res) => {
  const o = await orders.getOrderDetail(Number(req.params.id), { userId: req.user.id });
  if (!o) throw new ApiError(404, 'Commande introuvable');
  ok(res, { orderNumber: o.order_number, status: o.status, shipment: o.shipment && { trackingNumber: o.shipment.tracking_number, status: o.shipment.status, estimatedDelivery: o.shipment.estimated_delivery, shippedAt: o.shipment.shipped_at, deliveredAt: o.shipment.delivered_at, method: o.shipment.method_name }, events: o.tracking });
};
/** Suivi public par numéro de commande + email. */
exports.trackPublic = async (req, res) => {
  const o = await one('SELECT id, order_number, status FROM orders WHERE order_number=? AND customer_email=?', [String(req.query.order || ''), String(req.query.email || '').toLowerCase()]);
  if (!o) throw new ApiError(404, 'Aucune commande ne correspond à ces informations');
  const full = await orders.getOrderDetail(o.id);
  ok(res, { orderNumber: o.order_number, status: o.status, shipment: full.shipment && { trackingNumber: full.shipment.tracking_number, status: full.shipment.status, estimatedDelivery: full.shipment.estimated_delivery }, events: full.tracking });
};

/* ------------------------------------------------------------------ Documents PDF */
async function sendDoc(req, res, kind) {
  const o = await orders.getOrderDetail(Number(req.params.id), { userId: req.user.id });
  if (!o) throw new ApiError(404, 'Commande introuvable');
  if (kind === 'invoice' && !o.invoice) throw new ApiError(409, "La facture sera disponible une fois la commande confirmée");
  const payment = o.payments.find((p) => p.receipt_number);
  if (kind === 'receipt' && !payment) throw new ApiError(409, "Aucun paiement encaissé pour cette commande");
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${kind}-${o.order_number}.pdf"`);
  buildOrderPdf(res, { kind, order: o, items: o.items, invoice: o.invoice, payment });
}
exports.invoicePdf = (req, res) => sendDoc(req, res, 'invoice');
exports.receiptPdf = (req, res) => sendDoc(req, res, 'receipt');
exports.listInvoices = async (req, res) => ok(res, { invoices: await query(
  `SELECT i.invoice_number, i.issued_at, i.total, o.id AS order_id, o.order_number, o.currency FROM invoices i JOIN orders o ON o.id=i.order_id WHERE o.user_id=? ORDER BY i.id DESC`, [req.user.id]) });

/* ------------------------------------------------------------------ Favoris */
async function wishlistId(userId) { await query('INSERT IGNORE INTO wishlists (user_id) VALUES (?)', [userId]); return (await one('SELECT id FROM wishlists WHERE user_id=?', [userId])).id; }
exports.getWishlist = async (req, res) => {
  const wid = await wishlistId(req.user.id);
  const rows = await query(`SELECT ${SELECT_CARD} ${FROM_CARD} JOIN wishlist_items wi ON wi.product_id=p.id WHERE wi.wishlist_id=? AND p.status='active' ORDER BY wi.added_at DESC`, [wid]);
  ok(res, { products: rows.map(toCard) });
};
exports.addWishlist = async (req, res) => {
  const p = await one("SELECT id FROM products WHERE id=? AND status='active'", [req.params.id]);
  if (!p) throw new ApiError(404, 'Produit introuvable');
  await query('INSERT IGNORE INTO wishlist_items (wishlist_id, product_id) VALUES (?,?)', [await wishlistId(req.user.id), p.id]);
  ok(res, { message: 'Ajouté aux favoris' }, 201);
};
exports.removeWishlist = async (req, res) => { await query('DELETE FROM wishlist_items WHERE wishlist_id=? AND product_id=?', [await wishlistId(req.user.id), req.params.id]); ok(res, { message: 'Retiré des favoris' }); };
exports.wishlistIds = async (req, res) => ok(res, { ids: (await query('SELECT wi.product_id FROM wishlist_items wi JOIN wishlists w ON w.id=wi.wishlist_id WHERE w.user_id=?', [req.user.id])).map((r) => r.product_id) });

/* ------------------------------------------------------------------ Avis (achat vérifié) */
async function refreshRating(productId, conn) {
  await query(`UPDATE products SET rating_avg=COALESCE((SELECT ROUND(AVG(rating),2) FROM reviews WHERE product_id=? AND status='published'),0),
    rating_count=(SELECT COUNT(*) FROM reviews WHERE product_id=? AND status='published') WHERE id=?`, [productId, productId, productId], conn);
}
exports.refreshRating = refreshRating;
exports.upsertReview = async (req, res) => {
  const productId = Number(req.params.id);
  const bought = await one(`SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.user_id=? AND oi.product_id=? AND o.status IN ('delivered','completed') LIMIT 1`, [req.user.id, productId]);
  if (!bought) throw new ApiError(403, 'Seuls les clients ayant reçu ce produit peuvent publier un avis');
  const { rating, title, comment } = req.body;
  await withTransaction(async (conn) => {
    await query('INSERT INTO reviews (product_id, user_id, order_id, rating, title, comment) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE rating=VALUES(rating), title=VALUES(title), comment=VALUES(comment)', [productId, req.user.id, bought.id, rating, title, comment], conn);
    await refreshRating(productId, conn);
  });
  notifyStaff(['reviews.moderate'], { type: 'new_review', title: 'Nouvel avis client', message: `${req.user.first_name} ${req.user.last_name} · ${req.body.rating}/5`, link: '/admin/avis' });
  ok(res, { message: 'Merci pour votre avis !' }, 201);
};
exports.deleteReview = async (req, res) => { await withTransaction(async (c) => { await query('DELETE FROM reviews WHERE product_id=? AND user_id=?', [req.params.id, req.user.id], c); await refreshRating(Number(req.params.id), c); }); ok(res, { message: 'Avis supprimé' }); };
exports.myReviews = async (req, res) => ok(res, { reviews: await query(`SELECT r.id, r.product_id, r.rating, r.title, r.comment, r.status, r.created_at, p.name AS product_name, p.slug,
  (SELECT url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC, id LIMIT 1) AS image FROM reviews r JOIN products p ON p.id=r.product_id WHERE r.user_id=? ORDER BY r.id DESC`, [req.user.id]) });

/* ------------------------------------------------------------------ Retours */
exports.createReturn = async (req, res) => {
  const b = req.body;
  const item = await one(`SELECT oi.*, o.status AS order_status, o.user_id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.id=? AND oi.order_id=? AND o.user_id=?`, [b.orderItemId, b.orderId, req.user.id]);
  if (!item) throw new ApiError(404, 'Article de commande introuvable');
  if (!['delivered', 'completed'].includes(item.order_status)) throw new ApiError(409, 'Un retour ne peut être demandé qu\'après la livraison');
  const delivered = await one('SELECT delivered_at FROM shipments WHERE order_id=?', [b.orderId]);
  const days = Number(await getSetting('store.return_days', '30'));
  if (delivered?.delivered_at && Date.now() - new Date(delivered.delivered_at).getTime() > days * 86400000) throw new ApiError(409, `Le délai de retour de ${days} jours est dépassé`);
  const already = await one("SELECT COALESCE(SUM(quantity),0) AS n FROM returns WHERE order_item_id=? AND status<>'rejected'", [item.id]);
  if (already.n + b.quantity > item.quantity) throw new ApiError(409, `Quantité déjà retournée ou en cours de retour (reste ${item.quantity - already.n})`);
  const rma = randomCode('RMA', 7);
  const r = await query('INSERT INTO returns (rma_number, order_id, order_item_id, user_id, quantity, reason, details) VALUES (?,?,?,?,?,?,?)', [rma, b.orderId, item.id, req.user.id, b.quantity, b.reason, b.details]);
  sendMail({ to: req.user.email, subject: `Demande de retour ${rma}`, title: 'Demande de retour reçue', html: `<p>Votre demande <b>${rma}</b> pour « ${esc(item.name)} » a été enregistrée. Nous reviendrons vers vous rapidement.</p>` });
  notifyStaff(['returns.manage'], { type: 'return_request', title: 'Nouvelle demande de retour', message: `${req.user.first_name} ${req.user.last_name}`, link: '/admin/retours', email: true });
  ok(res, { return: await one('SELECT * FROM returns WHERE id=?', [r.insertId]) }, 201);
};
exports.myReturns = async (req, res) => ok(res, { returns: await query(`SELECT r.*, oi.name AS product_name, o.order_number FROM returns r JOIN order_items oi ON oi.id=r.order_item_id JOIN orders o ON o.id=r.order_id WHERE r.user_id=? ORDER BY r.id DESC`, [req.user.id]) });

/* ------------------------------------------------------------------ Notifications */
exports.notifications = async (req, res) => {
  const rows = await query('SELECT id, type, title, message, link, is_read, created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100', [req.user.id]);
  const unread = (await one('SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND is_read=0', [req.user.id])).n;
  ok(res, { notifications: rows, unread });
};
exports.unreadCount = async (req, res) => ok(res, { unread: (await one('SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND is_read=0', [req.user.id])).n });
exports.readNotification = async (req, res) => { await query('UPDATE notifications SET is_read=1, read_at=NOW() WHERE id=? AND user_id=?', [req.params.id, req.user.id]); ok(res, { ok: true }); };
exports.readAllNotifications = async (req, res) => { await query('UPDATE notifications SET is_read=1, read_at=NOW() WHERE user_id=? AND is_read=0', [req.user.id]); ok(res, { ok: true }); };

/* ------------------------------------------------------------------ Support (suivi des demandes) */
exports.myTickets = async (req, res) => ok(res, { tickets: await query('SELECT id, ticket_number, subject, type, status, created_at, updated_at FROM support_tickets WHERE user_id=? ORDER BY id DESC', [req.user.id]) });
exports.myTicket = async (req, res) => {
  const t = await one('SELECT * FROM support_tickets WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!t) throw new ApiError(404, 'Demande introuvable');
  ok(res, { ticket: t, messages: await query('SELECT id, is_staff, message, created_at FROM support_messages WHERE ticket_id=? ORDER BY id', [t.id]) });
};
exports.replyTicket = async (req, res) => {
  const t = await one('SELECT id, status FROM support_tickets WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!t) throw new ApiError(404, 'Demande introuvable');
  await query('INSERT INTO support_messages (ticket_id, user_id, is_staff, message) VALUES (?,?,0,?)', [t.id, req.user.id, req.body.message]);
  await query("UPDATE support_tickets SET status='open' WHERE id=? AND status IN ('resolved','closed')", [t.id]);
  await notifyStaff(['support.manage'], { type: 'ticket_reply', title: 'Nouvelle réponse client', message: req.body.message.slice(0, 140), link: '/admin/support' });
  ok(res, { ok: true }, 201);
};
