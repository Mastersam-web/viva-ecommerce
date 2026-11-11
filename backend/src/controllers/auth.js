const bcrypt = require('bcryptjs');
const { query, one, withTransaction } = require('../config/db');
const { env } = require('../config/env');
const { ApiError, ok } = require('../utils/http');
const { randomToken, sha256 } = require('../utils/helpers');
const { setAuthCookie, clearAuthCookie } = require('../middlewares/auth');
const { sendMail, esc } = require('../utils/mailer');
const { audit } = require('../utils/audit');
const { getSetting } = require('../services/settings');

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

const publicUser = (u) => ({
  id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email, phone: u.phone,
  email_verified: !!u.email_verified_at, roles: u.roles || [], permissions: u.permissions || [], isStaff: !!u.isStaff, isAdmin: !!u.isAdmin,
});

async function loadFull(id) {
  const u = await one('SELECT * FROM users WHERE id=?', [id]);
  const rows = await query(
    `SELECT r.code AS role, p.code AS permission FROM user_roles ur JOIN roles r ON r.id=ur.role_id
     LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=?`, [id]);
  u.roles = [...new Set(rows.map((r) => r.role))];
  u.permissions = [...new Set(rows.map((r) => r.permission).filter(Boolean))];
  u.isAdmin = u.roles.includes('admin'); u.isStaff = u.roles.some((r) => r !== 'customer');
  return u;
}

async function sendVerification(user) {
  const token = randomToken();
  await query('DELETE FROM email_verifications WHERE user_id=?', [user.id]);
  await query('INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES (?,?,?)', [user.id, sha256(token), new Date(Date.now() + 48 * 3600 * 1000)]);
  sendMail({
    to: user.email, subject: 'Confirmez votre adresse email - VIVA', title: 'Bienvenue chez VIVA !',
    html: `<p>Bonjour ${esc(user.first_name)}, merci de confirmer votre adresse email.</p>`,
    cta: { url: `${env.frontendUrl}/verification-email?token=${token}`, label: 'Confirmer mon email' },
  });
}

exports.register = async (req, res) => {
  const { first_name, last_name, email, phone, password } = req.body;
  const exists = await one('SELECT id FROM users WHERE email=?', [email]);
  if (exists) throw new ApiError(409, 'Un compte existe déjà avec cet email');
  const hash = await bcrypt.hash(password, 12);
  const id = await withTransaction(async (conn) => {
    const r = await query('INSERT INTO users (first_name,last_name,email,phone,password_hash) VALUES (?,?,?,?,?)', [first_name, last_name, email, phone || null, hash], conn);
    await query("INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code='customer'", [r.insertId], conn);
    return r.insertId;
  });
  const user = await loadFull(id);
  sendVerification(user);
  sendMail({ to: email, subject: 'Bienvenue chez VIVA', title: `Bienvenue ${esc(first_name)} !`, html: '<p>Votre compte a bien été créé. Bonne visite sur notre boutique.</p>', cta: { url: env.frontendUrl, label: 'Visiter la boutique' } });
  require('../utils/notify').notifyStaff(['customers.view', 'users.manage'], { type: 'new_customer', title: 'Nouveau client inscrit', message: `${first_name} ${last_name} · ${email}`, link: '/admin/clients', email: true });
  setAuthCookie(res, user);
  ok(res, { user: publicUser(user) }, 201);
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await one('SELECT * FROM users WHERE email=? AND deleted_at IS NULL', [email]);
  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw new ApiError(429, `Compte temporairement bloqué. Réessayez dans ${mins} min.`);
  }
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valid) {
    if (user) {
      const attempts = user.failed_attempts + 1;
      const lock = attempts >= env.maxLoginAttempts ? new Date(Date.now() + env.lockMinutes * 60000) : null;
      await query('UPDATE users SET failed_attempts=?, locked_until=? WHERE id=?', [lock ? 0 : attempts, lock, user.id]);
      if (lock) await audit({ ...req, user: { id: user.id } }, 'auth.locked', 'user', user.id);
    }
    throw new ApiError(401, 'Email ou mot de passe incorrect');
  }
  if (!user.is_active) throw new ApiError(403, 'Ce compte est désactivé');
  await query('UPDATE users SET failed_attempts=0, locked_until=NULL, last_login_at=NOW() WHERE id=?', [user.id]);
  const full = await loadFull(user.id);
  setAuthCookie(res, full);
  if (full.isStaff) await audit({ ...req, user: { id: full.id } }, 'auth.login', 'user', full.id);
  ok(res, { user: publicUser(full) });
};

exports.logout = (_req, res) => { clearAuthCookie(res); ok(res, { message: 'Déconnecté' }); };
exports.me = (req, res) => ok(res, { user: publicUser(req.user) });

