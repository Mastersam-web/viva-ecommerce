/** Configuration des moyens de paiement, modifiable par l'administrateur (Admin → Paiements → Moyens de paiement). */
const { getSetting, setSetting } = require('./settings');
const { env } = require('../config/env');
const stripe = require('./payments/stripe');

const KEY = 'payment.config';
const METHODS = ['cod', 'card', 'mobile_money', 'bank_transfer'];

const defaults = () => ({
  cod: { enabled: true, label: 'Paiement à la livraison', description: 'Réglez en espèces à la réception de votre colis.' },
  card: { enabled: true, label: 'Carte bancaire', description: 'Paiement sécurisé par carte Visa ou Mastercard. Vos données bancaires ne sont jamais conservées.' },
  mobile_money: {
    enabled: true, label: 'Mobile Money', description: 'Payez depuis votre téléphone avec votre opérateur.',
    operators: [
      { code: 'lumicash', name: 'Lumicash', number: '', account_name: 'VIVA Live Better', instructions: 'Composez *163# → Paiement marchand, saisissez le numéro et le montant exact.' },
      { code: 'ecocash', name: 'EcoCash', number: '', account_name: 'VIVA Live Better', instructions: 'Composez *151# → Paiement marchand, saisissez le numéro et le montant exact.' },
    ],
  },
  bank_transfer: { enabled: true, label: 'Virement bancaire', description: 'Effectuez un virement ; la commande est traitée dès réception des fonds.', details: env.payment.bankDetails || '' },
});

async function getConfig() {
  const def = defaults();
  let saved = {};
  try { saved = JSON.parse((await getSetting(KEY, '')) || '{}'); } catch { saved = {}; }
  const out = {};
  for (const m of METHODS) out[m] = { ...def[m], ...(saved[m] || {}) };
  if (!Array.isArray(out.mobile_money.operators)) out.mobile_money.operators = def.mobile_money.operators;
  return out;
}

async function saveConfig(input) {
  const cur = await getConfig();
  const next = {};
  for (const m of METHODS) next[m] = { ...cur[m], ...(input[m] || {}) };
  await setSetting(KEY, JSON.stringify(next), false);
  return next;
}

/** Opérateurs utilisables : un numéro marchand est requis (sauf en mode test). */
const usableOperators = (cfg) => (cfg.mobile_money.operators || []).filter((o) => o.name && (env.payment.mode === 'sandbox' || o.number));

/** Moyens de paiement proposés au client dans la configuration actuelle. */
async function availableMethods() {
  const cfg = await getConfig();
  const sandbox = env.payment.mode === 'sandbox';
  const list = [];
  if (cfg.cod.enabled) list.push({ code: 'cod', label: cfg.cod.label, description: cfg.cod.description, online: false });
  if (cfg.card.enabled && (sandbox || stripe.enabled())) list.push({ code: 'card', label: cfg.card.label, description: cfg.card.description, online: true });
  if (cfg.mobile_money.enabled && usableOperators(cfg).length) list.push({ code: 'mobile_money', label: cfg.mobile_money.label, description: cfg.mobile_money.description, online: true });
  if (cfg.bank_transfer.enabled && cfg.bank_transfer.details) list.push({ code: 'bank_transfer', label: cfg.bank_transfer.label, description: cfg.bank_transfer.description, online: false });
  return list;
}

module.exports = { getConfig, saveConfig, availableMethods, usableOperators, METHODS };
