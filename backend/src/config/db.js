const mysql = require('mysql2/promise');
const { env } = require('./env');

const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  decimalNumbers: true, // DECIMAL renvoyés en nombres
  dateStrings: false,
  timezone: 'Z',
  namedPlaceholders: false,
});

pool.on('connection', (c) => c.query("SET time_zone = '+00:00'")); // tout en UTC

/** Exécute une requête paramétrée (protection contre les injections SQL). */
async function query(sql, params = [], conn = pool) {
  const [rows] = await conn.query(sql, params);
  return rows;
}
async function one(sql, params = [], conn = pool) {
  const rows = await query(sql, params, conn);
  return rows[0] || null;
}

/** Transaction : cohérence commande / stock (règle de gestion 17). */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, one, withTransaction };
