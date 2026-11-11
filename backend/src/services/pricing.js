const { query, one } = require('../config/db');
const { ApiError } = require('../utils/http');
const { round2 } = require('../utils/helpers');
const { getNumber, getSetting } = require('./settings');

/** Expression SQL du prix courant (promo valide ou prix normal). */
const CURRENT_PRICE_SQL = `(CASE WHEN p.sale_price IS NOT NULL AND p.sale_price < p.price
  AND (p.sale_starts_at IS NULL OR p.sale_starts_at <= NOW()) AND (p.sale_ends_at IS NULL OR p.sale_ends_at >= NOW())
  THEN p.sale_price ELSE p.price END)`;
const PRIMARY_IMAGE_SQL = `(SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order, id LIMIT 1)`;

/**
 * Charge et valide les lignes du panier depuis la base (le client n'est jamais cru sur les prix).
 * items : [{ productId, variantId?, quantity }]
 */
async function loadLines(items, conn, { lock = false } = {}) {
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'Le panier est vide');
  // fusionne les doublons
  const merged = new Map();
  for (const it of items) {
    const key = `${it.productId}:${it.variantId || 0}`;
    const q = Math.max(1, Math.floor(Number(it.quantity) || 1));
    merged.set(key, { productId: Number(it.productId), variantId: Number(it.variantId || 0), quantity: (merged.get(key)?.quantity || 0) + q });
  }
  const lines = [];
  const issues = [];
  for (const it of merged.values()) {
    const p = await one(
      `SELECT p.id, p.sku, p.slug, p.name, p.status, p.category_id, p.brand_id, p.price, p.sale_price,
              ${CURRENT_PRICE_SQL} AS current_price, ${PRIMARY_IMAGE_SQL} AS image
       FROM products p WHERE p.id=?`, [it.productId], conn);
    if (!p || p.status !== 'active') { issues.push({ productId: it.productId, message: 'Produit indisponible' }); continue; }
    let variant = null;
    if (it.variantId) {
      variant = await one('SELECT id, sku, name, price_override, is_active FROM product_variants WHERE id=? AND product_id=?', [it.variantId, p.id], conn);
      if (!variant || !variant.is_active) { issues.push({ productId: p.id, message: `Variante indisponible pour « ${p.name} »` }); continue; }
    } else {
      const hasVariants = await one('SELECT COUNT(*) AS n FROM product_variants WHERE product_id=? AND is_active=1', [p.id], conn);
      if (hasVariants.n > 0) { issues.push({ productId: p.id, message: `Veuillez choisir une variante pour « ${p.name} »` }); continue; }
    }
    const inv = await one(`SELECT quantity FROM inventories WHERE product_id=? AND variant_id=? ${lock ? 'FOR UPDATE' : ''}`, [p.id, it.variantId], conn);
    const stock = inv ? inv.quantity : 0;
    const unit = round2(variant?.price_override ?? p.current_price);
    if (stock < it.quantity) {
      issues.push({ productId: p.id, message: stock <= 0 ? `« ${p.name} » est en rupture de stock` : `Stock insuffisant pour « ${p.name} » (disponible : ${stock})`, available: stock });
    }
    lines.push({
      productId: p.id, variantId: it.variantId, sku: variant?.sku || p.sku, slug: p.slug, name: p.name,
      variantName: variant?.name || null, image: p.image, categoryId: p.category_id,
      unitPrice: unit, oldPrice: variant ? null : (p.current_price < p.price ? p.price : null),
      quantity: it.quantity, stock, discount: 0, lineTotal: round2(unit * it.quantity),
    });
  }
  return { lines, issues };
}

