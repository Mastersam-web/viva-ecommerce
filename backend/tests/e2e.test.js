/* Test de bout en bout : nécessite MySQL migré + seedé (npm run db:setup). Lancer : npm test */
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { env, assertSecure } = require('../src/config/env');
assertSecure();
const app = require('../src/app');
const { pool } = require('../src/config/db');

let base; let server;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); base = `http://127.0.0.1:${server.address().port}/api`; });
test.after(async () => { server.close(); await pool.end(); });

class Client {
  constructor() { this.cookie = ''; }
  async req(method, path, body, headers = {}) {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', Cookie: this.cookie, ...headers }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
  get(p) { return this.req('GET', p); } post(p, b) { return this.req('POST', p, b ?? {}); } put(p, b) { return this.req('PUT', p, b); } patch(p, b) { return this.req('PATCH', p, b ?? {}); } del(p) { return this.req('DELETE', p); }
}
const uniq = `t${Date.now()}`;
const address = { full_name: 'Test Client', phone: '+33123456789', line1: '1 rue de Test', city: 'Paris', postal_code: '75001', country: 'FR' };
const admin = new Client(); const cust = new Client(); const courier = new Client(); const anon = new Client();
let productA; let order1; let order2; let shipmentId;

test('catalogue public : produits, filtres, tri, pagination, fiche', async () => {
  const all = await anon.get('/products?limit=60');
  assert.equal(all.status, 200); assert.equal(all.data.meta.total, 30);
  const cat = await anon.get('/products?category=electronics&sort=price_asc');
  assert.equal(cat.data.products.length, 5);
  assert.ok(cat.data.products[0].price <= cat.data.products[1].price);
  assert.equal((await anon.get('/products?q=casque')).data.products[0].name, 'Casque Réducteur de Bruit');
  assert.ok((await anon.get('/products?minPrice=100&maxPrice=150')).data.products.every((p) => p.price >= 100 && p.price <= 150));
  const p = cat.data.products[0]; productA = (await anon.get(`/products?q=casque`)).data.products[0];
  const detail = await anon.get(`/products/${productA.slug}`);
  assert.equal(detail.status, 200); assert.ok(detail.data.related.length > 0); assert.equal(typeof detail.data.product.stock, 'number');
  assert.equal((await anon.get('/products/n-existe-pas')).status, 404);
  assert.ok(p.badge);
});

test('sécurité : accès protégés, CSRF, validation, injection SQL', async () => {
  assert.equal((await anon.get('/orders')).status, 401);
  assert.equal((await anon.get('/admin/dashboard')).status, 401);
  assert.equal((await anon.post('/auth/register', { email: 'bad' })).status, 422);
  assert.equal((await anon.get("/products?q=' OR 1=1 --")).status, 200);
  assert.equal((await anon.get("/products?category=x'; DROP TABLE users;--")).status, 200);
  const r = await fetch(`${base}/newsletter`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'viva_token=zzz' }, body: '{"email":"a@b.co"}' });
  assert.equal(r.status, 403); // cookie présent sans en-tête CSRF
});

test('inscription, connexion, mauvais mot de passe, profil', async () => {
  const reg = await cust.post('/auth/register', { first_name: 'Test', last_name: 'Client', email: `${uniq}@example.com`, password: 'Passw0rdTest' });
  assert.equal(reg.status, 201); assert.equal(reg.data.user.isStaff, false);
  assert.equal((await cust.get('/auth/me')).data.user.email, `${uniq}@example.com`);
  assert.equal((await anon.post('/auth/register', { first_name: 'T', last_name: 'C', email: `${uniq}@example.com`, password: 'Passw0rdTest' })).status, 409);
  assert.equal((await anon.post('/auth/login', { email: `${uniq}@example.com`, password: 'wrong' })).status, 401);
  assert.equal((await cust.put('/account/profile', { first_name: 'Nouveau', last_name: 'Nom', phone: '+33612345678' })).data.user.first_name, 'Nouveau');
  assert.equal((await cust.get('/admin/dashboard')).status, 403); // un client n'accède pas à l'admin
});

