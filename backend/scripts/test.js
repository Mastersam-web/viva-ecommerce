/* npm test : utilise une base dédiée <DB_NAME>_test (créée, migrée, seedée), pour ne jamais toucher à vos données. */
const { spawnSync } = require('child_process');
require('dotenv').config();
const base = process.env.DB_NAME || 'viva_live_better';
const testDb = base.endsWith('_test') ? base : `${base}_test`;
const env = { ...process.env, DB_NAME: testDb, NODE_ENV: 'test' };
const run = (args) => { const r = spawnSync(process.execPath, args, { stdio: 'inherit', env, cwd: __dirname + '/..' }); if (r.status !== 0) process.exit(r.status || 1); };
console.log(`→ Base de test : ${testDb}`);
run(['scripts/reset-test-db.js']); run(['scripts/migrate.js']); run(['scripts/seed.js', '--demo']);
run(['--test', 'tests/e2e.test.js']);
