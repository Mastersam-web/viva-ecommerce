const crypto = require('crypto');
const { query, one, withTransaction } = require('../../config/db');
const { env } = require('../../config/env');
const { ApiError } = require('../../utils/http');
const { randomCode, round2, timingSafeEqualHex } = require('../../utils/helpers');
const { notify, notifyStaff } = require('../../utils/notify');
const { getSetting } = require('../settings');
const stripe = require('./stripe');

const paymentConfig = require('../paymentConfig');
const frontend = (path) => `${env.frontendUrl}${path}`;

/** Moyens de paiement réellement utilisables dans la configuration actuelle (réglages admin + environnement). */
const enabledMethods = () => paymentConfig.availableMethods();

const providerFor = (method) => (method === 'card' ? (stripe.enabled() ? 'stripe' : 'sandbox')
  : method === 'mobile_money' ? (env.payment.mode === 'sandbox' ? 'sandbox' : 'mobile_money')
    : 'manual');

/** Crée la ligne de paiement (clé d'idempotence = pas de doublon : règle « paiements dupliqués »). */
async function createPayment(conn, order, method, attempt = 1) {
  const key = `ord-${order.id}-${method}-${attempt}`;
  const res = await query(
    'INSERT INTO payments (order_id, method, provider, status, amount, currency, idempotency_key) VALUES (?,?,?,?,?,?,?)',
    [order.id, method, providerFor(method), 'pending', order.grand_total, order.currency || env.currency, key], conn);
  return one('SELECT * FROM payments WHERE id=?', [res.insertId], conn);
}

const publicPayment = (p) => p && ({ id: p.id, method: p.method, status: p.status, amount: p.amount, currency: p.currency, receipt_number: p.receipt_number });

/** Démarre le paiement. Retourne ce que le frontend doit faire : rien (COD), aller sur la page de paiement, ou rediriger vers le prestataire. */
async function initiate(order, payment) {
  if (payment.method === 'cod') return { type: 'none', message: 'Vous réglerez à la réception de votre commande.' };
  if (payment.provider === 'stripe') {
    const s = await stripe.createCheckoutSession({ order, payment });
    await query('UPDATE payments SET provider_ref=? WHERE id=?', [s.id, payment.id]);
    return { type: 'redirect', url: s.url };
  }
  if (payment.provider === 'sandbox') await query('UPDATE payments SET provider_ref=? WHERE id=?', [`sbx_${crypto.randomBytes(10).toString('hex')}`, payment.id]);
  else await query('UPDATE payments SET provider_ref=COALESCE(provider_ref, ?) WHERE id=?', [order.order_number, payment.id]);
  return { type: 'page', url: `/commande/paiement?order=${order.id}` };
}

