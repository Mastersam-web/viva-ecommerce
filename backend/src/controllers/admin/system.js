const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { query, one, withTransaction } = require('../../config/db');
const { env } = require('../../config/env');
const { ApiError, ok } = require('../../utils/http');
const { pagination, pageMeta, likeEscape, slugify, randomToken, sha256, round2 } = require('../../utils/helpers');
const { audit } = require('../../utils/audit');
const { setSetting, DEFAULTS } = require('../../services/settings');
const { sendMail, esc } = require('../../utils/mailer');
const { notify } = require('../../utils/notify');
const { sanitizeHtml } = require('../../utils/sanitize');

/* ------------------------------------------------------------ Tableau de bord */
const REVENUE_SQL = "(p.amount - p.refunded_amount)";
exports.dashboard = async (_req, res) => {
  const proofs = (await one("SELECT COUNT(*) AS n FROM payments WHERE status='pending' AND proof_submitted_at IS NOT NULL")).n;
  const [totals, pending, customers, products, outStock, lowStock, today, month, year] = await Promise.all([
    one("SELECT COUNT(*) AS n FROM orders WHERE status<>'cancelled'"),
    one("SELECT COUNT(*) AS n FROM orders WHERE status IN ('pending','confirmed','preparing')"),
    one("SELECT COUNT(*) AS n FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='customer' AND u.deleted_at IS NULL"),
    one("SELECT COUNT(*) AS n FROM products WHERE status='active'"),
    one("SELECT COUNT(*) AS n FROM products p WHERE p.status='active' AND (SELECT COALESCE(SUM(quantity),0) FROM inventories WHERE product_id=p.id)<=0"),
    one("SELECT COUNT(*) AS n FROM inventories i JOIN products p ON p.id=i.product_id WHERE p.status='active' AND i.quantity>0 AND i.quantity<=i.low_stock_threshold"),
    one(`SELECT COALESCE(SUM(${REVENUE_SQL}),0) AS v, COUNT(*) AS n FROM payments p WHERE p.status IN ('paid','partially_refunded','refunded') AND DATE(p.paid_at)=UTC_DATE()`),
    one(`SELECT COALESCE(SUM(${REVENUE_SQL}),0) AS v, COUNT(*) AS n FROM payments p WHERE p.status IN ('paid','partially_refunded','refunded') AND p.paid_at >= DATE_FORMAT(UTC_DATE(), '%Y-%m-01')`),
    one(`SELECT COALESCE(SUM(${REVENUE_SQL}),0) AS v, COUNT(*) AS n FROM payments p WHERE p.status IN ('paid','partially_refunded','refunded') AND p.paid_at >= DATE_FORMAT(UTC_DATE(), '%Y-01-01')`),
  ]);
  const daily = await query(`SELECT DATE(p.paid_at) AS d, SUM(${REVENUE_SQL}) AS revenue, COUNT(*) AS orders FROM payments p WHERE p.status IN ('paid','partially_refunded','refunded') AND p.paid_at >= (UTC_DATE() - INTERVAL 29 DAY) GROUP BY DATE(p.paid_at) ORDER BY d`);
  const monthly = await query(`SELECT DATE_FORMAT(p.paid_at,'%Y-%m') AS m, SUM(${REVENUE_SQL}) AS revenue, COUNT(*) AS orders FROM payments p WHERE p.status IN ('paid','partially_refunded','refunded') AND p.paid_at >= (DATE_FORMAT(UTC_DATE(), '%Y-%m-01') - INTERVAL 11 MONTH) GROUP BY m ORDER BY m`);
  const recent = await query(`SELECT o.id, o.order_number, o.status, o.payment_status, o.grand_total, o.created_at, CONCAT(u.first_name,' ',u.last_name) AS customer FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 8`);
  const top = await query(`SELECT oi.name, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status NOT IN ('cancelled') GROUP BY oi.product_id, oi.name ORDER BY qty DESC LIMIT 5`);
  const byStatus = await query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');
  const revenueTotal = await one(`SELECT COALESCE(SUM(${REVENUE_SQL}),0) AS v FROM payments p WHERE p.status IN ('paid','partially_refunded','refunded')`);
  ok(res, {
    currency: env.currency,
    cards: { orders: totals.n, pendingOrders: pending.n, revenue: Number(revenueTotal.v), customers: customers.n, products: products.n, outOfStock: outStock.n, lowStock: lowStock.n, paymentsToVerify: proofs },
    sales: { today: { revenue: Number(today.v), orders: today.n }, month: { revenue: Number(month.v), orders: month.n }, year: { revenue: Number(year.v), orders: year.n } },
    daily: daily.map((r) => ({ label: new Date(r.d).toISOString().slice(0, 10), revenue: Number(r.revenue), orders: r.orders })),
    monthly: monthly.map((r) => ({ label: r.m, revenue: Number(r.revenue), orders: r.orders })),
    recentOrders: recent, topProducts: top.map((t) => ({ ...t, qty: Number(t.qty), revenue: Number(t.revenue) })), byStatus,
  });
};