test('connexion admin et comptes du personnel', async () => {
  assert.equal((await admin.post('/auth/login', { email: env.admin.email, password: env.admin.password })).status, 200);
  assert.equal((await courier.post('/auth/login', { email: 'livreur@demo.com', password: 'Demo!2026pass' })).status, 200);
});

test('panier : devis serveur (prix, stock, promo, livraison)', async () => {
  // le panier exige un compte : un visiteur est refusé
  assert.equal((await anon.post('/cart/quote', { items: [{ productId: productA.id, quantity: 1 }] })).status, 401);
  const q = await cust.post('/cart/quote', { items: [{ productId: productA.id, quantity: 2 }], couponCode: 'WELCOME10', country: 'FR' });
  assert.equal(q.status, 200);
  assert.equal(q.data.subtotal, Math.round(productA.price * 2 * 100) / 100);
  assert.ok(q.data.discount > 0); assert.equal(q.data.shipping, 0); // > 49 $ : livraison gratuite
  assert.equal((await cust.post('/cart/quote', { items: [{ productId: productA.id, quantity: 1 }], couponCode: 'NOPE' })).data.couponError, 'Code promotionnel invalide');
  const big = await cust.post('/cart/quote', { items: [{ productId: productA.id, quantity: 999 }] });
  assert.ok(big.data.issues.length > 0); // stock insuffisant détecté
});

test('commande à la livraison : prix recalculés côté serveur, stock décrémenté, facture à la confirmation', async () => {
  const before = (await anon.get(`/products/${productA.slug}`)).data.product.stock;
  const methods = (await anon.get('/shipping/methods?country=FR&subtotal=0')).data.methods;
  const std = methods.find((m) => m.code === 'standard');
  const res = await cust.post('/orders', { items: [{ productId: productA.id, quantity: 2, price: 0.01 }], address, shippingMethodId: std.id, paymentMethod: 'cod', couponCode: 'WELCOME10', idempotencyKey: `k-${uniq}` });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  order1 = res.data.order;
  const expectedSub = Math.round(productA.price * 2 * 100) / 100;
  const detail = (await cust.get(`/orders/${order1.id}`)).data.order;
  assert.equal(detail.subtotal, expectedSub); // le prix envoyé par le client (0.01) est ignoré
  assert.equal(detail.discount_total, Math.round(expectedSub * 10) / 100);
  assert.equal((await anon.get(`/products/${productA.slug}`)).data.product.stock, before - 2);
  assert.equal((await cust.post('/orders', { items: [{ productId: productA.id, quantity: 2 }], address, shippingMethodId: std.id, paymentMethod: 'cod', couponCode: 'WELCOME10', idempotencyKey: `k-${uniq}` })).data.duplicate, true); // idempotence
  assert.equal((await cust.post('/orders', { items: [{ productId: productA.id, quantity: 1 }], address, shippingMethodId: std.id, paymentMethod: 'cod', couponCode: 'WELCOME10' })).status, 422); // per_user_limit
  assert.equal((await cust.get('/cart/quote')).status, 404);
  assert.equal(detail.shipment.status, 'pending');
});

test('règle 9 : un client ne voit pas les commandes des autres', async () => {
  const other = new Client();
  await other.post('/auth/register', { first_name: 'Autre', last_name: 'Client', email: `o${uniq}@example.com`, password: 'Passw0rdTest' });
  assert.equal((await other.get(`/orders/${order1.id}`)).status, 404);
  assert.equal((await other.get('/orders')).data.orders.length, 0);
});