/** Marque un paiement comme réglé — idempotent et vérifié (règles 7 et 18). */
async function markPaid({ paymentId, providerRef = null, eventId = null, amount = null, source = 'webhook', userId = null }) {
  const { applyStatus, ensureInvoice } = require('../orders');
  const autoConfirm = (await getSetting('orders.auto_confirm', 'false')) === 'true';
  let orderForNotify = null;
  const result = await withTransaction(async (conn) => {
    if (eventId) {
      const seen = await one('SELECT id FROM payment_transactions WHERE event_id=?', [eventId], conn);
      if (seen) return { already: true };
    }
    const pay = await one('SELECT * FROM payments WHERE id=? FOR UPDATE', [paymentId], conn);
    if (!pay) throw new ApiError(404, 'Paiement introuvable');
    if (pay.status === 'paid') return { already: true };
    if (['refunded', 'partially_refunded'].includes(pay.status)) return { already: true };
    if (amount != null && Math.abs(Number(amount) - Number(pay.amount)) > 0.009) {
      await query('INSERT INTO payment_transactions (payment_id, type, status, amount, provider_ref, event_id, note) VALUES (?,?,?,?,?,?,?)',
        [pay.id, 'webhook', 'rejected', amount, providerRef, eventId, `Montant incohérent (attendu ${pay.amount})`], conn);
      throw new ApiError(422, 'Montant du paiement incohérent');
    }
    const order = await one('SELECT * FROM orders WHERE id=? FOR UPDATE', [pay.order_id], conn);
    if (order.status === 'cancelled') {
      await query('INSERT INTO payment_transactions (payment_id, type, status, amount, provider_ref, event_id, note) VALUES (?,?,?,?,?,?,?)',
        [pay.id, 'webhook', 'late', pay.amount, providerRef, eventId, 'Paiement reçu sur commande annulée : remboursement à effectuer'], conn);
      await query("UPDATE payments SET status='paid', paid_at=NOW(), provider_ref=COALESCE(?, provider_ref), receipt_number=? WHERE id=?", [providerRef, randomCode('RC', 8), pay.id], conn);
      return { lateOnCancelled: true, paymentId: pay.id, amount: pay.amount };
    }
    await query("UPDATE payments SET status='paid', paid_at=NOW(), failure_reason=NULL, provider_ref=COALESCE(?, provider_ref), receipt_number=? WHERE id=?",
      [providerRef, randomCode('RC', 8), pay.id], conn);
    await query('INSERT INTO payment_transactions (payment_id, type, status, amount, provider_ref, event_id, note, user_id) VALUES (?,?,?,?,?,?,?,?)',
      [pay.id, source === 'manual' ? 'manual' : 'webhook', 'paid', pay.amount, providerRef, eventId, source === 'manual' ? 'Confirmé manuellement' : 'Confirmé par le prestataire', userId], conn);
    await query("UPDATE orders SET payment_status='paid' WHERE id=?", [order.id], conn);
    // Seul le back-office attribue les statuts, sauf si l'option « confirmation automatique » est activée.
    if (order.status === 'pending') { if (autoConfirm) await applyStatus(conn, order.id, 'confirmed', { userId, note: 'Paiement confirmé' }); }
    else await ensureInvoice(conn, order);
    orderForNotify = order;
    return { paid: true };
  });
  if (result.lateOnCancelled) {
    try { await refundPayment({ paymentId: result.paymentId, amount: result.amount, reason: 'Paiement reçu après annulation', userId }); } catch (e) { console.error('[late-refund]', e.message); }
  }
  if (orderForNotify) {
    await notify(orderForNotify.user_id, { type: 'payment_confirmed', title: `Paiement confirmé - ${orderForNotify.order_number}`, message: `Nous avons bien reçu votre paiement pour la commande ${orderForNotify.order_number}.${autoConfirm ? '' : ' Notre équipe va maintenant la traiter.'}`, link: `/compte/commandes/${orderForNotify.id}` });
    await notifyStaff(['payments.view', 'payments.manage', 'orders.manage'], { type: 'payment_received', title: `Paiement reçu - ${orderForNotify.order_number}`, message: `Le paiement de ${Number(orderForNotify.grand_total).toFixed(2)} ${orderForNotify.currency} est confirmé.${autoConfirm ? '' : ' La commande est à confirmer.'}`, link: `/admin/commandes/${orderForNotify.id}` });
  }
  return result;
}

async function markFailed({ paymentId, reason = 'Paiement refusé', eventId = null }) {
  let order = null;
  await withTransaction(async (conn) => {
    if (eventId && (await one('SELECT id FROM payment_transactions WHERE event_id=?', [eventId], conn))) return;
    const pay = await one('SELECT * FROM payments WHERE id=? FOR UPDATE', [paymentId], conn);
    if (!pay || pay.status !== 'pending') return;
    await query("UPDATE payments SET status='failed', failure_reason=? WHERE id=?", [reason, pay.id], conn);
    await query('INSERT INTO payment_transactions (payment_id, type, status, amount, event_id, note) VALUES (?,?,?,?,?,?)', [pay.id, 'webhook', 'failed', pay.amount, eventId, reason], conn);
    await query("UPDATE orders SET payment_status='failed' WHERE id=? AND payment_status<>'paid'", [pay.order_id], conn);
    order = await one('SELECT * FROM orders WHERE id=?', [pay.order_id], conn);
  });
  if (order) {
    await notify(order.user_id, { type: 'payment_failed', title: `Paiement non abouti - ${order.order_number}`, message: `${reason}. Vous pouvez réessayer ou choisir un autre moyen de paiement.`, link: `/commande/paiement?order=${order.id}` });
    await notifyStaff(['payments.view', 'payments.manage'], { type: 'payment_failed', title: `Paiement échoué - ${order.order_number}`, message: reason, link: `/admin/commandes/${order.id}` });
  }
}

