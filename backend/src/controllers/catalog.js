const { query, one } = require('../config/db');
const { ApiError, ok } = require('../utils/http');
const { pagination, pageMeta, likeEscape, safeJson, randomCode } = require('../utils/helpers');
const { CURRENT_PRICE_SQL, PRIMARY_IMAGE_SQL, shippingMethodsFor } = require('../services/pricing');
const { publicSettings, getSetting, getNumber } = require('../services/settings');
const { sendMail, esc } = require('../utils/mailer');
const { env } = require('../config/env');
const crypto = require('crypto');
const { notifyStaff } = require('../utils/notify');

const STOCK_SQL = '(SELECT COALESCE(SUM(i.quantity),0) FROM inventories i WHERE i.product_id = p.id)';

const SELECT_CARD = `p.id, p.slug, p.sku, p.name, p.short_description, p.status, p.is_featured, p.rating_avg, p.rating_count, p.sold_count, p.created_at,
  p.price AS regular_price, ${CURRENT_PRICE_SQL} AS current_price, ${PRIMARY_IMAGE_SQL} AS image, ${STOCK_SQL} AS stock,
  c.slug AS category_slug, c.name AS category_name, b.name AS brand_name, b.slug AS brand_slug,
  (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id=p.id AND pv.is_active=1) AS variant_count`;
const FROM_CARD = 'FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id';

function toCard(r) {
  const onSale = r.current_price < r.regular_price;
  return {
    id: r.id, slug: r.slug, sku: r.sku, name: r.name, shortDescription: r.short_description,
    category: r.category_slug, categoryName: r.category_name, brand: r.brand_name, brandSlug: r.brand_slug,
    price: Number(r.current_price), oldPrice: onSale ? Number(r.regular_price) : null,
    badge: onSale ? `-${Math.round((1 - r.current_price / r.regular_price) * 100)}%` : null,
    rating: Number(r.rating_avg), reviews: r.rating_count, image: r.image, stock: Number(r.stock), inStock: Number(r.stock) > 0,
    hasVariants: r.variant_count > 0, featured: !!r.is_featured, isNew: Date.now() - new Date(r.created_at).getTime() < 30 * 86400000,
  };
}

const SORTS = {
  price_asc: 'current_price ASC, p.id ASC',
  price_desc: 'current_price DESC, p.id ASC',
  popular: 'p.sold_count DESC, p.rating_count DESC, p.id ASC',
  newest: 'p.created_at DESC, p.id DESC',
  rating: 'p.rating_avg DESC, p.rating_count DESC, p.id ASC',
  relevance: 'p.is_featured DESC, p.id ASC',
};

/** GET /products — recherche, filtres, tri, pagination (4.3). */
exports.listProducts = async (req, res) => {
  const q = req.query;
  const { page, limit, offset } = pagination(q, { defaultLimit: 12, maxLimit: 60 });
  const where = ["p.status='active'"]; const params = [];
  if (q.q) {
    const like = `%${likeEscape(String(q.q).trim().slice(0, 100))}%`;
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR c.name LIKE ? OR b.name LIKE ? OR p.short_description LIKE ?)');
    params.push(like, like, like, like, like);
  }
  if (q.category) {
    const slugs = String(q.category).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    where.push(`(c.slug IN (?) OR c.parent_id IN (SELECT id FROM categories WHERE slug IN (?)))`);
    params.push(slugs, slugs);
  }
  if (q.brand) { where.push('b.slug IN (?)'); params.push(String(q.brand).split(',').map((s) => s.trim().toLowerCase())); }
  if (q.minPrice !== undefined && q.minPrice !== '' && !Number.isNaN(Number(q.minPrice))) { where.push(`${CURRENT_PRICE_SQL} >= ?`); params.push(Number(q.minPrice)); }
  if (q.maxPrice !== undefined && q.maxPrice !== '' && !Number.isNaN(Number(q.maxPrice))) { where.push(`${CURRENT_PRICE_SQL} <= ?`); params.push(Number(q.maxPrice)); }
  if (q.inStock === '1' || q.inStock === 'true') where.push(`${STOCK_SQL} > 0`);
  if (q.minRating && Number(q.minRating) > 0) { where.push('p.rating_avg >= ?'); params.push(Number(q.minRating)); }
  if (q.featured === '1') where.push('p.is_featured = 1');
  if (q.onSale === '1') where.push(`${CURRENT_PRICE_SQL} < p.price`);
  if (q.isNew === '1') where.push('p.created_at >= (NOW() - INTERVAL 30 DAY)');
  const order = SORTS[q.sort] || SORTS.relevance;
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n ${FROM_CARD} WHERE ${w}`, params)).n;
  const rows = await query(`SELECT ${SELECT_CARD} ${FROM_CARD} WHERE ${w} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { products: rows.map(toCard), meta: pageMeta(total, page, limit) });
};