test('cycle de vie admin → livreur → livré, paiement COD encaissé, facture', async () => {
  const st = async (status) => admin.patch(`/admin/orders/${order1.id}/status`, { status });
  assert.equal((await st('shipped')).status, 409); // transition interdite
  assert.equal((await st('confirmed')).status, 200);
  assert.equal((await st('preparing')).status, 200);
  assert.equal((await st('shipped')).status, 200);
  const list = (await admin.get(`/admin/shipments?q=${order1.orderNumber}`)).data.shipments;
  shipmentId = list[0].id;
  const couriers = (await admin.get('/admin/couriers')).data.couriers;
  assert.equal((await admin.patch(`/admin/shipments/${shipmentId}/courier`, { courier_id: couriers[0].id })).status, 200);
  assert.equal((await cust.patch(`/admin/shipments/${shipmentId}/status`, { status: 'delivered' })).status, 403);
  const mine = (await courier.get('/admin/shipments')).data.shipments;
  assert.equal(mine.length, 1);
  assert.equal((await courier.patch(`/admin/shipments/${shipmentId}/status`, { status: 'out_for_delivery' })).status, 200);
  assert.equal((await courier.patch(`/admin/shipments/${shipmentId}/status`, { status: 'delivered' })).status, 200);
  const d = (await cust.get(`/orders/${order1.id}`)).data.order;
  assert.equal(d.status, 'delivered'); assert.equal(d.payment_status, 'paid');
  assert.ok(d.invoice.invoice_number); assert.ok(d.tracking.length >= 4);
  const pdf = await cust.get(`/orders/${order1.id}/invoice.pdf`);
  assert.equal(pdf.status, 200); assert.equal(pdf.data.slice(0, 4).toString(), '%PDF');
  assert.ok((await cust.get('/notifications')).data.notifications.length > 0);
});

test('avis (achat vérifié) et mise à jour de la note moyenne', async () => {
  assert.equal((await anon.post(`/products/${productA.id}/reviews`, { rating: 5 })).status, 401);
  const other = (await anon.get('/products?q=montre')).data.products[0];
  assert.equal((await cust.post(`/products/${other.id}/reviews`, { rating: 4 })).status, 403); // pas acheté
  assert.equal((await cust.post(`/products/${productA.id}/reviews`, { rating: 3, title: 'Bien', comment: 'OK' })).status, 201);
  assert.equal((await anon.get(`/products/${productA.id}/reviews`)).data.reviews.length, 1);
  const rid = (await admin.get('/admin/reviews')).data.reviews[0].id;
  assert.equal((await admin.patch(`/admin/reviews/${rid}`, { status: 'hidden' })).status, 200);
  assert.equal((await anon.get(`/products/${productA.id}/reviews`)).data.reviews.length, 0);
});

test('retour → approbation → réception (remise en stock) → remboursement', async () => {
  const d = (await cust.get(`/orders/${order1.id}`)).data.order;
  const item = d.items[0];
  const r = await cust.post('/returns', { orderId: order1.id, orderItemId: item.id, quantity: 1, reason: 'Ne convient pas' });
  assert.equal(r.status, 201);
  assert.equal((await cust.post('/returns', { orderId: order1.id, orderItemId: item.id, quantity: 2, reason: 'x' })).status, 409); // > quantité restante
  const rid = r.data.return.id;
  assert.equal((await admin.patch(`/admin/returns/${rid}`, { status: 'refunded' })).status, 409); // flux respecté
  assert.equal((await admin.patch(`/admin/returns/${rid}`, { status: 'approved' })).status, 200);
  const stockBefore = (await anon.get(`/products/${productA.slug}`)).data.product.stock;
  assert.equal((await admin.patch(`/admin/returns/${rid}`, { status: 'received', restock: 1 })).status, 200);
  assert.equal((await anon.get(`/products/${productA.slug}`)).data.product.stock, stockBefore + 1);
  const rf = await admin.patch(`/admin/returns/${rid}`, { status: 'refunded' });
  assert.equal(rf.status, 200, JSON.stringify(rf.data));
  const after = (await cust.get(`/orders/${order1.id}`)).data.order;
  assert.equal(after.payment_status, 'partially_refunded');
  assert.equal((await admin.post('/admin/refunds', { paymentId: after.payments[0].id, amount: 99999 })).status, 422);
});

