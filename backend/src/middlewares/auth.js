const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { query, one } = require('../config/db');
const { ApiError, asyncHandler } = require('../utils/http');

const COOKIE = 'viva_token';

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, path: '/', maxAge: 7 * 24 * 3600 * 1000 };
}
function signToken(user) {
  return jwt.sign({ sub: user.id, tv: user.token_version }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}
function setAuthCookie(res, user) { res.cookie(COOKIE, signToken(user), cookieOptions()); }
function clearAuthCookie(res) { res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined }); }

async function loadUser(req) {
  let token = req.cookies?.[COOKIE];
  const h = req.headers.authorization;
  if (!token && h?.startsWith('Bearer ')) token = h.slice(7);
  if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, env.jwtSecret); } catch { return null; }
  const user = await one('SELECT id, first_name, last_name, email, phone, is_active, email_verified_at, token_version FROM users WHERE id=? AND deleted_at IS NULL', [payload.sub]);
  if (!user || !user.is_active || user.token_version !== payload.tv) return null;
  const rows = await query(
    `SELECT r.code AS role, p.code AS permission FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = ?`, [user.id]);
  user.roles = [...new Set(rows.map((r) => r.role))];
  user.permissions = [...new Set(rows.map((r) => r.permission).filter(Boolean))];
  user.isAdmin = user.roles.includes('admin');
  user.isStaff = user.roles.some((r) => r !== 'customer');
  return user;
}

/** Authentification obligatoire. */
const authenticate = asyncHandler(async (req, _res, next) => {
  const user = await loadUser(req);
  if (!user) throw new ApiError(401, 'Authentification requise');
  req.user = user;
  next();
});

/** Authentification facultative (visiteur autorisé). */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  req.user = await loadUser(req);
  next();
});

/** Contrôle d'accès par permission (règle 10). L'admin principal a tous les droits. */
const requirePermission = (...perms) => (req, _res, next) => {
  const u = req.user;
  if (!u) return next(new ApiError(401, 'Authentification requise'));
  if (u.isAdmin || perms.some((p) => u.permissions.includes(p))) return next();
  return next(new ApiError(403, 'Accès refusé : permission insuffisante'));
};
const requireRole = (...roles) => (req, _res, next) => {
  const u = req.user;
  if (!u) return next(new ApiError(401, 'Authentification requise'));
  if (u.isAdmin || roles.some((r) => u.roles.includes(r))) return next();
  return next(new ApiError(403, 'Accès refusé'));
};
const requireStaff = (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentification requise'));
  if (!req.user.isStaff) return next(new ApiError(403, 'Espace réservé au personnel'));
  next();
};

module.exports = { authenticate, optionalAuth, requirePermission, requireRole, requireStaff, setAuthCookie, clearAuthCookie, COOKIE };
