const crypto = require('crypto');
const { env } = require('../../config/env');
const { ApiError } = require('../../utils/http');

const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const toMinor = (amount, cur) => (ZERO_DECIMAL.has(String(cur).toUpperCase()) ? Math.round(amount) : Math.round(amount * 100));
const fromMinor = (n, cur) => (ZERO_DECIMAL.has(String(cur).toUpperCase()) ? Number(n) : Number(n) / 100);
const enabled = () => !!env.payment.stripeKey;

async function api(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.payment.stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Stripe ${res.status}`);
  return json;
}

async function createCheckoutSession({ order, payment }) {
  return api('checkout/sessions', {
    mode: 'payment',
    success_url: `${env.frontendUrl}/compte/commandes/${order.id}?paiement=ok`,
    cancel_url: `${env.frontendUrl}/compte/commandes/${order.id}?paiement=annule`,
    client_reference_id: order.order_number,
    'metadata[payment_id]': String(payment.id),
    'metadata[order_id]': String(order.id),
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': String(payment.currency).toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(toMinor(payment.amount, payment.currency)),
    'line_items[0][price_data][product_data][name]': `Commande ${order.order_number}`,
  });
}

const refund = ({ paymentIntent, amount, currency }) => api('refunds', { payment_intent: paymentIntent, amount: String(toMinor(amount, currency)) });

/** Vérifie la signature Stripe-Signature (t=...,v1=...) avec tolérance de 5 minutes. */
function verifyWebhook(raw, header) {
  const secret = env.payment.stripeWebhookSecret;
  if (!secret) throw new ApiError(503, 'Webhook Stripe non configuré');
  const parts = Object.fromEntries(String(header || '').split(',').map((p) => p.split('=')));
  if (!parts.t || !parts.v1) throw new ApiError(401, 'Signature manquante');
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw.toString('utf8')}`).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(parts.v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new ApiError(401, 'Signature invalide');
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) throw new ApiError(401, 'Signature expirée');
  return JSON.parse(raw.toString('utf8'));
}

module.exports = { enabled, createCheckoutSession, refund, verifyWebhook, fromMinor, toMinor };