test('paiement carte (sandbox) : refus puis succès, confirmation par l\'admin uniquement, annulation = demande + remise en stock', async () => {
  const std = (await anon.get('/shipping/methods?country=FR&subtotal=0')).data.methods[0];
  const prod = (await anon.get('/products?q=lampe')).data.products[0];
  const before = (await anon.get(`/products/${prod.slug}`)).data.product.stock;
  const res = await cust.post('/orders', { items: [{ productId: prod.id, quantity: 1 }], address, shippingMethodId: std.id, paymentMethod: 'card' });
  assert.equal(res.status, 201, JSON.stringify(res.data)); order2 = res.data.order;
  assert.equal(res.data.instructions.type, 'page');
  const ctx = (await cust.get(`/orders/${order2.id}/payment`)).data;
  assert.equal(ctx.payment.method, 'card'); assert.equal(ctx.payable, true); assert.equal(ctx.sandbox, true);
  assert.equal((await anon.get(`/orders/${order2.id}/payment`)).status, 401);
  assert.equal((await cust.post(`/orders/${order2.id}/payment/card`, { scenario: 'declined', last4: '0002' })).data.status, 'failed');
  assert.equal((await cust.get(`/orders/${order2.id}`)).data.order.payment_status, 'failed');
  assert.equal((await cust.post(`/orders/${order2.id}/payment/card`, { scenario: 'success', last4: '4242' })).data.status, 'paid');
  assert.equal((await cust.post(`/orders/${order2.id}/payment/card`, { scenario: 'success', last4: '4242' })).status, 409); // déjà payé
  const d = (await cust.get(`/orders/${order2.id}`)).data.order;
  // paiement reçu mais le statut reste « en attente » : seul l'administrateur attribue les statuts
  assert.equal(d.payment_status, 'paid'); assert.equal(d.status, 'pending');
  assert.equal(d.payments.filter((p) => p.status === 'paid').length, 1);
  assert.equal((await cust.patch(`/admin/orders/${order2.id}/status`, { status: 'confirmed' })).status, 403);
  assert.equal((await cust.post(`/orders/${order2.id}/cancel`, { reason: 'x' })).status, 404); // plus d'annulation directe par le client
  assert.equal((await cust.post(`/orders/${order2.id}/cancel-request`, { reason: 'Changement d\'avis' })).status, 201);
  assert.equal((await cust.post(`/orders/${order2.id}/cancel-request`, {})).status, 409); // demande déjà en cours
  assert.equal((await admin.patch(`/admin/orders/${order2.id}/status`, { status: 'confirmed' })).status, 200);
  assert.equal((await admin.patch(`/admin/orders/${order2.id}/status`, { status: 'cancelled', note: 'Demande du client' })).status, 200);
  const c = (await cust.get(`/orders/${order2.id}`)).data.order;
  assert.equal(c.status, 'cancelled'); assert.equal(c.payment_status, 'refunded'); // remboursement automatique
  assert.equal((await anon.get(`/products/${prod.slug}`)).data.product.stock, before);
});