/* ------------------------------------------------------------ Rapports (JSON / Excel / PDF) */
function range(q) {
  const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400000);
  const to = q.to ? new Date(new Date(q.to).getTime() + 86400000) : new Date(Date.now() + 86400000);
  return { from, to };
}
const REPORTS = {
  sales: { title: 'Ventes par période', run: async ({ from, to }, q) => {
    const fmt = q.group === 'month' ? '%Y-%m' : '%Y-%m-%d';
    const rows = await query(`SELECT DATE_FORMAT(o.created_at,'${fmt}') AS period, COUNT(*) AS orders, SUM(o.subtotal) AS subtotal, SUM(o.discount_total) AS discounts, SUM(o.shipping_total) AS shipping, SUM(o.grand_total) AS total
      FROM orders o WHERE o.status<>'cancelled' AND o.created_at>=? AND o.created_at<? GROUP BY period ORDER BY period`, [from, to]);
    return { columns: [['period', 'Période'], ['orders', 'Commandes'], ['subtotal', 'Sous-total'], ['discounts', 'Remises'], ['shipping', 'Livraison'], ['total', 'Total']], rows };
  } },
  revenue: { title: 'Revenus encaissés', run: async ({ from, to }) => {
    const rows = await query(`SELECT DATE(p.paid_at) AS date, p.method, COUNT(*) AS payments, SUM(p.amount) AS collected, SUM(p.refunded_amount) AS refunded, SUM(p.amount-p.refunded_amount) AS net FROM payments p WHERE p.status IN ('paid','partially_refunded','refunded') AND p.paid_at>=? AND p.paid_at<? GROUP BY DATE(p.paid_at), p.method ORDER BY date`, [from, to]);
    return { columns: [['date', 'Date'], ['method', 'Moyen'], ['payments', 'Paiements'], ['collected', 'Encaissé'], ['refunded', 'Remboursé'], ['net', 'Net']], rows };
  } },
  orders: { title: 'Liste des commandes', run: async ({ from, to }, q) => {
    const where = ['o.created_at>=? AND o.created_at<?']; const params = [from, to];
    if (q.status) { where.push('o.status=?'); params.push(q.status); }
    const rows = await query(`SELECT o.order_number, o.created_at AS date, CONCAT(u.first_name,' ',u.last_name) AS customer, o.customer_email AS email, o.status, o.payment_status, (SELECT method FROM payments WHERE order_id=o.id ORDER BY id DESC LIMIT 1) AS method, o.subtotal, o.discount_total AS discount, o.shipping_total AS shipping, o.grand_total AS total
      FROM orders o JOIN users u ON u.id=o.user_id WHERE ${where.join(' AND ')} ORDER BY o.id DESC`, params);
    return { columns: [['order_number', 'N° commande'], ['date', 'Date'], ['customer', 'Client'], ['email', 'Email'], ['status', 'Statut'], ['payment_status', 'Paiement'], ['method', 'Moyen'], ['subtotal', 'Sous-total'], ['discount', 'Remise'], ['shipping', 'Livraison'], ['total', 'Total']], rows };
  } },
  'top-products': { title: 'Produits les plus vendus', run: async ({ from, to }) => ({ columns: [['name', 'Produit'], ['sku', 'SKU'], ['qty', 'Quantité'], ['revenue', 'Chiffre d\'affaires']], rows: await query(`SELECT oi.name, oi.sku, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status<>'cancelled' AND o.created_at>=? AND o.created_at<? GROUP BY oi.product_id, oi.sku, oi.name ORDER BY qty DESC LIMIT 100`, [from, to]) }) },
  'worst-products': { title: 'Produits les moins vendus', run: async ({ from, to }) => ({ columns: [['name', 'Produit'], ['sku', 'SKU'], ['qty', 'Quantité vendue'], ['stock', 'Stock']], rows: await query(`SELECT p.name, p.sku, COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.product_id=p.id AND o.status<>'cancelled' AND o.created_at>=? AND o.created_at<?),0) AS qty, (SELECT COALESCE(SUM(quantity),0) FROM inventories WHERE product_id=p.id) AS stock FROM products p WHERE p.status='active' ORDER BY qty ASC, p.name LIMIT 100`, [from, to]) }) },
  stock: { title: 'État des stocks', run: async () => ({ columns: [['name', 'Produit'], ['variant', 'Variante'], ['sku', 'SKU'], ['quantity', 'Quantité'], ['threshold', 'Seuil d\'alerte']], rows: await query(`SELECT p.name, COALESCE(v.name,'') AS variant, COALESCE(v.sku,p.sku) AS sku, i.quantity, i.low_stock_threshold AS threshold FROM inventories i JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id AND i.variant_id>0 WHERE p.status<>'archived' ORDER BY i.quantity ASC, p.name`) }) },
  customers: { title: 'Clients', run: async ({ from, to }) => ({ columns: [['name', 'Client'], ['email', 'Email'], ['phone', 'Téléphone'], ['created_at', 'Inscription'], ['orders', 'Commandes'], ['spent', 'Total dépensé']], rows: await query(`SELECT CONCAT(u.first_name,' ',u.last_name) AS name, u.email, u.phone, u.created_at, COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.payment_status IN ('paid','partially_refunded') THEN o.grand_total END),0) AS spent FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id AND r.code='customer' LEFT JOIN orders o ON o.user_id=u.id WHERE u.deleted_at IS NULL AND u.created_at>=? AND u.created_at<? GROUP BY u.id ORDER BY spent DESC`, [from, to]) }) },
  payments: { title: 'Paiements', run: async ({ from, to }) => ({ columns: [['order_number', 'Commande'], ['method', 'Moyen'], ['status', 'Statut'], ['amount', 'Montant'], ['refunded_amount', 'Remboursé'], ['receipt_number', 'Reçu'], ['paid_at', 'Payé le']], rows: await query('SELECT o.order_number, p.method, p.status, p.amount, p.refunded_amount, p.receipt_number, p.paid_at FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.created_at>=? AND p.created_at<? ORDER BY p.id DESC', [from, to]) }) },
  refunds: { title: 'Remboursements', run: async ({ from, to }) => ({ columns: [['order_number', 'Commande'], ['amount', 'Montant'], ['reason', 'Motif'], ['status', 'Statut'], ['created_at', 'Date']], rows: await query('SELECT o.order_number, r.amount, r.reason, r.status, r.created_at FROM refunds r JOIN orders o ON o.id=r.order_id WHERE r.created_at>=? AND r.created_at<? ORDER BY r.id DESC', [from, to]) }) },
  shipping: { title: 'Frais de livraison', run: async ({ from, to }) => ({ columns: [['method', 'Mode'], ['orders', 'Commandes'], ['fees', 'Frais perçus']], rows: await query(`SELECT COALESCE(o.shipping_method_name,'-') AS method, COUNT(*) AS orders, SUM(o.shipping_total) AS fees FROM orders o WHERE o.status<>'cancelled' AND o.created_at>=? AND o.created_at<? GROUP BY o.shipping_method_name ORDER BY fees DESC`, [from, to]) }) },
};
const cell = (v) => (v instanceof Date ? v.toISOString().slice(0, 19).replace('T', ' ') : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v);