/** Nouvelle tentative de paiement pour une commande dont le paiement a échoué / été annulé. */
async function retryPayment(orderId, userId, method) {
  const order = await one('SELECT * FROM orders WHERE id=? AND user_id=?', [orderId, userId]);
  if (!order) throw new ApiError(404, 'Commande introuvable');
  if (order.status !== 'pending' || !['failed', 'pending', 'unpaid'].includes(order.payment_status)) throw new ApiError(409, 'Cette commande ne peut plus être payée');
  if (!(await enabledMethods()).some((m) => m.code === method)) throw new ApiError(422, 'Moyen de paiement non disponible');
  const last = await one('SELECT status FROM payments WHERE order_id=? ORDER BY id DESC LIMIT 1', [orderId]);
  if (last && last.status === 'paid') throw new ApiError(409, 'Commande déjà payée');
  const lastFull = await one('SELECT proof_submitted_at FROM payments WHERE order_id=? ORDER BY id DESC LIMIT 1', [orderId]);
  if (last && last.status === 'pending' && lastFull?.proof_submitted_at) throw new ApiError(409, 'Un paiement est en cours de vérification par notre équipe');
  const payment = await withTransaction(async (conn) => {
    await query("UPDATE payments SET status='cancelled' WHERE order_id=? AND status IN ('pending','failed')", [orderId], conn);
    const n = await one('SELECT COUNT(*) AS n FROM payments WHERE order_id=?', [orderId], conn);
    await query("UPDATE orders SET payment_status='pending' WHERE id=?", [orderId], conn);
    return createPayment(conn, order, method, n.n + 1);
  });
  const instructions = await initiate(order, payment);
  return { payment: publicPayment(payment), instructions };
}

/** Remboursement total ou partiel, lié à un paiement existant (règle 12). */
async function refundPayment({ paymentId, amount, reason, userId = null, returnId = null }) {
  const { pay, refundId } = await withTransaction(async (conn) => {
    const p = await one('SELECT * FROM payments WHERE id=? FOR UPDATE', [paymentId], conn);
    if (!p) throw new ApiError(404, 'Paiement introuvable');
    if (!['paid', 'partially_refunded'].includes(p.status)) throw new ApiError(409, "Ce paiement n'a pas été encaissé");
    const refundable = round2(Number(p.amount) - Number(p.refunded_amount));
    const amt = round2(amount ?? refundable);
    if (amt <= 0 || amt > refundable + 0.001) throw new ApiError(422, `Montant invalide (remboursable : ${refundable.toFixed(2)})`);
    const r = await query('INSERT INTO refunds (order_id, payment_id, return_id, amount, reason, status, created_by) VALUES (?,?,?,?,?,?,?)',
      [p.order_id, p.id, returnId, amt, reason || null, 'pending', userId], conn);
    return { pay: { ...p, refundAmount: amt }, refundId: r.insertId };
  });
  // Appel prestataire hors transaction
  let providerRef = null; let status = 'completed'; let note = reason || 'Remboursement';
  if (pay.provider === 'stripe' && pay.provider_ref?.startsWith('pi_')) {
    try { providerRef = (await stripe.refund({ paymentIntent: pay.provider_ref, amount: pay.refundAmount, currency: pay.currency })).id; }
    catch (e) { status = 'failed'; note = `Échec prestataire : ${e.message}`; }
  } else if (pay.method !== 'cod' && pay.method !== 'bank_transfer' && pay.provider !== 'sandbox') {
    note += ' (remboursement manuel à effectuer chez le prestataire)';
  }
  await withTransaction(async (conn) => {
    await query('UPDATE refunds SET status=? WHERE id=?', [status, refundId], conn);
    await query('INSERT INTO payment_transactions (payment_id, type, status, amount, provider_ref, note, user_id) VALUES (?,?,?,?,?,?,?)',
      [pay.id, 'refund', status, pay.refundAmount, providerRef, note.slice(0, 255), userId], conn);
    if (status === 'completed') {
      const total = round2(Number(pay.refunded_amount) + pay.refundAmount);
      const full = total >= Number(pay.amount) - 0.001;
      await query('UPDATE payments SET refunded_amount=?, status=? WHERE id=?', [total, full ? 'refunded' : 'partially_refunded', pay.id], conn);
      await query('UPDATE orders SET payment_status=? WHERE id=?', [full ? 'refunded' : 'partially_refunded', pay.order_id], conn);
    }
  });
  if (status === 'failed') throw new ApiError(502, note);
  const order = await one('SELECT id, user_id, order_number FROM orders WHERE id=?', [pay.order_id]);
  await notify(order.user_id, { type: 'refund', title: `Remboursement - ${order.order_number}`, message: `Un remboursement de ${pay.refundAmount.toFixed(2)} ${pay.currency} a été enregistré.`, link: `/compte/commandes/${order.id}` });
  return { refundId, amount: pay.refundAmount };
}

