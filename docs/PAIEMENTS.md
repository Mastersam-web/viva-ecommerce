# Paiements

Les moyens de paiement se gèrent dans **Admin → Paiements → Moyens de paiement** (activation, libellés, opérateurs Mobile Money, coordonnées bancaires). Un moyen n'est proposé aux clients que s'il est activé **et** utilisable.

## Parcours
Après la commande, le client arrive sur la page **/commande/paiement** :

| Code | Comportement |
|---|---|
| `cod` | Paiement à la livraison : le livreur marque « livré », ce qui encaisse le paiement. |
| `card` | `sandbox` : formulaire de carte validé côté navigateur (Luhn, expiration, CVC) ; **le numéro n'est jamais envoyé au serveur**. Cartes de test : `4242 4242 4242 4242` (succès), `4000 0000 0000 0002` (refusée), `4000 0000 0000 9995` (fonds insuffisants). En production : Stripe Checkout (`STRIPE_SECRET_KEY`). |
| `mobile_money` | Le client choisit l'opérateur et saisit son numéro ; la page affiche numéro marchand, nom du compte, montant, référence et instructions. `sandbox` : boutons de simulation. En production : il saisit l'identifiant de transaction (preuve) → « en vérification » ; l'administrateur **confirme ou rejette**. Webhook opérateur signé toujours possible. |
| `bank_transfer` | Coordonnées + référence affichées ; le client envoie la référence du virement ; l'administrateur confirme ou rejette. |

Un paiement échoué ou rejeté notifie le client (avec le motif) et lui permet de réessayer ou de changer de moyen de paiement.

## Statuts
Seul l'administrateur modifie le statut d'une commande ; le client est notifié. Par défaut, un paiement confirmé laisse la commande « à confirmer » (réglage `orders.auto_confirm`, désactivé par défaut).

## Garanties techniques
- Montants recalculés côté serveur ; le montant d'un webhook doit égaler celui de la commande.
- Webhooks **idempotents** et **signés** : Mobile Money = HMAC-SHA256 hexadécimal du corps brut dans `x-signature` avec `PAYMENT_WEBHOOK_SECRET` ; Stripe = signature officielle (`STRIPE_WEBHOOK_SECRET`).
- Journal complet dans `payment_transactions` (Admin → Paiements → Journal).
- Remboursements partiels/totaux ; commandes en ligne impayées annulées après `PAYMENT_TIMEOUT_MIN` (sauf preuve en cours de vérification).

## Passer en production
1. `PAYMENT_MODE=live` (les simulations sont alors désactivées).
2. **Carte** : `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, webhook `https://votre-domaine.com/api/payments/webhook/stripe` (`checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_failed`).
3. **Mobile Money** : renseignez dans l'administration le numéro marchand de chaque opérateur (sans numéro, l'opérateur n'est pas proposé). Option : webhook `https://votre-domaine.com/api/payments/webhook/mobile-money` avec `{ "event_id": "...", "reference": "<n° de commande>", "status": "success|failed", "amount": 12.5, "transaction_id": "..." }` et l'en-tête `x-signature`.
4. Testez un paiement réel de faible montant, puis un remboursement.