/** Calcule et valide un code promo sur les lignes. Retourne { coupon, discount, perLine }. */
async function applyCoupon(code, lines, userId, conn) {
  const coupon = await one('SELECT * FROM coupons WHERE code=?', [String(code).trim().toUpperCase()], conn);
  const bad = (m) => { throw new ApiError(422, m); };
  if (!coupon || !coupon.is_active) bad('Code promotionnel invalide');
  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) bad("Ce code promotionnel n'est pas encore valide");
  if (coupon.ends_at && new Date(coupon.ends_at) < now) bad('Ce code promotionnel a expiré');
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) bad("Ce code promotionnel n'est plus disponible");
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  if (subtotal < Number(coupon.min_order)) bad(`Montant minimum d'achat : ${Number(coupon.min_order).toFixed(2)}`);
  if (userId && coupon.per_user_limit != null) {
    const used = await one('SELECT COUNT(*) AS n FROM coupon_usages WHERE coupon_id=? AND user_id=?', [coupon.id, userId], conn);
    if (used.n >= coupon.per_user_limit) bad('Vous avez déjà utilisé ce code promotionnel');
  }
  let eligible = lines;
  if (coupon.applies_to !== 'all') {
    const type = coupon.applies_to === 'products' ? 'product' : 'category';
    const targets = (await query('SELECT target_id FROM coupon_targets WHERE coupon_id=? AND target_type=?', [coupon.id, type], conn)).map((t) => t.target_id);
    eligible = lines.filter((l) => targets.includes(type === 'product' ? l.productId : l.categoryId));
    if (!eligible.length) bad("Ce code ne s'applique à aucun produit de votre panier");
  }
  const base = round2(eligible.reduce((s, l) => s + l.lineTotal, 0));
  let discount = coupon.type === 'percent' ? round2((base * Number(coupon.value)) / 100) : Number(coupon.value);
  if (coupon.max_discount != null) discount = Math.min(discount, Number(coupon.max_discount));
  discount = round2(Math.min(discount, base));
  // répartition proportionnelle (le dernier absorbe l'arrondi)
  const perLine = new Map();
  let left = discount;
  eligible.forEach((l, i) => {
    const d = i === eligible.length - 1 ? left : round2((discount * l.lineTotal) / base);
    perLine.set(`${l.productId}:${l.variantId}`, d); left = round2(left - d);
  });
  return { coupon, discount, perLine };
}

async function shippingMethodsFor(country, subtotal, conn) {
  const zones = await query('SELECT id, name, countries FROM shipping_zones WHERE is_active=1', [], conn);
  const cc = String(country || '').toUpperCase();
  let zone = zones.find((z) => z.countries.split(',').map((c) => c.trim().toUpperCase()).includes(cc));
  if (!zone) zone = zones.find((z) => z.countries.trim() === '*');
  if (!zone) return [];
  const methods = await query('SELECT id, code, name, fee, free_over, min_days, max_days FROM shipping_methods WHERE zone_id=? AND is_active=1 ORDER BY fee', [zone.id], conn);
  return methods.map((m) => ({
    ...m, zone: zone.name, zoneId: zone.id,
    price: m.free_over != null && subtotal >= Number(m.free_over) ? 0 : Number(m.fee),
  }));
}

/**
 * Devis complet : lignes validées, remise, livraison, taxes, total.
 * Utilisé par le panier (estimation) ET par la création de commande (source de vérité).
 */
async function computeQuote({ items, couponCode, userId, shippingMethodId, country, conn, lock = false }) {
  const { lines, issues } = await loadLines(items, conn, { lock });
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  let coupon = null, discount = 0, couponError = null;
  if (couponCode) {
    try {
      const r = await applyCoupon(couponCode, lines, userId, conn);
      coupon = r.coupon; discount = r.discount;
      for (const l of lines) l.discount = r.perLine.get(`${l.productId}:${l.variantId}`) || 0;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) couponError = e.message; else throw e;
    }
  }
  const afterDiscount = round2(subtotal - discount);
  const methods = await shippingMethodsFor(country || (await getSetting('store.default_country')), afterDiscount, conn);
  let method = null;
  if (shippingMethodId) method = methods.find((m) => m.id === Number(shippingMethodId)) || null;
  else method = methods[0] || null;
  const shipping = method ? round2(method.price) : 0;
  const taxRate = await getNumber('store.tax_rate', 0);
  const tax = round2(((afterDiscount + shipping) * taxRate) / 100);
  const grand = round2(afterDiscount + shipping + tax);
  return { lines, issues, subtotal, discount, coupon, couponError, shipping, shippingMethod: method, shippingMethods: methods, tax, taxRate, grandTotal: grand };
}

module.exports = { CURRENT_PRICE_SQL, PRIMARY_IMAGE_SQL, loadLines, applyCoupon, shippingMethodsFor, computeQuote };
