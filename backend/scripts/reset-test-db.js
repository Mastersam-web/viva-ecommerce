/* Supprime et recrée la base de TEST (jamais une base dont le nom ne finit pas par _test). */
const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');
(async () => {
  const { database, ...conf } = env.db;
  if (!database.endsWith('_test')) { console.error(`✖ Refus : « ${database} » n'est pas une base de test (nom attendu : *_test).`); process.exit(1); }
  const c = await mysql.createConnection(conf);
  await c.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await c.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await c.end();
})().catch((e) => { console.error('✖', e.message); process.exit(1); });