/** GET /products/:slug — fiche complète (4.2). slug numérique accepté (id). */
exports.getProduct = async (req, res) => {
  const key = req.params.slug;
  const row = await one(`SELECT ${SELECT_CARD}, p.description, p.specs, p.weight_kg, p.length_cm, p.width_cm, p.height_cm, p.category_id ${FROM_CARD}
    WHERE p.status='active' AND (p.slug=? OR p.id=?)`, [key, /^\d+$/.test(key) ? Number(key) : 0]);
  if (!row) throw new ApiError(404, 'Produit introuvable');
  const [images, variants, dist, related] = await Promise.all([
    query('SELECT url, alt, is_primary FROM product_images WHERE product_id=? ORDER BY is_primary DESC, sort_order, id', [row.id]),
    query(`SELECT v.id, v.sku, v.name, v.attributes, COALESCE(v.price_override, ${CURRENT_PRICE_SQL}) AS price,
             COALESCE((SELECT quantity FROM inventories WHERE product_id=v.product_id AND variant_id=v.id),0) AS stock
           FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.product_id=? AND v.is_active=1 ORDER BY v.id`, [row.id]),
    query("SELECT rating, COUNT(*) AS n FROM reviews WHERE product_id=? AND status='published' GROUP BY rating", [row.id]),
    query(`SELECT ${SELECT_CARD} ${FROM_CARD} WHERE p.status='active' AND p.id<>? AND p.category_id=? ORDER BY p.sold_count DESC LIMIT 5`, [row.id, row.category_id]),
  ]);
  const card = toCard(row);
  const stock = variants.length ? variants.reduce((s, v) => s + Number(v.stock), 0) : card.stock;
  ok(res, {
    product: {
      ...card, stock, inStock: stock > 0, description: row.description, specs: safeJson(row.specs, {}),
      dimensions: { weightKg: row.weight_kg, lengthCm: row.length_cm, widthCm: row.width_cm, heightCm: row.height_cm },
      images: images.length ? images : (card.image ? [{ url: card.image, alt: card.name, is_primary: 1 }] : []),
      variants: variants.map((v) => ({ ...v, price: Number(v.price), attributes: safeJson(v.attributes, {}) })),
      ratingDistribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: dist.find((d) => d.rating === r)?.n || 0 })),
    },
    related: related.map(toCard),
  });
};

exports.productReviews = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 10, maxLimit: 50 });
  const total = (await one("SELECT COUNT(*) AS n FROM reviews WHERE product_id=? AND status='published'", [req.params.id])).n;
  const rows = await query(
    `SELECT r.id, r.rating, r.title, r.comment, r.created_at, u.first_name, LEFT(u.last_name,1) AS last_initial
     FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=? AND r.status='published' ORDER BY r.id DESC LIMIT ? OFFSET ?`, [req.params.id, limit, offset]);
  ok(res, { reviews: rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, comment: r.comment, createdAt: r.created_at, author: `${r.first_name} ${r.last_initial}.` })), meta: pageMeta(total, page, limit) });
};

exports.categories = async (_req, res) => {
  const rows = await query(`SELECT c.id, c.slug, c.name, c.icon, c.parent_id, c.description,
    (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.status='active') AS product_count
    FROM categories c WHERE c.is_active=1 ORDER BY c.sort_order, c.name`);
  ok(res, { categories: rows });
};
exports.brands = async (_req, res) => ok(res, { brands: await query('SELECT id, slug, name FROM brands WHERE is_active=1 ORDER BY name') });
exports.settings = async (_req, res) => ok(res, { settings: await publicSettings(), paymentMethods: await require('../services/payments').enabledMethods() });

const PUBLIC_CONTENT = ['about', 'contact', 'cgv', 'privacy', 'shipping_policy', 'return_policy', 'legal', 'faq', 'hero', 'banners'];
exports.content = async (req, res) => {
  if (!PUBLIC_CONTENT.includes(req.params.name)) throw new ApiError(404, 'Contenu introuvable');
  const row = await one('SELECT setting_value, updated_at FROM settings WHERE setting_key=?', [`content.${req.params.name}`]);
  ok(res, { name: req.params.name, value: row?.setting_value ?? null, updatedAt: row?.updated_at ?? null });
};

exports.posts = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 9, maxLimit: 30 });
  const total = (await one("SELECT COUNT(*) AS n FROM posts WHERE status='published'")).n;
  const rows = await query("SELECT id, slug, title, excerpt, cover_url, published_at FROM posts WHERE status='published' ORDER BY published_at DESC LIMIT ? OFFSET ?", [limit, offset]);
  ok(res, { posts: rows, meta: pageMeta(total, page, limit) });
};
exports.post = async (req, res) => {
  const row = await one("SELECT id, slug, title, excerpt, content, cover_url, published_at FROM posts WHERE slug=? AND status='published'", [req.params.slug]);
  if (!row) throw new ApiError(404, 'Article introuvable');
  ok(res, { post: row });
};

