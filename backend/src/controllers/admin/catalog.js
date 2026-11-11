const fs = require('fs');
const path = require('path');
const { query, one, withTransaction } = require('../../config/db');
const { ApiError, ok } = require('../../utils/http');
const { slugify, pagination, pageMeta, likeEscape, safeJson } = require('../../utils/helpers');
const { audit } = require('../../utils/audit');
const { adjustStock } = require('../../services/stock');
const { uploadDir } = require('../../middlewares/upload');

async function uniqueSlug(table, base, ignoreId, conn) {
  let slug = slugify(base); let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await one(`SELECT id FROM ${table} WHERE slug=? ${ignoreId ? 'AND id<>?' : ''}`, ignoreId ? [slug, ignoreId] : [slug], conn)) { i += 1; slug = `${slugify(base)}-${i}`; }
  return slug;
}

/* ------------------------------------------------------------ Téléversement (vérifie la signature binaire) */
const MAGIC = [
  ['image/jpeg', [0xff, 0xd8, 0xff]], ['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/gif', [0x47, 0x49, 0x46, 0x38]],
];
function looksLikeImage(file) {
  const fd = fs.openSync(file, 'r'); const buf = Buffer.alloc(12); fs.readSync(fd, buf, 0, 12, 0); fs.closeSync(fd);
  if (MAGIC.some(([, sig]) => sig.every((b, i) => buf[i] === b))) return true;
  return buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
}
exports.upload = async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw new ApiError(400, 'Aucun fichier reçu');
  const urls = [];
  for (const f of files) {
    if (!looksLikeImage(f.path)) { fs.unlinkSync(f.path); throw new ApiError(415, 'Fichier invalide : ce n\'est pas une image'); }
    urls.push(`/uploads/${path.basename(f.path)}`);
  }
  await audit(req, 'upload.images', 'upload', null, { count: urls.length });
  ok(res, { urls }, 201);
};

/* ------------------------------------------------------------ Produits */
const STOCK_SQL = '(SELECT COALESCE(SUM(i.quantity),0) FROM inventories i WHERE i.product_id=p.id)';
exports.listProducts = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = ['1=1']; const params = [];
  if (req.query.q) { const l = `%${likeEscape(req.query.q)}%`; where.push('(p.name LIKE ? OR p.sku LIKE ?)'); params.push(l, l); }
  if (req.query.status) { where.push('p.status=?'); params.push(req.query.status); }
  if (req.query.category) { where.push('p.category_id=?'); params.push(Number(req.query.category)); }
  if (req.query.stock === 'out') where.push(`${STOCK_SQL} <= 0`);
  if (req.query.stock === 'low') where.push(`${STOCK_SQL} > 0 AND ${STOCK_SQL} <= COALESCE((SELECT MIN(low_stock_threshold) FROM inventories WHERE product_id=p.id),5)`);
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM products p WHERE ${w}`, params)).n;
  const rows = await query(`SELECT p.id, p.sku, p.slug, p.name, p.price, p.sale_price, p.status, p.is_featured, p.sold_count, p.rating_avg, p.rating_count, p.created_at,
    c.name AS category_name, b.name AS brand_name, ${STOCK_SQL} AS stock,
    (SELECT url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC, sort_order, id LIMIT 1) AS image
    FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id WHERE ${w} ORDER BY p.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { products: rows, meta: pageMeta(total, page, limit) });
};

exports.getProduct = async (req, res) => {
  const p = await one('SELECT * FROM products WHERE id=?', [req.params.id]);
  if (!p) throw new ApiError(404, 'Produit introuvable');
  const [images, variants, inv, suppliers] = await Promise.all([
    query('SELECT url, alt, is_primary FROM product_images WHERE product_id=? ORDER BY is_primary DESC, sort_order, id', [p.id]),
    query('SELECT id, sku, name, attributes, price_override, is_active FROM product_variants WHERE product_id=? ORDER BY id', [p.id]),
    query('SELECT variant_id, quantity, low_stock_threshold FROM inventories WHERE product_id=?', [p.id]),
    query('SELECT ps.supplier_id, ps.supplier_sku, ps.cost_price, s.name FROM product_suppliers ps JOIN suppliers s ON s.id=ps.supplier_id WHERE ps.product_id=?', [p.id]),
  ]);
  const base = inv.find((i) => i.variant_id === 0);
  ok(res, { product: { ...p, specs: safeJson(p.specs, {}), images, quantity: base?.quantity ?? 0, low_stock_threshold: base?.low_stock_threshold ?? 5,
    variants: variants.map((v) => ({ ...v, attributes: safeJson(v.attributes, {}), quantity: inv.find((i) => i.variant_id === v.id)?.quantity ?? 0 })), suppliers } });
};

