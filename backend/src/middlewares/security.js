const rateLimit = require('express-rate-limit');
const { ApiError } = require('../utils/http');
const { env } = require('../config/env');

const msg = (m) => ({ error: m });
const skipInTest = () => process.env.NODE_ENV === 'test';

const globalLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false, skip: skipInTest, message: msg('Trop de requêtes, réessayez dans un instant') });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, skip: skipInTest, message: msg('Trop de tentatives, réessayez plus tard') });
const strictLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, skip: skipInTest, message: msg('Limite atteinte, réessayez plus tard') });

/**
 * Protection CSRF pour l'authentification par cookie : les requêtes qui modifient des données
 * doivent porter l'en-tête X-Requested-With (non envoyable cross-site sans CORS) et,
 * si présent, un Origin autorisé. Les webhooks (signés) sont exemptés.
 */
function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path.startsWith('/payments/webhook')) return next();
  if (!req.cookies?.viva_token) return next();           // pas de session cookie → pas de risque CSRF
  const origin = req.headers.origin;
  if (origin && origin !== env.frontendUrl && !(env.extraOrigins || []).includes(origin)) {
    return next(new ApiError(403, 'Origine non autorisée'));
  }
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') return next(new ApiError(403, 'En-tête CSRF manquant'));
  next();
}

module.exports = { globalLimiter, authLimiter, strictLimiter, csrfGuard };
