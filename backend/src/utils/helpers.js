const crypto = require('crypto');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function slugify(str) {
  return String(str)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 150) || 'item';
}

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

function randomCode(prefix, len = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${prefix}-${out}`;
}

function datePart() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}
const orderNumber = () => `VIV-${datePart()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const trackingNumber = () => `TRK${datePart()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function pagination(query, { defaultLimit = 12, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}
const pageMeta = (total, page, limit) => ({ total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });

/** Échappe les jokers LIKE. */
const likeEscape = (s) => String(s).replace(/[\\%_]/g, (m) => `\\${m}`);

const safeJson = (s, fallback = null) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

module.exports = { round2, slugify, sha256, randomToken, randomCode, orderNumber, trackingNumber, timingSafeEqualHex, pagination, pageMeta, likeEscape, safeJson };