exports.report = async (req, res) => {
  const def = REPORTS[req.params.type];
  if (!def) throw new ApiError(404, 'Rapport inconnu');
  const { columns, rows } = await def.run(range(req.query), req.query);
  const fmt = req.query.format || 'json';
  await audit(req, 'report.export', 'report', req.params.type, { format: fmt });
  const filename = `${req.params.type}-${new Date().toISOString().slice(0, 10)}`;
  if (fmt === 'xlsx') {
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(def.title.slice(0, 30));
    ws.columns = columns.map(([key, header]) => ({ key, header, width: Math.max(14, header.length + 4) }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F382C' } };
    rows.forEach((r) => ws.addRow(Object.fromEntries(columns.map(([k]) => { const v = cell(r[k]); return [k, v === '' ? '' : (typeof r[k] === 'number' ? r[k] : v)]; }))));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    await wb.xlsx.write(res); return res.end();
  }
  if (fmt === 'pdf') {
    const doc = new PDFDocument({ size: 'A4', layout: columns.length > 6 ? 'landscape' : 'portrait', margin: 36 });
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    doc.pipe(res);
    doc.fontSize(16).fillColor('#0f382c').text(`VIVA - ${def.title}`); doc.fontSize(8).fillColor('#666').text(`Généré le ${new Date().toLocaleString('fr-FR')} - ${rows.length} ligne(s)`); doc.moveDown();
    const w = (doc.page.width - 72) / columns.length; let y = doc.y;
    const head = () => { doc.rect(36, y - 2, doc.page.width - 72, 16).fill('#e8f0ec'); doc.fillColor('#000').fontSize(7.5).font('Helvetica-Bold'); columns.forEach(([, h], i) => doc.text(h, 38 + i * w, y + 1, { width: w - 4, lineBreak: false })); y += 18; doc.font('Helvetica'); };
    head();
    for (const r of rows) {
      if (y > doc.page.height - 50) { doc.addPage(); y = 40; head(); }
      doc.fillColor('#000').fontSize(7.5); columns.forEach(([k], i) => { const v = r[k]; doc.text(typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : String(cell(v)), 38 + i * w, y, { width: w - 4, height: 10, ellipsis: true, lineBreak: false }); }); y += 13;
    }
    return doc.end();
  }
  ok(res, { title: def.title, columns: columns.map(([key, label]) => ({ key, label })), rows: rows.map((r) => Object.fromEntries(columns.map(([k]) => [k, r[k] instanceof Date ? r[k].toISOString() : r[k]]))) });
};
exports.reportTypes = (_req, res) => ok(res, { reports: Object.entries(REPORTS).map(([key, v]) => ({ key, title: v.title })) });

/* ------------------------------------------------------------ Clients */
exports.listCustomers = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = ["r.code='customer'", 'u.deleted_at IS NULL']; const params = [];
  if (req.query.q) { const l = `%${likeEscape(req.query.q)}%`; where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)'); params.push(l, l, l); }
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(DISTINCT u.id) AS n FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE ${w}`, params)).n;
  const rows = await query(`SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.is_active, u.created_at, u.last_login_at,
    (SELECT COUNT(*) FROM orders WHERE user_id=u.id) AS orders_count,
    (SELECT COALESCE(SUM(grand_total),0) FROM orders WHERE user_id=u.id AND payment_status IN ('paid','partially_refunded')) AS total_spent
    FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE ${w} GROUP BY u.id ORDER BY u.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { customers: rows, meta: pageMeta(total, page, limit) });
};
exports.getCustomer = async (req, res) => {
  const u = await one('SELECT id, first_name, last_name, email, phone, is_active, created_at, last_login_at, email_verified_at FROM users WHERE id=? AND deleted_at IS NULL', [req.params.id]);
  if (!u) throw new ApiError(404, 'Client introuvable');
  const [orders, addresses, logs] = await Promise.all([
    query('SELECT id, order_number, status, payment_status, grand_total, created_at FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 50', [u.id]),
    query('SELECT * FROM addresses WHERE user_id=?', [u.id]),
    query('SELECT action, entity, created_at, ip FROM audit_logs WHERE user_id=? ORDER BY id DESC LIMIT 30', [u.id]),
  ]);
  ok(res, { customer: u, orders, addresses, history: logs });
};

