const { query, one } = require('../config/db');
const { env } = require('../config/env');

const DEFAULTS = {
  'store.name': 'VIVA Live Better',
  'store.currency': env.currency,
  'store.default_country': 'FR',
  'store.tax_rate': String(env.taxRate),
  'store.free_shipping_threshold': String(env.freeShippingThreshold),
  'store.contact_email': 'support@vivalivebetter.com',
  'store.contact_phone': '+33 1 23 45 67 89',
  'store.contact_address': '123 Avenue de la République, 75011 Paris, France',
  'store.return_days': '30',
  'store.low_stock_default': '5',
};

async function getSetting(key, fallback = null) {
  const row = await one('SELECT setting_value FROM settings WHERE setting_key=?', [key]);
  if (row && row.setting_value !== null) return row.setting_value;
  return DEFAULTS[key] ?? fallback;
}
async function getNumber(key, fallback = 0) {
  const v = Number(await getSetting(key));
  return Number.isFinite(v) ? v : fallback;
}
async function setSetting(key, value, isPublic) {
  await query(
    `INSERT INTO settings (setting_key, setting_value, is_public) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), is_public=COALESCE(?, is_public)`,
    [key, value, isPublic ? 1 : 0, isPublic === undefined ? null : (isPublic ? 1 : 0)],
  );
}
async function publicSettings() {
  const rows = await query('SELECT setting_key, setting_value FROM settings WHERE is_public=1 AND setting_key NOT LIKE "content.%"');
  const out = {};
  for (const [k, v] of Object.entries(DEFAULTS)) out[k] = v;
  for (const r of rows) out[r.setting_key] = r.setting_value;
  return out;
}
module.exports = { getSetting, getNumber, setSetting, publicSettings, DEFAULTS };
