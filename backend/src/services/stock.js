const { one, query } = require('../config/db');
const { ApiError } = require('../utils/http');

/**
 * Modifie le stock de façon atomique (verrou de ligne) et journalise le mouvement.
 * delta > 0 : entrée ; delta < 0 : sortie. Refuse un stock négatif (règle 3).
 */
async function adjustStock(conn, { productId, variantId = 0, delta, type, refType = null, refId = null, note = null, userId = null, productName }) {
  let inv = await one('SELECT id, quantity FROM inventories WHERE product_id=? AND variant_id=? FOR UPDATE', [productId, variantId], conn);
  if (!inv) {
    if (delta < 0) throw new ApiError(409, `Stock insuffisant${productName ? ` pour « ${productName} »` : ''}`);
    await query('INSERT INTO inventories (product_id, variant_id, quantity) VALUES (?,?,0)', [productId, variantId], conn);
    inv = { quantity: 0 };
  }
  const newQty = inv.quantity + delta;
  if (newQty < 0) throw new ApiError(409, `Stock insuffisant${productName ? ` pour « ${productName} »` : ''} (disponible : ${inv.quantity})`);
  await query('UPDATE inventories SET quantity=? WHERE product_id=? AND variant_id=?', [newQty, productId, variantId], conn);
  await query(
    'INSERT INTO stock_movements (product_id, variant_id, type, quantity, balance_after, reference_type, reference_id, note, user_id) VALUES (?,?,?,?,?,?,?,?,?)',
    [productId, variantId, type, delta, newQty, refType, refId, note, userId], conn,
  );
  return newQty;
}

/** Remet en stock tous les articles d'une commande (annulation / échec de paiement). */
async function restockOrder(conn, orderId, type = 'cancel', userId = null) {
  const items = await query('SELECT product_id, variant_id, quantity, name FROM order_items WHERE order_id=? AND product_id IS NOT NULL', [orderId], conn);
  for (const it of items) {
    await adjustStock(conn, { productId: it.product_id, variantId: it.variant_id, delta: it.quantity, type, refType: 'order', refId: orderId, userId, note: 'Remise en stock' });
    await query('UPDATE products SET sold_count = GREATEST(sold_count - ?, 0) WHERE id=?', [it.quantity, it.product_id], conn);
  }
}
module.exports = { adjustStock, restockOrder };