/* ------------------------------------------------------------ Utilisateurs / rôles */
exports.listUsers = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = ['u.deleted_at IS NULL']; const params = [];
  if (req.query.q) { const l = `%${likeEscape(req.query.q)}%`; where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)'); params.push(l, l, l); }
  if (req.query.role) { where.push('EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code=?)'); params.push(req.query.role); }
  if (req.query.staff === '1') where.push("EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code<>'customer')");
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM users u WHERE ${w}`, params)).n;
  const rows = await query(`SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.is_active, u.created_at, u.last_login_at,
    (SELECT GROUP_CONCAT(r.code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id) AS roles FROM users u WHERE ${w} ORDER BY u.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { users: rows.map((r) => ({ ...r, roles: r.roles ? r.roles.split(',') : [] })), meta: pageMeta(total, page, limit) });
};
exports.getUser = async (req, res) => {
  const u = await one('SELECT id, first_name, last_name, email, phone, is_active, created_at, last_login_at FROM users WHERE id=? AND deleted_at IS NULL', [req.params.id]);
  if (!u) throw new ApiError(404, 'Utilisateur introuvable');
  u.roleIds = (await query('SELECT role_id FROM user_roles WHERE user_id=?', [u.id])).map((r) => r.role_id);
  const history = await query('SELECT action, entity, entity_id, ip, created_at FROM audit_logs WHERE user_id=? ORDER BY id DESC LIMIT 50', [u.id]);
  ok(res, { user: u, history });
};
async function guardLastAdmin(userId, newRoleIds, active, conn) {
  const admin = await one("SELECT id FROM roles WHERE code='admin'", [], conn);
  const isAdminNow = await one('SELECT 1 AS x FROM user_roles WHERE user_id=? AND role_id=?', [userId, admin.id], conn);
  const stays = newRoleIds ? newRoleIds.includes(admin.id) : true;
  if (isAdminNow && (!stays || active === 0)) {
    const others = await one('SELECT COUNT(*) AS n FROM user_roles ur JOIN users u ON u.id=ur.user_id WHERE ur.role_id=? AND u.is_active=1 AND u.deleted_at IS NULL AND u.id<>?', [admin.id, userId], conn);
    if (!others.n) throw new ApiError(409, 'Impossible : il doit toujours rester au moins un administrateur actif');
  }
}
exports.saveUser = async (req, res) => {
  const b = req.body; const id = req.params.id ? Number(req.params.id) : null;
  const self = id === req.user.id;
  if (self && (b.is_active === 0)) throw new ApiError(409, 'Vous ne pouvez pas désactiver votre propre compte');
  const result = await withTransaction(async (conn) => {
    let uid = id;
    if (id) {
      if (!(await one('SELECT id FROM users WHERE id=? AND deleted_at IS NULL', [id], conn))) throw new ApiError(404, 'Utilisateur introuvable');
      await guardLastAdmin(id, b.roles, b.is_active === 0 ? 0 : 1, conn);
      await query('UPDATE users SET first_name=?, last_name=?, email=?, phone=?, is_active=?, token_version=token_version+IF(?,1,0) WHERE id=?', [b.first_name, b.last_name, b.email, b.phone || null, b.is_active === 0 ? 0 : 1, b.is_active === 0 ? 1 : 0, id], conn);
      if (b.password) await query('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', [await bcrypt.hash(b.password, 12), id], conn);
    } else {
      if (!b.password) throw new ApiError(422, 'Mot de passe requis');
      uid = (await query('INSERT INTO users (first_name,last_name,email,phone,password_hash,is_active,email_verified_at) VALUES (?,?,?,?,?,?,NOW())', [b.first_name, b.last_name, b.email, b.phone || null, await bcrypt.hash(b.password, 12), b.is_active === 0 ? 0 : 1], conn)).insertId;
    }
    if (b.roles) {
      if (self && !b.roles.length) throw new ApiError(409, 'Rôle requis');
      await query('DELETE FROM user_roles WHERE user_id=?', [uid], conn);
      for (const r of b.roles) await query('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', [uid, r], conn);
      await query('UPDATE users SET token_version=token_version+1 WHERE id=?', [uid], conn); // les permissions changent : sessions rafraîchies
    } else if (!id) await query("INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code='customer'", [uid], conn);
    return uid;
  });
  await audit(req, id ? 'user.update' : 'user.create', 'user', result, { email: b.email, roles: b.roles, active: b.is_active });
  ok(res, { id: result }, id ? 200 : 201);
};
exports.resetAccess = async (req, res) => {
  const u = await one('SELECT id, first_name, email FROM users WHERE id=? AND deleted_at IS NULL', [req.params.id]);
  if (!u) throw new ApiError(404, 'Utilisateur introuvable');
  const token = randomToken();
  await query('UPDATE users SET token_version=token_version+1, failed_attempts=0, locked_until=NULL WHERE id=?', [u.id]);
  await query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)', [u.id, sha256(token), new Date(Date.now() + 3600 * 1000)]);
  sendMail({ to: u.email, subject: 'Réinitialisation de votre accès - VIVA', title: 'Réinitialisation de votre accès', html: `<p>Bonjour ${esc(u.first_name)}, un administrateur a demandé la réinitialisation de votre accès. Ce lien expire dans 1 heure.</p>`, cta: { url: `${env.frontendUrl}/reinitialiser-mot-de-passe?token=${token}`, label: 'Choisir un mot de passe' } });
  await audit(req, 'user.reset_access', 'user', u.id);
  ok(res, { message: 'Lien de réinitialisation envoyé à l\'utilisateur. Ses sessions ont été fermées.' });
};
exports.listRoles = async (_req, res) => {
  const roles = await query('SELECT r.*, (SELECT COUNT(*) FROM user_roles WHERE role_id=r.id) AS user_count FROM roles r ORDER BY r.is_system DESC, r.name');
  const rp = await query('SELECT role_id, permission_id FROM role_permissions');
  ok(res, { roles: roles.map((r) => ({ ...r, permissions: rp.filter((x) => x.role_id === r.id).map((x) => x.permission_id) })), permissions: await query('SELECT id, code, description FROM permissions ORDER BY code') });
};
exports.saveRole = async (req, res) => {
  const b = req.body; const id = req.params.id ? Number(req.params.id) : null;
  await withTransaction(async (conn) => {
    let rid = id;
    if (id) {
      const r = await one('SELECT * FROM roles WHERE id=?', [id], conn);
      if (!r) throw new ApiError(404, 'Rôle introuvable');
      if (r.code === 'admin') throw new ApiError(409, 'Le rôle administrateur principal ne peut pas être modifié');
      await query('UPDATE roles SET name=?, description=? WHERE id=?', [b.name, b.description, id], conn);
    } else rid = (await query('INSERT INTO roles (code, name, description, is_system) VALUES (?,?,?,0)', [b.code, b.name, b.description], conn)).insertId;
    await query('DELETE FROM role_permissions WHERE role_id=?', [rid], conn);
    for (const p of b.permissions) await query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?,?)', [rid, p], conn);
    await query('UPDATE users u JOIN user_roles ur ON ur.user_id=u.id SET u.token_version=u.token_version+1 WHERE ur.role_id=?', [rid], conn);
    req.params.id = rid;
  });
  await audit(req, id ? 'role.update' : 'role.create', 'role', req.params.id, { permissions: b.permissions });
  ok(res, { id: Number(req.params.id) }, id ? 200 : 201);
};
exports.deleteRole = async (req, res) => {
  const r = await one('SELECT * FROM roles WHERE id=?', [req.params.id]);
  if (!r) throw new ApiError(404, 'Rôle introuvable');
  if (r.is_system) throw new ApiError(409, 'Un rôle système ne peut pas être supprimé');
  const n = await one('SELECT COUNT(*) AS n FROM user_roles WHERE role_id=?', [r.id]);
  if (n.n) throw new ApiError(409, `Rôle attribué à ${n.n} utilisateur(s)`);
  await query('DELETE FROM roles WHERE id=?', [r.id]);
  await audit(req, 'role.delete', 'role', r.id);
  ok(res, { deleted: true });
};