async function persistProduct(conn, id, b, req) {
  const specs = b.specs == null ? null : typeof b.specs === 'string' ? b.specs : JSON.stringify(b.specs);
  const saleOk = b.sale_price == null || b.sale_price < b.price;
  if (!saleOk) throw new ApiError(422, 'Le prix promotionnel doit être inférieur au prix de vente');
  const vals = [b.sku, b.name, b.short_description, b.description, b.category_id || null, b.brand_id || null, b.price, b.sale_price ?? null,
    b.sale_starts_at ? new Date(b.sale_starts_at) : null, b.sale_ends_at ? new Date(b.sale_ends_at) : null, b.weight_kg ?? null, b.length_cm ?? null, b.width_cm ?? null, b.height_cm ?? null, specs, b.status, b.is_featured ? 1 : 0];
  let pid = id;
  if (id) {
    await query(`UPDATE products SET sku=?, name=?, short_description=?, description=?, category_id=?, brand_id=?, price=?, sale_price=?, sale_starts_at=?, sale_ends_at=?, weight_kg=?, length_cm=?, width_cm=?, height_cm=?, specs=?, status=?, is_featured=? WHERE id=?`, [...vals, id], conn);
  } else {
    const slug = await uniqueSlug('products', b.slug || b.name, null, conn);
    pid = (await query(`INSERT INTO products (sku, name, short_description, description, category_id, brand_id, price, sale_price, sale_starts_at, sale_ends_at, weight_kg, length_cm, width_cm, height_cm, specs, status, is_featured, slug) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [...vals, slug], conn)).insertId;
  }
  if (b.images) {
    await query('DELETE FROM product_images WHERE product_id=?', [pid], conn);
    let primarySet = false;
    for (const [i, img] of b.images.entries()) {
      const primary = !primarySet && (img.is_primary || i === 0) ? 1 : 0; if (primary) primarySet = true;
      await query('INSERT INTO product_images (product_id, url, alt, sort_order, is_primary) VALUES (?,?,?,?,?)', [pid, img.url, img.alt || b.name, i, primary], conn);
    }
  }
  if (b.variants) {
    const keep = [];
    for (const v of b.variants) {
      let vid = v.id;
      const vals2 = [v.sku, v.name, v.attributes ? JSON.stringify(v.attributes) : null, v.price_override ?? null, v.is_active === 0 ? 0 : 1];
      if (vid) await query('UPDATE product_variants SET sku=?, name=?, attributes=?, price_override=?, is_active=? WHERE id=? AND product_id=?', [...vals2, vid, pid], conn);
      else vid = (await query('INSERT INTO product_variants (sku, name, attributes, price_override, is_active, product_id) VALUES (?,?,?,?,?,?)', [...vals2, pid], conn)).insertId;
      keep.push(vid);
      if (v.quantity !== undefined) {
        const cur = await one('SELECT quantity FROM inventories WHERE product_id=? AND variant_id=?', [pid, vid], conn);
        const delta = v.quantity - (cur?.quantity ?? 0);
        if (delta !== 0 || !cur) await adjustStock(conn, { productId: pid, variantId: vid, delta, type: 'adjustment', note: 'Fiche produit', userId: req.user.id });
      }
    }
    const old = await query('SELECT id FROM product_variants WHERE product_id=?', [pid], conn);
    for (const o of old.filter((x) => !keep.includes(x.id))) {
      await query('DELETE FROM inventories WHERE product_id=? AND variant_id=?', [pid, o.id], conn);
      await query('DELETE FROM cart_items WHERE product_id=? AND variant_id=?', [pid, o.id], conn);
      await query('DELETE FROM product_variants WHERE id=?', [o.id], conn);
    }
  }
  const hasVariants = (b.variants && b.variants.length) || (!b.variants && (await one('SELECT COUNT(*) AS n FROM product_variants WHERE product_id=?', [pid], conn)).n > 0);
  if (!hasVariants && b.quantity !== undefined) {
    const cur = await one('SELECT quantity FROM inventories WHERE product_id=? AND variant_id=0', [pid], conn);
    const delta = b.quantity - (cur?.quantity ?? 0);
    if (delta !== 0 || !cur) await adjustStock(conn, { productId: pid, variantId: 0, delta, type: 'adjustment', note: 'Fiche produit', userId: req.user.id });
  }
  if (b.low_stock_threshold !== undefined) await query('UPDATE inventories SET low_stock_threshold=? WHERE product_id=?', [b.low_stock_threshold, pid], conn);
  return pid;
}
exports.createProduct = async (req, res) => {
  const id = await withTransaction((c) => persistProduct(c, null, req.body, req));
  await audit(req, 'product.create', 'product', id, { sku: req.body.sku });
  ok(res, { product: await one('SELECT id, slug FROM products WHERE id=?', [id]) }, 201);
};
exports.updateProduct = async (req, res) => {
  const id = Number(req.params.id);
  if (!(await one('SELECT id FROM products WHERE id=?', [id]))) throw new ApiError(404, 'Produit introuvable');
  await withTransaction((c) => persistProduct(c, id, req.body, req));
  await audit(req, 'product.update', 'product', id, { sku: req.body.sku, price: req.body.price, status: req.body.status });
  ok(res, { product: await one('SELECT id, slug FROM products WHERE id=?', [id]) });
};
exports.setProductStatus = async (req, res) => {
  const st = req.body.status;
  if (!['active', 'draft', 'archived'].includes(st)) throw new ApiError(422, 'Statut invalide');
  await query('UPDATE products SET status=? WHERE id=?', [st, req.params.id]);
  await audit(req, 'product.status', 'product', req.params.id, { status: st });
  ok(res, { ok: true });
};
exports.deleteProduct = async (req, res) => {
  const id = Number(req.params.id);
  const used = await one('SELECT (SELECT COUNT(*) FROM order_items WHERE product_id=?) + (SELECT COUNT(*) FROM purchase_order_items WHERE product_id=?) AS n', [id, id]);
  if (used.n > 0) {
    await query("UPDATE products SET status='archived' WHERE id=?", [id]);
    await audit(req, 'product.archive', 'product', id, { reason: 'référencé par des commandes ou approvisionnements' });
    return ok(res, { archived: true, message: 'Produit déjà commandé ou approvisionné : il a été archivé (désactivé) au lieu d\'être supprimé.' });
  }
  await query('DELETE FROM products WHERE id=?', [id]);
  await audit(req, 'product.delete', 'product', id);
  ok(res, { deleted: true });
};

/* ------------------------------------------------------------ Catégories / marques */
exports.listCategories = async (_req, res) => ok(res, { categories: await query(`SELECT c.*, (SELECT COUNT(*) FROM products WHERE category_id=c.id) AS product_count FROM categories c ORDER BY c.sort_order, c.name`) });
exports.saveCategory = async (req, res) => {
  const b = req.body; const id = req.params.id ? Number(req.params.id) : null;
  if (id && b.parent_id === id) throw new ApiError(422, 'Une catégorie ne peut pas être son propre parent');
  const slug = await uniqueSlug('categories', b.slug || b.name, id);
  if (id) await query('UPDATE categories SET name=?, slug=?, parent_id=?, icon=?, description=?, sort_order=?, is_active=? WHERE id=?', [b.name, slug, b.parent_id || null, b.icon, b.description, b.sort_order, b.is_active === 0 ? 0 : 1, id]);
  else req.params.id = (await query('INSERT INTO categories (name, slug, parent_id, icon, description, sort_order, is_active) VALUES (?,?,?,?,?,?,?)', [b.name, slug, b.parent_id || null, b.icon, b.description, b.sort_order, b.is_active === 0 ? 0 : 1])).insertId;
  await audit(req, id ? 'category.update' : 'category.create', 'category', req.params.id);
  ok(res, { category: await one('SELECT * FROM categories WHERE id=?', [req.params.id]) }, id ? 200 : 201);
};
exports.deleteCategory = async (req, res) => {
  const n = await one('SELECT COUNT(*) AS n FROM products WHERE category_id=?', [req.params.id]);
  if (n.n) throw new ApiError(409, `Suppression impossible : ${n.n} produit(s) utilisent cette catégorie`);
  await query('DELETE FROM categories WHERE id=?', [req.params.id]);
  await audit(req, 'category.delete', 'category', req.params.id);
  ok(res, { deleted: true });
};
exports.listBrands = async (_req, res) => ok(res, { brands: await query('SELECT b.*, (SELECT COUNT(*) FROM products WHERE brand_id=b.id) AS product_count FROM brands b ORDER BY b.name') });
exports.saveBrand = async (req, res) => {
  const b = req.body; const id = req.params.id ? Number(req.params.id) : null;
  const slug = await uniqueSlug('brands', b.slug || b.name, id);
  if (id) await query('UPDATE brands SET name=?, slug=?, is_active=? WHERE id=?', [b.name, slug, b.is_active === 0 ? 0 : 1, id]);
  else req.params.id = (await query('INSERT INTO brands (name, slug, is_active) VALUES (?,?,?)', [b.name, slug, b.is_active === 0 ? 0 : 1])).insertId;
  await audit(req, id ? 'brand.update' : 'brand.create', 'brand', req.params.id);
  ok(res, { brand: await one('SELECT * FROM brands WHERE id=?', [req.params.id]) }, id ? 200 : 201);
};
exports.deleteBrand = async (req, res) => {
  const n = await one('SELECT COUNT(*) AS n FROM products WHERE brand_id=?', [req.params.id]);
  if (n.n) throw new ApiError(409, `Suppression impossible : ${n.n} produit(s) utilisent cette marque`);
  await query('DELETE FROM brands WHERE id=?', [req.params.id]);
  await audit(req, 'brand.delete', 'brand', req.params.id);
  ok(res, { deleted: true });
};