/** Webhook Stripe (signature vérifiée). */
async function handleStripeWebhook(raw, signature) {
  const event = stripe.verifyWebhook(raw, signature);
  const obj = event.data.object;
  const paymentId = Number(obj.metadata?.payment_id);
  if (!paymentId) return { ignored: true };
  if (event.type === 'checkout.session.completed' && obj.payment_status === 'paid') {
    const pay = await one('SELECT currency FROM payments WHERE id=?', [paymentId]);
    if (!pay) return { ignored: true };
    return markPaid({ paymentId, providerRef: obj.payment_intent || obj.id, eventId: `stripe:${event.id}`, amount: stripe.fromMinor(obj.amount_total, pay.currency) });
  }
  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    return markFailed({ paymentId, reason: 'Session de paiement expirée ou refusée', eventId: `stripe:${event.id}` });
  }
  return { ignored: true };
}

/** Webhook Mobile Money générique : corps JSON signé HMAC-SHA256 (en-tête x-signature). */
async function handleMobileMoneyWebhook(raw, signature) {
  const secret = env.payment.webhookSecret;
  if (!secret) throw new ApiError(503, 'Webhook non configuré');
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (!signature || !timingSafeEqualHex(expected, String(signature).replace(/^sha256=/, ''))) throw new ApiError(401, 'Signature invalide');
  let body; try { body = JSON.parse(raw.toString('utf8')); } catch { throw new ApiError(400, 'JSON invalide'); }
  const { event_id: eventId, reference, status, amount, transaction_id: txId } = body;
  if (!eventId || !reference) throw new ApiError(400, 'Champs manquants');
  // la référence peut être le numéro de commande (avant confirmation) ou l'identifiant de transaction (rejeu après confirmation)
  const pay = await one("SELECT p.id FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.method='mobile_money' AND (p.provider_ref=? OR o.order_number=?) ORDER BY p.id DESC LIMIT 1", [reference, reference]);
  if (!pay) throw new ApiError(404, 'Paiement introuvable');
  if (status === 'success' || status === 'paid') return markPaid({ paymentId: pay.id, providerRef: txId || reference, eventId: `mm:${eventId}`, amount });
  return markFailed({ paymentId: pay.id, reason: body.message || 'Paiement refusé', eventId: `mm:${eventId}` });
}

/* ------------------------------------------------------------------ Parcours de paiement côté client */
async function loadOwned(orderId, userId) {
  const order = await one('SELECT * FROM orders WHERE id=? AND user_id=?', [orderId, userId]);
  if (!order) throw new ApiError(404, 'Commande introuvable');
  const payment = await one('SELECT * FROM payments WHERE order_id=? ORDER BY id DESC LIMIT 1', [orderId]);
  if (!payment) throw new ApiError(404, 'Paiement introuvable');
  return { order, payment };
}
function assertPayable(order, payment) {
  if (order.status !== 'pending') throw new ApiError(409, 'Cette commande ne peut plus être payée');
  if (payment.status === 'paid') throw new ApiError(409, 'Cette commande est déjà payée');
  if (!['pending', 'failed'].includes(payment.status)) throw new ApiError(409, "Ce paiement n'est plus modifiable");
}