test('Mobile Money et virement : justificatif client → vérification / refus par l\'administrateur', async () => {
  const std = (await anon.get('/shipping/methods?country=FR&subtotal=0')).data.methods[0];
  const prods = (await anon.get('/products?limit=10')).data.products;
  // configuration des moyens de paiement par l'admin
  const cfg = (await admin.get('/admin/payment-config')).data.config;
  assert.ok(cfg.mobile_money.operators.length >= 1);
  assert.equal((await cust.get('/admin/payment-config')).status, 403);
  const saved = await admin.put('/admin/payment-config', { bank_transfer: { details: 'IBAN FR76 0000 0000 0000 | BIC TESTFRPP' }, mobile_money: { operators: [{ code: 'lumicash', name: 'Lumicash', number: '+257 79 000 000', account_name: 'VIVA', instructions: 'Composez *163#' }] } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const methods = (await anon.get('/settings')).data.paymentMethods.map((m) => m.code);
  assert.deepEqual(methods.sort(), ['bank_transfer', 'card', 'cod', 'mobile_money']);
  // Mobile Money
  const o = (await cust.post('/orders', { items: [{ productId: prods[3].id, quantity: 1 }], address, shippingMethodId: std.id, paymentMethod: 'mobile_money' })).data.order;
  const ctx = (await cust.get(`/orders/${o.id}/payment`)).data;
  assert.equal(ctx.operators[0].number, '+257 79 000 000'); assert.equal(ctx.operators[0].code, 'lumicash');
  assert.equal((await cust.post(`/orders/${o.id}/payment/mobile`, { operator: 'inconnu', phone: '+25779111222' })).status, 422);
  assert.equal((await cust.post(`/orders/${o.id}/payment/mobile`, { operator: 'lumicash', phone: '+25779111222' })).status, 200);
  assert.equal((await cust.post(`/orders/${o.id}/payment/proof`, { reference: 'MP240101.1234.A56789', phone: '+25779111222' })).status, 201);
  assert.equal((await cust.post(`/orders/${o.id}/pay`, { paymentMethod: 'card' })).status, 409); // en cours de vérification
  const pending = (await admin.get('/admin/payments?proof=1')).data.payments.find((p) => p.order_id === o.id);
  assert.ok(pending && pending.payer_reference === 'MP240101.1234.A56789');
  assert.equal((await admin.post(`/admin/payments/${pending.id}/reject`, { reason: 'Référence introuvable' })).status, 200);
  assert.equal((await cust.get(`/orders/${o.id}`)).data.order.payment_status, 'failed');
  // virement : le client réessaie avec un autre moyen puis l'admin valide
  assert.equal((await cust.post(`/orders/${o.id}/pay`, { paymentMethod: 'bank_transfer' })).status, 200);
  assert.equal((await cust.post(`/orders/${o.id}/payment/proof`, { reference: 'VIR-2026-0001' })).status, 201);
  const p2 = (await admin.get('/admin/payments?proof=1')).data.payments.find((p) => p.order_id === o.id);
  assert.equal((await admin.post(`/admin/payments/${p2.id}/confirm`, {})).status, 200);
  const after = (await cust.get(`/orders/${o.id}`)).data.order;
  assert.equal(after.payment_status, 'paid'); assert.equal(after.status, 'pending');
  assert.equal((await admin.patch(`/admin/orders/${o.id}/status`, { status: 'confirmed' })).status, 200);
  assert.equal((await admin.patch(`/admin/orders/${o.id}/status`, { status: 'cancelled', note: 'test' })).status, 200);
});

test('notifications : admin (inscription, commande, paiement, contact, newsletter) et client (statuts)', async () => {
  const notifs = async (c) => (await c.get('/notifications')).data;
  const adminN = await notifs(admin);
  const types = new Set(adminN.notifications.map((n) => n.type));
  for (const t of ['new_customer', 'new_order', 'payment_received', 'payment_proof', 'cancel_request']) assert.ok(types.has(t), `notification admin manquante : ${t}`);
  // contact + newsletter
  const before = (await notifs(admin)).unread;
  assert.equal((await anon.post('/support/tickets', { name: 'Visiteur', email: 'visiteur@example.com', subject: 'Question produit', message: 'Bonjour, avez-vous ce produit en stock ?', type: 'contact' })).status, 201);
  assert.equal((await anon.post('/newsletter', { email: `nl${uniq}@example.com` })).status, 201);
  const after = await notifs(admin);
  assert.equal(after.unread, before + 2);
  assert.ok(after.notifications.some((n) => n.type === 'contact_message' && n.message.includes('Question produit')));
  assert.ok(after.notifications.some((n) => n.type === 'newsletter_subscriber' && n.message === `nl${uniq}@example.com`));
  assert.equal((await anon.post('/newsletter', { email: `nl${uniq}@example.com` })).status, 201); // doublon : pas de nouvelle notification
  assert.equal((await notifs(admin)).unread, after.unread);
  // le client reçoit les changements de statut décidés par l'admin
  const custN = await notifs(cust);
  assert.ok(custN.notifications.some((n) => n.type === 'order_cancelled' || /annul/i.test(n.title)));
  assert.equal((await cust.get('/notifications/unread-count')).data.unread, custN.unread);
  assert.equal((await admin.post('/notifications/read-all')).status, 200);
  assert.equal((await notifs(admin)).unread, 0);
  // newsletter : envoi par l'admin + désinscription par lien signé
  assert.equal((await cust.post('/admin/newsletter/send', { subject: 'Test', content: 'Contenu de la newsletter' })).status, 403);
  assert.equal((await admin.post('/admin/newsletter/send', { subject: 'Nos nouveautés', content: 'Découvrez nos nouveaux produits cette semaine.' })).status, 202);
  const { unsubscribeUrl } = require('../src/controllers/catalog');
  const u = new URL(unsubscribeUrl(`nl${uniq}@example.com`));
  assert.equal((await anon.get(`/newsletter/unsubscribe?email=${encodeURIComponent(`nl${uniq}@example.com`)}&sig=bad`)).status, 400);
  assert.equal((await anon.get(`/newsletter/unsubscribe${u.search}`)).status, 200);
});

test('webhook Mobile Money : signature HMAC obligatoire, montant vérifié', async () => {
  const crypto = require('crypto');
  const std = (await anon.get('/shipping/methods?country=FR&subtotal=0')).data.methods[0];
  const prod = (await anon.get('/products?q=puzzle')).data.products[0];
  const res = await cust.post('/orders', { items: [{ productId: prod.id, quantity: 1 }], address, shippingMethodId: std.id, paymentMethod: 'mobile_money' });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  const { rows } = await pool.query("SELECT provider_ref, amount FROM payments WHERE order_id=?", [res.data.order.id]).then(([r]) => ({ rows: r }));
  // en mode sandbox le provider est « sandbox » : on teste donc la vérification de signature sur un paiement mobile_money « live »
  await pool.query("UPDATE payments SET provider='mobile_money', provider_ref=? WHERE order_id=?", [res.data.order.orderNumber, res.data.order.id]);
  const body = JSON.stringify({ event_id: `e-${uniq}`, reference: res.data.order.orderNumber, status: 'success', amount: Number(rows[0].amount), transaction_id: 'TX1' });
  const post = (sig, b = body) => fetch(`${base}/payments/webhook/mobile-money`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-signature': sig }, body: b });
  assert.equal((await post('deadbeef')).status, 401);
  const good = crypto.createHmac('sha256', env.payment.webhookSecret).update(body).digest('hex');
  const bad = JSON.stringify({ ...JSON.parse(body), event_id: `e2-${uniq}`, amount: 0.01 });
  assert.equal((await post(crypto.createHmac('sha256', env.payment.webhookSecret).update(bad).digest('hex'), bad)).status, 422); // montant incohérent
  assert.equal((await post(good)).status, 200);
  assert.equal((await post(good)).status, 200); // rejeu ignoré
  assert.equal((await cust.get(`/orders/${res.data.order.id}`)).data.order.payment_status, 'paid');
});

test('admin : produits (CRUD), stock, fournisseurs, approvisionnement, coupons, rapports', async () => {
  const cats = (await admin.get('/admin/categories')).data.categories;
  const created = await admin.post('/admin/products', { sku: `T-${uniq}`, name: `Produit ${uniq}`, price: 20, sale_price: 15, category_id: cats[0].id, quantity: 10, images: [{ url: 'https://example.com/a.jpg' }] });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const pid = created.data.product.id;
  assert.equal((await admin.post('/admin/products', { sku: `T-${uniq}`, name: 'Doublon', price: 5 })).status, 409); // SKU unique
  assert.equal((await admin.post('/admin/products', { sku: 'X', name: 'Bad', price: 10, sale_price: 12 })).status, 422);
  assert.equal((await admin.post('/admin/stock/move', { productId: pid, type: 'out', quantity: 50 })).status, 409); // stock négatif interdit
  assert.equal((await admin.post('/admin/stock/move', { productId: pid, type: 'in', quantity: 5 })).data.balance, 15);
  assert.equal((await admin.post('/admin/stock/inventory', { productId: pid, counted: 12 })).data.delta, -3);
  const sup = (await admin.post('/admin/suppliers', { name: `Fournisseur ${uniq}` })).data.id;
  const po = await admin.post('/admin/purchase-orders', { supplier_id: sup, items: [{ productId: pid, quantity: 20, unit_cost: 8 }] });
  assert.equal(po.status, 201);
  const items = (await admin.get(`/admin/purchase-orders/${po.data.id}`)).data.items;
  assert.equal((await admin.post(`/admin/purchase-orders/${po.data.id}/receive`, { items: [{ itemId: items[0].id, quantity: 25 }] })).status, 422);
  assert.equal((await admin.post(`/admin/purchase-orders/${po.data.id}/receive`, { items: [{ itemId: items[0].id, quantity: 20 }] })).data.status, 'received');
  assert.equal((await admin.get(`/admin/products/${pid}`)).data.product.quantity, 32);
  assert.equal((await admin.post('/admin/coupons', { code: `T${uniq.toUpperCase()}`, type: 'percent', value: 150 })).status, 422);
  assert.equal((await admin.post('/admin/coupons', { code: `T${uniq.toUpperCase()}`, type: 'fixed', value: 5, min_order: 10 })).status, 201);
  assert.equal((await admin.del(`/admin/products/${pid}`)).data.archived, true); // utilisé dans un approvisionnement → archivé
  const tmp = (await admin.post('/admin/products', { sku: `D-${uniq}`, name: `Jetable ${uniq}`, price: 5, quantity: 1 })).data.product.id;
  assert.equal((await admin.del(`/admin/products/${tmp}`)).data.deleted, true);
  assert.equal((await admin.del(`/admin/products/${productA.id}`)).data.archived, true); // déjà commandé → archivé
  await admin.patch(`/admin/products/${productA.id}/status`, { status: 'active' });
  const dash = (await admin.get('/admin/dashboard')).data;
  assert.ok(dash.cards.orders >= 2); assert.ok(dash.cards.revenue > 0);
  const rep = await admin.get('/admin/reports/orders?format=xlsx'); assert.equal(rep.status, 200); assert.equal(rep.data.slice(0, 2).toString(), 'PK');
  assert.equal((await admin.get('/admin/reports/sales?format=pdf')).data.slice(0, 4).toString(), '%PDF');
  assert.ok((await admin.get('/admin/audit-logs')).data.logs.length > 5);
});

test('rôles : un gestionnaire de stock n\'accède pas aux paiements ; dernier admin protégé', async () => {
  const sm = new Client(); await sm.post('/auth/login', { email: 'stock@demo.com', password: 'Demo!2026pass' });
  assert.equal((await sm.get('/admin/stock')).status, 200);
  assert.equal((await sm.get('/admin/payments')).status, 403);
  assert.equal((await sm.post('/admin/refunds', { paymentId: 1 })).status, 403);
  const me = (await admin.get('/auth/me')).data.user;
  assert.equal((await admin.put(`/admin/users/${me.id}`, { first_name: 'A', last_name: 'B', email: me.email, is_active: 0 })).status, 409);
});

test('verrouillage après tentatives, mot de passe oublié sans énumération', async () => {
  const c = new Client();
  await c.post('/auth/register', { first_name: 'Lock', last_name: 'Me', email: `l${uniq}@example.com`, password: 'Passw0rdTest' });
  for (let i = 0; i < env.maxLoginAttempts; i++) await anon.post('/auth/login', { email: `l${uniq}@example.com`, password: 'bad' });
  assert.equal((await anon.post('/auth/login', { email: `l${uniq}@example.com`, password: 'Passw0rdTest' })).status, 429);
  const a = await anon.post('/auth/forgot-password', { email: `l${uniq}@example.com` }); const b = await anon.post('/auth/forgot-password', { email: 'inconnu@example.com' });
  assert.deepEqual(a.data, b.data);
});

test('suivi public, contact, newsletter, contenus', async () => {
  const t = await anon.get(`/orders/track?order=${order1.orderNumber}&email=${uniq}@example.com`);
  assert.equal(t.status, 200); assert.equal(t.data.status, 'delivered');
  assert.equal((await anon.get(`/orders/track?order=${order1.orderNumber}&email=wrong@example.com`)).status, 404);
  assert.equal((await anon.post('/support/tickets', { name: 'Jean', email: 'j@example.com', subject: 'Question', message: 'Bonjour' })).status, 201);
  assert.equal((await anon.post('/newsletter', { email: `n${uniq}@example.com` })).status, 201);
  assert.ok((await anon.get('/content/faq')).data.value);
});
