const { query, one } = require('../config/db');
const { sendMail, esc } = require('./mailer');
const { env } = require('../config/env');

/**
 * Notification interne + email (SMS : brancher un fournisseur ici si besoin).
 * Ne lève jamais d'exception.
 */
async function notify(userId, { type, title, message, link, email = true }) {
  try {
    await query('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?,?,?,?,?)',
      [userId, type, title, message || null, link || null]);
    if (email) {
      const u = await one('SELECT email, first_name FROM users WHERE id=?', [userId]);
      if (u) {
        sendMail({
          to: u.email, subject: `${title} - VIVA`, title,
          html: `<p>Bonjour ${esc(u.first_name)},</p><p>${esc(message || '')}</p>`,
          cta: link ? { url: `${env.frontendUrl}${link}`, label: 'Voir' } : undefined,
        });
      }
    }
  } catch (e) {
    console.error('[notify] échec', e.message);
  }
}

/**
 * Notifie l'équipe : administrateurs + utilisateurs ayant au moins une des permissions données.
 * Ne lève jamais d'exception.
 */
async function notifyStaff(permissions, { type, title, message, link, email = false }) {
  try {
    const perms = Array.isArray(permissions) ? permissions : [permissions];
    const ph = perms.length ? perms.map(() => '?').join(',') : "''";
    const users = await query(
      `SELECT DISTINCT u.id FROM users u
         JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
         LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id
        WHERE u.is_active=1 AND u.deleted_at IS NULL AND (r.code='admin' OR p.code IN (${ph}))`, perms);
    for (const u of users) await notify(u.id, { type, title, message, link, email });
    return users.length;
  } catch (e) {
    console.error('[notifyStaff] échec', e.message);
    return 0;
  }
}
module.exports = { notify, notifyStaff };