/** Données de la page de paiement (jamais de secret : uniquement les consignes destinées au client). */
async function getPaymentContext(orderId, userId) {
  const { order, payment } = await loadOwned(orderId, userId);
  const cfg = await paymentConfig.getConfig();
  const m = payment.method;
  const out = {
    order: { id: order.id, order_number: order.order_number, status: order.status, grand_total: order.grand_total, currency: order.currency },
    payment: { id: payment.id, method: m, provider: payment.provider, status: payment.status, amount: payment.amount, currency: payment.currency, operator: payment.operator, payer_phone: payment.payer_phone, payer_reference: payment.payer_reference, proof_submitted_at: payment.proof_submitted_at, failure_reason: payment.failure_reason, receipt_number: payment.receipt_number },
    method: { code: m, label: cfg[m].label, description: cfg[m].description },
    sandbox: env.payment.mode === 'sandbox',
    payable: order.status === 'pending' && ['pending', 'failed'].includes(payment.status),
    otherMethods: await enabledMethods(),
  };
  if (m === 'mobile_money') out.operators = paymentConfig.usableOperators(cfg).map((o) => ({ code: o.code, name: o.name, number: o.number, account_name: o.account_name, instructions: o.instructions }));
  if (m === 'bank_transfer') out.bank = { details: cfg.bank_transfer.details, reference: order.order_number };
  return out;
}

/** Carte — mode test uniquement. Le serveur ne reçoit JAMAIS le numéro de carte : seulement le scénario de test et les 4 derniers chiffres. */
const CARD_DECLINES = { declined: 'Carte refusée par la banque', insufficient: 'Fonds insuffisants', expired: 'Carte expirée' };
async function payCardSandbox(orderId, userId, { scenario, last4 = '' }) {
  const { order, payment } = await loadOwned(orderId, userId);
  if (env.payment.mode !== 'sandbox' || payment.provider !== 'sandbox' || payment.method !== 'card') throw new ApiError(404, 'Introuvable');
  assertPayable(order, payment);
  const eventId = `sbx-card:${payment.id}:${crypto.randomBytes(6).toString('hex')}`;
  if (scenario === 'success') {
    await markPaid({ paymentId: payment.id, providerRef: `sbx_card_${String(last4).slice(-4)}`, eventId, amount: payment.amount });
    return { status: 'paid' };
  }
  await query("UPDATE payments SET status='pending' WHERE id=? AND status='failed'", [payment.id]);
  await markFailed({ paymentId: payment.id, reason: CARD_DECLINES[scenario] || CARD_DECLINES.declined, eventId });
  return { status: 'failed', reason: CARD_DECLINES[scenario] || CARD_DECLINES.declined };
}

/** Carte réelle (Stripe) : nouvelle session de paiement hébergée par Stripe. */
async function startStripe(orderId, userId) {
  const { order, payment } = await loadOwned(orderId, userId);
  if (payment.provider !== 'stripe') throw new ApiError(409, 'Paiement par carte non configuré');
  assertPayable(order, payment);
  const s = await stripe.createCheckoutSession({ order, payment });
  await query("UPDATE payments SET provider_ref=?, status='pending', failure_reason=NULL WHERE id=?", [s.id, payment.id]);
  return { url: s.url };
}

/** Mobile Money : le client choisit son opérateur et indique son numéro. */
async function mobileInit(orderId, userId, { operator, phone }) {
  const { order, payment } = await loadOwned(orderId, userId);
  if (payment.method !== 'mobile_money') throw new ApiError(409, 'Cette commande ne se règle pas par Mobile Money');
  assertPayable(order, payment);
  if (payment.proof_submitted_at) throw new ApiError(409, 'Un paiement est déjà en cours de vérification');
  const cfg = await paymentConfig.getConfig();
  const op = paymentConfig.usableOperators(cfg).find((o) => o.code === operator);
  if (!op) throw new ApiError(422, 'Opérateur non disponible');
  await query('UPDATE payments SET operator=?, payer_phone=? WHERE id=?', [op.code, phone, payment.id]);
  await query('INSERT INTO payment_transactions (payment_id, type, status, amount, note, user_id) VALUES (?,?,?,?,?,?)', [payment.id, 'charge', 'initiated', payment.amount, `${op.name} · ${phone}`.slice(0, 255), userId]);
  return { mode: payment.provider === 'sandbox' ? 'sandbox' : 'manual', operator: { code: op.code, name: op.name, number: op.number, account_name: op.account_name, instructions: op.instructions } };
}

