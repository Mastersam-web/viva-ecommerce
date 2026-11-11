const { query } = require('../config/db');

/** Journalise une action sensible (règle 13). Ne bloque jamais le flux principal. */
async function audit(req, action, entity = null, entityId = null, details = null, conn) {
  try {
    await query(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id, ip, user_agent, details) VALUES (?,?,?,?,?,?,?)',
      [
        req?.user?.id || null, action, entity, entityId != null ? String(entityId) : null,
        req?.ip || null, (req?.headers?.['user-agent'] || '').slice(0, 255),
        details ? JSON.stringify(details).slice(0, 5000) : null,
      ],
      conn,
    );
  } catch (e) {
    console.error('[audit] échec', e.message);
  }
}
module.exports = { audit };
