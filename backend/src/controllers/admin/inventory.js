const { query, one, withTransaction } = require('../../config/db');
const { ApiError, ok } = require('../../utils/http');
const { pagination, pageMeta, likeEscape, randomCode } = require('../../utils/helpers');
const { audit } = require('../../utils/audit');
const { adjustStock } = require('../../services/stock');

/* ------------------------------------------------------------ Stock */
const LEVELS = `SELECT i.id, i.product_id, i.variant_id, i.quantity, i.low_stock_threshold, p.name, p.sku AS product_sku, v.name AS variant_name, COALESCE(v.sku, p.sku) AS sku,
  (SELECT url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC, id LIMIT 1) AS image,
  CASE WHEN i.quantity<=0 THEN 'out' WHEN i.quantity<=i.low_stock_threshold THEN 'low' ELSE 'ok' END AS level
  FROM inventories i JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id AND i.variant_id>0 WHERE p.status<>'archived'`;
exports.levels = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 25 });
  const cond = []; const params = [];
  if (req.query.q) { const l = `%${likeEscape(req.query.q)}%`; cond.push('(name LIKE ? OR sku LIKE ?)'); params.push(l, l); }
  if (req.query.level) { cond.push('level=?'); params.push(req.query.level); }
  const wrapped = `SELECT * FROM (${LEVELS}) t ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}`;
  const total = (await one(`SELECT COUNT(*) AS n FROM (${wrapped}) c`, params)).n;
  const rows = await query(`${wrapped} ORDER BY quantity ASC, name LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const summary = await one(`SELECT SUM(level='out') AS out_count, SUM(level='low') AS low_count, COUNT(*) AS total FROM (${LEVELS}) t`);
  ok(res, { items: rows, summary: { out: Number(summary.out_count || 0), low: Number(summary.low_count || 0), total: Number(summary.total || 0) }, meta: pageMeta(total, page, limit) });
};
exports.alerts = async (_req, res) => ok(res, { alerts: await query(`SELECT * FROM (${LEVELS}) t WHERE level IN ('out','low') ORDER BY quantity ASC LIMIT 100`) });
exports.movements = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 30 });
  const where = ['1=1']; const params = [];
  if (req.query.product) { where.push('m.product_id=?'); params.push(Number(req.query.product)); }
  if (req.query.type) { where.push('m.type=?'); params.push(req.query.type); }
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM stock_movements m WHERE ${w}`, params)).n;
  const rows = await query(`SELECT m.*, p.name AS product_name, v.name AS variant_name, CONCAT(u.first_name,' ',u.last_name) AS user_name
    FROM stock_movements m JOIN products p ON p.id=m.product_id LEFT JOIN product_variants v ON v.id=m.variant_id AND m.variant_id>0 LEFT JOIN users u ON u.id=m.user_id WHERE ${w} ORDER BY m.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { movements: rows, meta: pageMeta(total, page, limit) });
};
exports.move = async (req, res) => {
  const b = req.body;
  const p = await one('SELECT id, name FROM products WHERE id=?', [b.productId]);
  if (!p) throw new ApiError(404, 'Produit introuvable');
  const qty = await withTransaction((conn) => adjustStock(conn, { productId: p.id, variantId: b.variantId, delta: b.type === 'in' ? b.quantity : -b.quantity, type: b.type, userId: req.user.id, note: b.note, productName: p.name, refType: 'manual' }));
  await audit(req, `stock.${b.type}`, 'product', p.id, { quantity: b.quantity, balance: qty });
  ok(res, { balance: qty }, 201);
};
/** Inventaire : on saisit la quantité comptée, l'écart est enregistré. */
exports.inventoryCount = async (req, res) => {
  const b = req.body;
  const p = await one('SELECT id, name FROM products WHERE id=?', [b.productId]);
  if (!p) throw new ApiError(404, 'Produit introuvable');
  const result = await withTransaction(async (conn) => {
    const cur = await one('SELECT quantity FROM inventories WHERE product_id=? AND variant_id=? FOR UPDATE', [p.id, b.variantId], conn);
    const delta = b.counted - (cur?.quantity ?? 0);
    const balance = await adjustStock(conn, { productId: p.id, variantId: b.variantId, delta, type: 'inventory', userId: req.user.id, note: b.note || 'Inventaire physique', productName: p.name, refType: 'inventory' });
    return { delta, balance };
  });
  await audit(req, 'stock.inventory', 'product', p.id, result);
  ok(res, result, 201);
};
exports.setThreshold = async (req, res) => {
  await query('UPDATE inventories SET low_stock_threshold=? WHERE id=?', [Math.max(0, Number(req.body.threshold) || 0), req.params.id]);
  ok(res, { ok: true });
};

/* ------------------------------------------------------------ Fournisseurs */
exports.listSuppliers = async (req, res) => {
  const where = ['1=1']; const params = [];
  if (req.query.q) { const l = `%${likeEscape(req.query.q)}%`; where.push('(name LIKE ? OR email LIKE ? OR contact_name LIKE ?)'); params.push(l, l, l); }
  ok(res, { suppliers: await query(`SELECT s.*, (SELECT COUNT(*) FROM product_suppliers WHERE supplier_id=s.id) AS product_count, (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id=s.id) AS order_count FROM suppliers s WHERE ${where.join(' AND ')} ORDER BY s.name`, params) });
};
exports.getSupplier = async (req, res) => {
  const s = await one('SELECT * FROM suppliers WHERE id=?', [req.params.id]);
  if (!s) throw new ApiError(404, 'Fournisseur introuvable');
  const [products, pos] = await Promise.all([
    query('SELECT ps.product_id, ps.supplier_sku, ps.cost_price, p.name, p.sku FROM product_suppliers ps JOIN products p ON p.id=ps.product_id WHERE ps.supplier_id=?', [s.id]),
    query(`SELECT po.id, po.reference, po.status, po.created_at, po.received_at, (SELECT COALESCE(SUM(quantity*unit_cost),0) FROM purchase_order_items WHERE purchase_order_id=po.id) AS total FROM purchase_orders po WHERE po.supplier_id=? ORDER BY po.id DESC`, [s.id]),
  ]);
  ok(res, { supplier: s, products, purchaseOrders: pos });
};
exports.saveSupplier = async (req, res) => {
  const b = req.body; const id = req.params.id ? Number(req.params.id) : null;
  const vals = [b.name, b.contact_name, b.email, b.phone, b.address, b.notes, b.is_active === 0 ? 0 : 1];
  if (id) await query('UPDATE suppliers SET name=?, contact_name=?, email=?, phone=?, address=?, notes=?, is_active=? WHERE id=?', [...vals, id]);
  else req.params.id = (await query('INSERT INTO suppliers (name, contact_name, email, phone, address, notes, is_active) VALUES (?,?,?,?,?,?,?)', vals)).insertId;
  await audit(req, id ? 'supplier.update' : 'supplier.create', 'supplier', req.params.id);
  ok(res, { id: Number(req.params.id) }, id ? 200 : 201);
};
exports.deleteSupplier = async (req, res) => {
  const n = await one('SELECT COUNT(*) AS n FROM purchase_orders WHERE supplier_id=?', [req.params.id]);
  if (n.n) { await query('UPDATE suppliers SET is_active=0 WHERE id=?', [req.params.id]); await audit(req, 'supplier.disable', 'supplier', req.params.id); return ok(res, { disabled: true, message: 'Fournisseur ayant un historique d\'achats : désactivé.' }); }
  await query('DELETE FROM suppliers WHERE id=?', [req.params.id]);
  await audit(req, 'supplier.delete', 'supplier', req.params.id);
  ok(res, { deleted: true });
};
exports.linkProduct = async (req, res) => {
  const { productId, supplier_sku, cost_price } = req.body;
  if (!productId) throw new ApiError(422, 'Produit requis');
  await query('INSERT INTO product_suppliers (product_id, supplier_id, supplier_sku, cost_price) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE supplier_sku=VALUES(supplier_sku), cost_price=VALUES(cost_price)', [productId, req.params.id, supplier_sku || null, cost_price ?? null]);
  ok(res, { ok: true }, 201);
};
exports.unlinkProduct = async (req, res) => { await query('DELETE FROM product_suppliers WHERE supplier_id=? AND product_id=?', [req.params.id, req.params.productId]); ok(res, { ok: true }); };

/* ------------------------------------------------------------ Approvisionnements */
exports.listPOs = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = ['1=1']; const params = [];
  if (req.query.status) { where.push('po.status=?'); params.push(req.query.status); }
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM purchase_orders po WHERE ${w}`, params)).n;
  const rows = await query(`SELECT po.*, s.name AS supplier_name, (SELECT COALESCE(SUM(quantity*unit_cost),0) FROM purchase_order_items WHERE purchase_order_id=po.id) AS total,
    (SELECT COALESCE(SUM(quantity),0) FROM purchase_order_items WHERE purchase_order_id=po.id) AS qty, (SELECT COALESCE(SUM(received_quantity),0) FROM purchase_order_items WHERE purchase_order_id=po.id) AS received
    FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id WHERE ${w} ORDER BY po.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { purchaseOrders: rows, meta: pageMeta(total, page, limit) });
};
exports.getPO = async (req, res) => {
  const po = await one('SELECT po.*, s.name AS supplier_name FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?', [req.params.id]);
  if (!po) throw new ApiError(404, 'Commande fournisseur introuvable');
  const items = await query('SELECT i.*, p.name, p.sku, v.name AS variant_name FROM purchase_order_items i JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id AND i.variant_id>0 WHERE i.purchase_order_id=?', [po.id]);
  ok(res, { purchaseOrder: po, items });
};
exports.createPO = async (req, res) => {
  const b = req.body;
  const sup = await one('SELECT id FROM suppliers WHERE id=? AND is_active=1', [b.supplier_id]);
  if (!sup) throw new ApiError(422, 'Fournisseur invalide');
  const id = await withTransaction(async (conn) => {
    const r = await query('INSERT INTO purchase_orders (reference, supplier_id, status, notes, expected_at, created_by) VALUES (?,?,?,?,?,?)', [randomCode('PO', 7), b.supplier_id, 'ordered', b.notes, b.expected_at ? new Date(b.expected_at) : null, req.user.id], conn);
    for (const it of b.items) {
      if (!(await one('SELECT id FROM products WHERE id=?', [it.productId], conn))) throw new ApiError(422, `Produit ${it.productId} introuvable`);
      await query('INSERT INTO purchase_order_items (purchase_order_id, product_id, variant_id, quantity, unit_cost) VALUES (?,?,?,?,?)', [r.insertId, it.productId, it.variantId, it.quantity, it.unit_cost], conn);
    }
    return r.insertId;
  });
  await audit(req, 'purchase_order.create', 'purchase_order', id);
  ok(res, { id }, 201);
};
/** Réception de marchandises : entrée de stock + mise à jour du statut. */
exports.receivePO = async (req, res) => {
  const poId = Number(req.params.id);
  const status = await withTransaction(async (conn) => {
    const po = await one('SELECT * FROM purchase_orders WHERE id=? FOR UPDATE', [poId], conn);
    if (!po) throw new ApiError(404, 'Commande fournisseur introuvable');
    if (['received', 'cancelled'].includes(po.status)) throw new ApiError(409, 'Cette commande est déjà clôturée');
    for (const r of req.body.items) {
      const it = await one('SELECT i.*, p.name FROM purchase_order_items i JOIN products p ON p.id=i.product_id WHERE i.id=? AND i.purchase_order_id=? FOR UPDATE', [r.itemId, poId], conn);
      if (!it) throw new ApiError(422, 'Ligne introuvable');
      if (it.received_quantity + r.quantity > it.quantity) throw new ApiError(422, `Quantité reçue supérieure à la quantité commandée pour « ${it.name} »`);
      await query('UPDATE purchase_order_items SET received_quantity=received_quantity+? WHERE id=?', [r.quantity, it.id], conn);
      await adjustStock(conn, { productId: it.product_id, variantId: it.variant_id, delta: r.quantity, type: 'purchase', refType: 'purchase_order', refId: poId, userId: req.user.id, note: `Réception ${po.reference}` });
    }
    const sums = await one('SELECT SUM(quantity) AS q, SUM(received_quantity) AS r FROM purchase_order_items WHERE purchase_order_id=?', [poId], conn);
    const st = Number(sums.r) >= Number(sums.q) ? 'received' : 'partial';
    await query('UPDATE purchase_orders SET status=?, received_at=IF(?="received", NOW(), received_at) WHERE id=?', [st, st, poId], conn);
    return st;
  });
  await audit(req, 'purchase_order.receive', 'purchase_order', poId, { status });
  ok(res, { status });
};
exports.cancelPO = async (req, res) => {
  const po = await one('SELECT status FROM purchase_orders WHERE id=?', [req.params.id]);
  if (!po) throw new ApiError(404, 'Introuvable');
  if (po.status !== 'ordered' && po.status !== 'draft') throw new ApiError(409, 'Seules les commandes sans réception peuvent être annulées');
  await query("UPDATE purchase_orders SET status='cancelled' WHERE id=?", [req.params.id]);
  await audit(req, 'purchase_order.cancel', 'purchase_order', req.params.id);
  ok(res, { ok: true });
};