/* ------------------------------------------------------------ Paramètres & contenu */
const SECRET_FREE = (k) => /^(store|auth|shop|orders)\./.test(k);
exports.getSettings = async (_req, res) => {
  const rows = await query("SELECT setting_key, setting_value, is_public FROM settings WHERE setting_key NOT LIKE 'content.%'");
  const out = { ...DEFAULTS }; for (const r of rows) out[r.setting_key] = r.setting_value;
  out['auth.require_verified_email'] = out['auth.require_verified_email'] ?? 'false';
  out['orders.auto_confirm'] = out['orders.auto_confirm'] ?? 'false';
  ok(res, { settings: out });
};
exports.putSettings = async (req, res) => {
  for (const [k, v] of Object.entries(req.body)) {
    if (!SECRET_FREE(k)) throw new ApiError(422, `Clé non autorisée : ${k}`);
    await setSetting(k, v, k.startsWith('store.'));
  }
  await audit(req, 'settings.update', 'settings', null, req.body);
  ok(res, { ok: true });
};
const CONTENT = ['about', 'contact', 'cgv', 'privacy', 'shipping_policy', 'return_policy', 'legal', 'faq', 'hero', 'banners'];
exports.getContent = async (req, res) => {
  if (!CONTENT.includes(req.params.name)) throw new ApiError(404, 'Contenu inconnu');
  const row = await one('SELECT setting_value, updated_at FROM settings WHERE setting_key=?', [`content.${req.params.name}`]);
  ok(res, { name: req.params.name, value: row?.setting_value ?? '', updatedAt: row?.updated_at ?? null });
};
exports.listContent = async (_req, res) => {
  const rows = await query("SELECT setting_key, updated_at, CHAR_LENGTH(setting_value) AS size FROM settings WHERE setting_key LIKE 'content.%'");
  ok(res, { items: CONTENT.map((n) => ({ name: n, updatedAt: rows.find((r) => r.setting_key === `content.${n}`)?.updated_at || null, filled: !!rows.find((r) => r.setting_key === `content.${n}`)?.size })) });
};
exports.putContent = async (req, res) => {
  if (!CONTENT.includes(req.params.name)) throw new ApiError(404, 'Contenu inconnu');
  if (['hero', 'banners'].includes(req.params.name)) { try { JSON.parse(req.body.value); } catch { throw new ApiError(422, 'JSON invalide'); } }
  const value = ['hero', 'banners', 'faq'].includes(req.params.name) ? req.body.value : sanitizeHtml(req.body.value);
  await setSetting(`content.${req.params.name}`, value, true);
  await audit(req, 'content.update', 'content', req.params.name);
  ok(res, { ok: true });
};
exports.listPosts = async (_req, res) => ok(res, { posts: await query('SELECT id, slug, title, status, published_at, updated_at FROM posts ORDER BY id DESC') });
exports.getPost = async (req, res) => { const p = await one('SELECT * FROM posts WHERE id=?', [req.params.id]); if (!p) throw new ApiError(404, 'Article introuvable'); ok(res, { post: p }); };
exports.savePost = async (req, res) => {
  const b = { ...req.body, content: req.body.content == null ? null : sanitizeHtml(req.body.content) }; const id = req.params.id ? Number(req.params.id) : null;
  let slug = slugify(b.slug || b.title); let i = 1;
  while (await one(`SELECT id FROM posts WHERE slug=? ${id ? 'AND id<>?' : ''}`, id ? [slug, id] : [slug])) { i += 1; slug = `${slugify(b.slug || b.title)}-${i}`; }
  if (id) await query('UPDATE posts SET title=?, slug=?, excerpt=?, content=?, cover_url=?, status=?, published_at=IF(? = "published" AND published_at IS NULL, NOW(), published_at) WHERE id=?', [b.title, slug, b.excerpt, b.content, b.cover_url, b.status, b.status, id]);
  else req.params.id = (await query('INSERT INTO posts (title, slug, excerpt, content, cover_url, status, author_id, published_at) VALUES (?,?,?,?,?,?,?,?)', [b.title, slug, b.excerpt, b.content, b.cover_url, b.status, req.user.id, b.status === 'published' ? new Date() : null])).insertId;
  await audit(req, id ? 'post.update' : 'post.create', 'post', req.params.id);
  ok(res, { id: Number(req.params.id) }, id ? 200 : 201);
};
exports.deletePost = async (req, res) => { await query('DELETE FROM posts WHERE id=?', [req.params.id]); await audit(req, 'post.delete', 'post', req.params.id); ok(res, { deleted: true }); };

