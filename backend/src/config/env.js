require('dotenv').config();

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const isProd = process.env.NODE_ENV === 'production';

const env = {
  isProd,
  port: num(process.env.PORT, 4000),
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''),
  apiPublicUrl: (process.env.API_PUBLIC_URL || 'http://localhost:3000/api').replace(/\/$/, ''),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: num(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'viva_live_better',
  },
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || isProd,
  maxLoginAttempts: num(process.env.MAX_LOGIN_ATTEMPTS, 5),
  lockMinutes: num(process.env.LOCK_MINUTES, 15),
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@vivalivebetter.com',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe!2026',
    firstName: process.env.ADMIN_FIRST_NAME || 'Admin',
    lastName: process.env.ADMIN_LAST_NAME || 'VIVA',
  },
  currency: process.env.CURRENCY || 'USD',
  freeShippingThreshold: num(process.env.FREE_SHIPPING_THRESHOLD, 49),
  taxRate: num(process.env.TAX_RATE, 0),
  paymentTimeoutMin: num(process.env.PAYMENT_TIMEOUT_MIN, 120),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'VIVA Live Better <no-reply@vivalivebetter.com>',
  },
  payment: {
    mode: process.env.PAYMENT_MODE || 'sandbox',
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
    stripeKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    bankDetails: process.env.BANK_TRANSFER_DETAILS || '',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxMb: num(process.env.MAX_UPLOAD_MB, 5),
  },
};

function assertSecure() {
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET manquant ou trop court (32 caractères minimum). Voir .env.example');
  }
  if (isProd) {
    if (env.jwtSecret.startsWith('change_me')) throw new Error('JWT_SECRET doit être changé en production');
    if (env.payment.mode === 'sandbox') console.warn('[ATTENTION] PAYMENT_MODE=sandbox en production : les paiements sont simulés !');
  }
}

module.exports = { env, assertSecure };