/** Mobile Money — mode test : simule la validation sur le téléphone du client. */
async function mobileSandbox(orderId, userId, { outcome }) {
  const { order, payment } = await loadOwned(orderId, userId);
  if (env.payment.mode !== 'sandbox' || payment.provider !== 'sandbox' || payment.method !== 'mobile_money') throw new ApiError(404, 'Introuvable');
  assertPayable(order, payment);
  if (!payment.operator) throw new ApiError(409, 'Choisissez d\'abord un opérateur');
  const eventId = `sbx-mm:${payment.id}:${crypto.randomBytes(6).toString('hex')}`;
  if (outcome === 'success') { await markPaid({ paymentId: payment.id, providerRef: `sbx_mm_${crypto.randomBytes(4).toString('hex')}`, eventId, amount: payment.amount }); return { status: 'paid' }; }
  await query("UPDATE payments SET status='pending' WHERE id=? AND status='failed'", [payment.id]);
  await markFailed({ paymentId: payment.id, reason: 'Paiement refusé ou expiré sur le téléphone', eventId });
  return { status: 'failed' };
}

/** Preuve de paiement (Mobile Money manuel ou virement) : le client indique sa référence de transaction ; l'équipe vérifie. */
async function submitProof(orderId, userId, { reference, phone, operator, note }) {
  const { order, payment } = await loadOwned(orderId, userId);
  if (!['mobile_money', 'bank_transfer'].includes(payment.method)) throw new ApiError(409, 'Ce moyen de paiement ne nécessite pas de justificatif');
  assertPayable(order, payment);
  let op = payment.operator;
  if (payment.method === 'mobile_money') {
    const cfg = await paymentConfig.getConfig();
    const found = paymentConfig.usableOperators(cfg).find((o) => o.code === (operator || payment.operator));
    if (!found) throw new ApiError(422, 'Choisissez votre opérateur');
    op = found.code;
  }
  await withTransaction(async (conn) => {
    await query("UPDATE payments SET payer_reference=?, payer_phone=COALESCE(?, payer_phone), operator=?, proof_submitted_at=NOW(), status='pending', failure_reason=NULL WHERE id=?", [reference, phone || null, op, payment.id], conn);
    await query("UPDATE orders SET payment_status='pending' WHERE id=?", [order.id], conn);
    await query('INSERT INTO payment_transactions (payment_id, type, status, amount, provider_ref, note, user_id) VALUES (?,?,?,?,?,?,?)', [payment.id, 'manual', 'proof', payment.amount, reference, (note || 'Justificatif de paiement envoyé par le client').slice(0, 255), userId], conn);
  });
  await notify(userId, { type: 'payment_pending', title: `Paiement en cours de vérification - ${order.order_number}`, message: 'Nous avons bien reçu votre référence de paiement. Notre équipe la vérifie et vous préviendra dès validation.', link: `/compte/commandes/${order.id}`, email: false });
  await notifyStaff(['payments.view', 'payments.manage'], { type: 'payment_proof', title: `Paiement à vérifier - ${order.order_number}`, message: `${Number(payment.amount).toFixed(2)} ${payment.currency} via ${payment.method === 'bank_transfer' ? 'virement' : 'Mobile Money'} · Référence : ${reference}`, link: `/admin/commandes/${order.id}`, email: true });
  return { status: 'pending', proof: true };
}

/** Refus d'un justificatif par l'équipe (montant erroné, référence introuvable…) : le client peut réessayer. */
async function rejectPayment({ paymentId, reason, userId }) {
  const pay = await one('SELECT * FROM payments WHERE id=?', [paymentId]);
  if (!pay) throw new ApiError(404, 'Paiement introuvable');
  if (pay.status !== 'pending') throw new ApiError(409, 'Seul un paiement en attente peut être refusé');
  await query('UPDATE payments SET proof_submitted_at=NULL WHERE id=?', [pay.id]);
  await query('INSERT INTO payment_transactions (payment_id, type, status, amount, note, user_id) VALUES (?,?,?,?,?,?)', [pay.id, 'manual', 'rejected', pay.amount, (reason || 'Justificatif refusé').slice(0, 255), userId]);
  await markFailed({ paymentId: pay.id, reason: reason || 'Justificatif de paiement non validé' });
  return { ok: true };
}

module.exports = { enabledMethods, createPayment, publicPayment, initiate, markPaid, markFailed, retryPayment, refundPayment, handleStripeWebhook, handleMobileMoneyWebhook, getPaymentContext, payCardSandbox, startStripe, mobileInit, mobileSandbox, submitProof, rejectPayment };