/* ------------------------------------------------------------ Support */
exports.listTickets = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = ['1=1']; const params = [];
  if (req.query.status) { where.push('t.status=?'); params.push(req.query.status); }
  if (req.query.type) { where.push('t.type=?'); params.push(req.query.type); }
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM support_tickets t WHERE ${w}`, params)).n;
  const rows = await query(`SELECT t.*, (SELECT COUNT(*) FROM support_messages WHERE ticket_id=t.id) AS messages FROM support_tickets t WHERE ${w} ORDER BY FIELD(t.status,'open','in_progress','resolved','closed'), t.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { tickets: rows, meta: pageMeta(total, page, limit) });
};
exports.getTicket = async (req, res) => {
  const t = await one('SELECT * FROM support_tickets WHERE id=?', [req.params.id]);
  if (!t) throw new ApiError(404, 'Demande introuvable');
  ok(res, { ticket: t, messages: await query('SELECT m.*, CONCAT(u.first_name,\' \',u.last_name) AS author FROM support_messages m LEFT JOIN users u ON u.id=m.user_id WHERE m.ticket_id=? ORDER BY m.id', [t.id]) });
};
exports.updateTicket = async (req, res) => {
  const t = await one('SELECT * FROM support_tickets WHERE id=?', [req.params.id]);
  if (!t) throw new ApiError(404, 'Demande introuvable');
  if (req.body.message) {
    await query('INSERT INTO support_messages (ticket_id, user_id, is_staff, message) VALUES (?,?,1,?)', [t.id, req.user.id, req.body.message]);
    if (t.user_id) notify(t.user_id, { type: 'ticket_reply', title: `Réponse à votre demande ${t.ticket_number}`, message: req.body.message.slice(0, 160), link: '/compte/support', email: false });
    sendMail({ to: t.email, subject: `Réponse à votre demande ${t.ticket_number}`, title: `Demande ${t.ticket_number}`, html: `<p>${esc(req.body.message).replace(/\n/g, '<br>')}</p>` });
    if (!req.body.status && t.status === 'open') await query("UPDATE support_tickets SET status='in_progress' WHERE id=?", [t.id]);
  }
  if (req.body.status) await query('UPDATE support_tickets SET status=? WHERE id=?', [req.body.status, t.id]);
  await audit(req, 'ticket.update', 'ticket', t.id, { status: req.body.status });
  ok(res, { ok: true });
};
exports.sendNewsletter = async (req, res) => {
  const { subject, content } = req.body;
  const subs = await query('SELECT email FROM newsletter_subscribers ORDER BY id');
  if (!subs.length) throw new ApiError(409, "Aucun abonné à qui envoyer la newsletter");
  const { unsubscribeUrl } = require('../catalog');
  const html = sanitizeHtml(content.includes('<') ? content : `<p>${esc(content).replace(/\n/g, '<br>')}</p>`);
  let sent = 0;
  (async () => { // envoi en arrière-plan, par petits lots, pour ne pas bloquer la requête
    for (const sub of subs) {
      await sendMail({ to: sub.email, subject, title: subject, html: `${html}<p style="font-size:11px;color:#888;margin-top:24px">Vous recevez cet email car vous êtes abonné(e) à notre newsletter. <a href="${unsubscribeUrl(sub.email)}">Se désabonner</a></p>` });
      sent++; if (sent % 20 === 0) await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(`[newsletter] « ${subject} » envoyée à ${sent} abonnés`);
  })().catch((e) => console.error('[newsletter]', e.message));
  await audit(req, 'newsletter.send', 'newsletter', null, { subject, recipients: subs.length });
  ok(res, { recipients: subs.length, message: `Newsletter en cours d'envoi à ${subs.length} abonné(s).` }, 202);
};
exports.deleteSubscriber = async (req, res) => { await query('DELETE FROM newsletter_subscribers WHERE id=?', [req.params.id]); ok(res, { ok: true }); };
exports.newsletter = async (_req, res) => ok(res, { subscribers: await query('SELECT id, email, created_at FROM newsletter_subscribers ORDER BY id DESC LIMIT 1000') });

/* ------------------------------------------------------------ Journal d'audit */
exports.auditLogs = async (req, res) => {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 30, maxLimit: 200 });
  const where = ['1=1']; const params = [];
  if (req.query.action) { where.push('a.action LIKE ?'); params.push(`${likeEscape(req.query.action)}%`); }
  if (req.query.user) { where.push('a.user_id=?'); params.push(Number(req.query.user)); }
  if (req.query.entity) { where.push('a.entity=?'); params.push(req.query.entity); }
  const w = where.join(' AND ');
  const total = (await one(`SELECT COUNT(*) AS n FROM audit_logs a WHERE ${w}`, params)).n;
  const rows = await query(`SELECT a.*, CONCAT(u.first_name,' ',u.last_name) AS user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE ${w} ORDER BY a.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  ok(res, { logs: rows, meta: pageMeta(total, page, limit) });
};
