const { env, assertSecure } = require('./src/config/env');
assertSecure();
const app = require('./src/app');
const { pool } = require('./src/config/db');
const { expireUnpaidOrders } = require('./src/services/orders');

(async () => {
  try { await pool.query('SELECT 1'); } catch (e) {
    console.error(`\n✖ Connexion MySQL impossible (${env.db.host}:${env.db.port}/${env.db.database}) : ${e.message}\n  → Vérifiez backend/.env puis lancez : npm run db:setup\n`);
    process.exit(1);
  }
  const server = app.listen(env.port, () => console.log(`✔ API VIVA prête sur http://localhost:${env.port}/api  (${env.isProd ? 'production' : 'développement'})`));
  // Annulation automatique des paiements en ligne non réglés (libère le stock)
  const timer = setInterval(() => expireUnpaidOrders().catch((e) => console.error('[expire]', e.message)), 10 * 60 * 1000);
  const stop = () => { clearInterval(timer); server.close(() => pool.end().then(() => process.exit(0))); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})();