exports.shippingMethods = async (req, res) => {
  const subtotal = Number(req.query.subtotal) || 0;
  const country = String(req.query.country || (await getSetting('store.default_country'))).toUpperCase();
  const methods = await shippingMethodsFor(country, subtotal);
  ok(res, { methods: methods.map((m) => ({ id: m.id, code: m.code, name: m.name, price: m.price, fee: Number(m.fee), freeOver: m.free_over != null ? Number(m.free_over) : null, minDays: m.min_days, maxDays: m.max_days, zone: m.zone })), freeShippingThreshold: await getNumber('store.free_shipping_threshold', 49) });
};

/** Signature du lien de désinscription (aucune donnée stockée en plus). */
const unsubscribeSig = (email) => crypto.createHmac('sha256', env.jwtSecret).update(`unsub:${email.toLowerCase()}`).digest('hex').slice(0, 32);
const unsubscribeUrl = (email) => `${env.frontendUrl}/newsletter/desabonnement?email=${encodeURIComponent(email)}&sig=${unsubscribeSig(email)}`;

exports.subscribe = async (req, res) => {
  const email = req.body.email.toLowerCase();
  const r = await query('INSERT IGNORE INTO newsletter_subscribers (email) VALUES (?)', [email]);
  if (r.affectedRows) {
    const store = await getSetting('store.name', 'VIVA Live Better');
    sendMail({ to: email, subject: `Bienvenue dans la newsletter ${store}`, title: 'Inscription confirmée', html: `<p>Merci ! Vous recevrez nos nouveautés et offres exclusives.</p><p style="font-size:12px;color:#888">Pour vous désinscrire à tout moment : <a href="${unsubscribeUrl(email)}">cliquez ici</a>.</p>` });
    await notifyStaff(['support.manage', 'content.manage'], { type: 'newsletter_subscriber', title: 'Nouvel abonné à la newsletter', message: email, link: '/admin/support?tab=newsletter' });
    const to = await getSetting('store.contact_email');
    if (to) sendMail({ to, subject: 'Nouvel abonné à la newsletter', title: 'Nouvel abonné', html: `<p><b>${esc(email)}</b> vient de s'inscrire à la newsletter.</p>` });
  }
  ok(res, { message: 'Merci pour votre inscription !' }, 201);
};
exports.unsubscribe = async (req, res) => {
  const email = String(req.query.email || '').toLowerCase(); const sig = String(req.query.sig || '');
  const good = unsubscribeSig(email);
  if (!email || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) throw new ApiError(400, 'Lien de désinscription invalide');
  await query('DELETE FROM newsletter_subscribers WHERE email=?', [email]);
  ok(res, { message: 'Vous êtes désinscrit(e) de la newsletter.' });
};
exports.unsubscribeUrl = unsubscribeUrl;

/** Formulaire de contact / réclamation / demande de retour (4.14). */
exports.createTicket = async (req, res) => {
  const b = req.body;
  let orderId = null;
  if (b.orderNumber && req.user) {
    const o = await one('SELECT id FROM orders WHERE order_number=? AND user_id=?', [b.orderNumber, req.user.id]);
    orderId = o?.id || null;
  }
  const number = randomCode('TCK', 7);
  const r = await query('INSERT INTO support_tickets (ticket_number, user_id, name, email, subject, type, order_id) VALUES (?,?,?,?,?,?,?)',
    [number, req.user?.id || null, b.name, b.email, b.subject, b.type, orderId]);
  await query('INSERT INTO support_messages (ticket_id, user_id, is_staff, message) VALUES (?,?,0,?)', [r.insertId, req.user?.id || null, b.message]);
  sendMail({ to: b.email, subject: `Votre demande ${number} a bien été reçue`, title: 'Nous avons bien reçu votre message', html: `<p>Bonjour ${esc(b.name)},</p><p>Votre demande <b>${number}</b> (« ${esc(b.subject)} ») a été enregistrée. Notre équipe vous répondra rapidement.</p>` });
  const typeLabel = { contact: 'Message de contact', complaint: 'Réclamation', return: 'Demande de retour', refund: 'Demande de remboursement' }[b.type] || 'Message';
  await notifyStaff(['support.manage'], { type: 'contact_message', title: `${typeLabel} - ${b.name}`, message: `${b.subject} — ${String(b.message).slice(0, 140)}`, link: '/admin/support' });
  const storeEmail = await getSetting('store.contact_email');
  if (storeEmail) {
    sendMail({ to: storeEmail, replyTo: b.email, subject: `[${number}] ${b.subject}`, title: typeLabel,
      html: `<p><b>De :</b> ${esc(b.name)} (${esc(b.email)})</p><p><b>Sujet :</b> ${esc(b.subject)}</p><p>${esc(b.message).replace(/\n/g, '<br>')}</p>`,
      cta: { url: `${env.frontendUrl}/admin/support`, label: 'Répondre dans l\'administration' } });
  }
  ok(res, { ticketNumber: number, message: 'Votre message a bien été envoyé !' }, 201);
};

exports.toCard = toCard;
exports.SELECT_CARD = SELECT_CARD;
exports.FROM_CARD = FROM_CARD;
exports.env = env;
