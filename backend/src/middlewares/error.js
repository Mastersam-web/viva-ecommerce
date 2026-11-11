const { ZodError } = require('zod');
const { ApiError } = require('../utils/http');
const { env } = require('../config/env');

const notFound = (req, _res, next) => next(new ApiError(404, `Route introuvable : ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(422).json({ error: 'Données invalides', details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cette valeur existe déjà (doublon)' });
  if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'Suppression impossible : élément utilisé ailleurs' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Fichier trop volumineux (max ${env.upload.maxMb} Mo)` });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse' });
  console.error('[erreur]', err);
  res.status(500).json({ error: env.isProd ? 'Erreur interne du serveur' : err.message });
}
module.exports = { notFound, errorHandler };