exports.forgotPassword = async (req, res) => {
  const user = await one('SELECT id, first_name, email FROM users WHERE email=? AND is_active=1 AND deleted_at IS NULL', [req.body.email]);
  if (user) {
    const token = randomToken();
    await query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)', [user.id, sha256(token), new Date(Date.now() + 3600 * 1000)]);
    sendMail({
      to: user.email, subject: 'Réinitialisation de votre mot de passe - VIVA', title: 'Mot de passe oublié ?',
      html: `<p>Bonjour ${esc(user.first_name)}, cliquez ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 1 heure.</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
      cta: { url: `${env.frontendUrl}/reinitialiser-mot-de-passe?token=${token}`, label: 'Choisir un nouveau mot de passe' },
    });
  }
  // réponse identique que le compte existe ou non (pas d'énumération)
  ok(res, { message: 'Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé.' });
};

exports.resetPassword = async (req, res) => {
  const row = await one('SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > NOW()', [sha256(req.body.token)]);
  if (!row) throw new ApiError(400, 'Lien invalide ou expiré');
  const hash = await bcrypt.hash(req.body.password, 12);
  await withTransaction(async (conn) => {
    await query('UPDATE users SET password_hash=?, token_version=token_version+1, failed_attempts=0, locked_until=NULL WHERE id=?', [hash, row.user_id], conn);
    await query('UPDATE password_resets SET used_at=NOW() WHERE user_id=? AND used_at IS NULL', [row.user_id], conn);
  });
  await audit({ ...req, user: { id: row.user_id } }, 'auth.password_reset', 'user', row.user_id);
  ok(res, { message: 'Mot de passe modifié. Vous pouvez vous connecter.' });
};

exports.verifyEmail = async (req, res) => {
  const token = String(req.body.token || req.query.token || '');
  const row = await one('SELECT * FROM email_verifications WHERE token_hash=? AND expires_at > NOW()', [sha256(token)]);
  if (!row) throw new ApiError(400, 'Lien invalide ou expiré');
  await query('UPDATE users SET email_verified_at=NOW() WHERE id=?', [row.user_id]);
  await query('DELETE FROM email_verifications WHERE user_id=?', [row.user_id]);
  ok(res, { message: 'Adresse email confirmée' });
};
exports.resendVerification = async (req, res) => {
  if (req.user.email_verified_at) return ok(res, { message: 'Déjà confirmée' });
  await sendVerification(req.user);
  ok(res, { message: 'Email envoyé' });
};

exports.updateProfile = async (req, res) => {
  const { first_name, last_name, phone } = req.body;
  await query('UPDATE users SET first_name=?, last_name=?, phone=? WHERE id=?', [first_name, last_name, phone || null, req.user.id]);
  ok(res, { user: publicUser(await loadFull(req.user.id)) });
};

exports.changePassword = async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id=?', [req.user.id]);
  if (!(await bcrypt.compare(req.body.current_password, u.password_hash))) throw new ApiError(401, 'Mot de passe actuel incorrect');
  const hash = await bcrypt.hash(req.body.new_password, 12);
  await query('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', [hash, u.id]);
  setAuthCookie(res, await loadFull(u.id)); // les autres sessions sont invalidées
  await audit(req, 'auth.password_change', 'user', u.id);
  ok(res, { message: 'Mot de passe modifié' });
};

/** Désactivation du compte (les commandes sont conservées pour la comptabilité). */
exports.deleteAccount = async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id=?', [req.user.id]);
  if (!(await bcrypt.compare(req.body.password, u.password_hash))) throw new ApiError(401, 'Mot de passe incorrect');
  if (req.user.isStaff) throw new ApiError(403, 'Un compte du personnel doit être désactivé par un administrateur');
  const open = await one("SELECT COUNT(*) AS n FROM orders WHERE user_id=? AND status NOT IN ('delivered','completed','cancelled','returned')", [u.id]);
  if (open.n > 0) throw new ApiError(409, 'Vous avez des commandes en cours : suppression impossible pour le moment');
  const anon = `supprime-${u.id}-${Date.now()}@deleted.invalid`;
  await withTransaction(async (conn) => {
    await query("UPDATE users SET is_active=0, deleted_at=NOW(), email=?, phone=NULL, first_name='Compte', last_name='supprimé', token_version=token_version+1 WHERE id=?", [anon, u.id], conn);
    await query('DELETE FROM addresses WHERE user_id=?', [u.id], conn);
    await query('DELETE FROM newsletter_subscribers WHERE email=?', [u.email], conn);
  });
  await audit(req, 'account.deleted', 'user', u.id);
  clearAuthCookie(res);
  ok(res, { message: 'Compte supprimé' });
};

exports.requireVerifiedIfEnabled = async (user) => {
  if ((await getSetting('auth.require_verified_email', 'false')) === 'true' && !user.email_verified_at) {
    throw new ApiError(403, 'Veuillez confirmer votre adresse email avant de commander');
  }
};
exports.publicUser = publicUser;
