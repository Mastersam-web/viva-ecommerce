/* Crée la base (si besoin) puis applique database/schema.sql. Idempotent (CREATE TABLE IF NOT EXISTS). */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');

(async () => {
  const { database, ...conf } = env.db;
  let conn;
  try {
    conn = await mysql.createConnection({ ...conf, multipleStatements: true, charset: 'utf8mb4' });
  } catch (e) {
    console.error(`✖ Connexion MySQL impossible (${conf.host}:${conf.port}) : ${e.message}`); process.exit(1);
  }
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (e) { console.warn(`(i) Création de la base ignorée (${e.code}) : elle doit déjà exister.`); }
  await conn.query(`USE \`${database}\``);
  const sql = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
  await conn.query(sql);
  // Mises à jour de schéma pour les bases créées avec une version antérieure (idempotent)
  const ensureColumn = async (table, column, ddl) => {
    const [r] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', [database, table, column]);
    if (!r[0].n) { await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${column} ${ddl}`); console.log(`  + ${table}.${column}`); }
  };
  await ensureColumn('payments', 'operator', 'VARCHAR(40) NULL');
  await ensureColumn('payments', 'payer_phone', 'VARCHAR(40) NULL');
  await ensureColumn('payments', 'payer_reference', 'VARCHAR(120) NULL');
  await ensureColumn('payments', 'proof_submitted_at', 'DATETIME NULL');
  const [rows] = await conn.query('SHOW TABLES');
  console.log(`✔ Schéma appliqué sur « ${database} » : ${rows.length} tables.`);
  await conn.end();
})().catch((e) => { console.error('✖ Migration échouée :', e.message); process.exit(1); });
