# Documentation de l'API REST

Base : `/api` (le frontend Next.js proxifie `/api/*` vers Express, port 4000). Format JSON, erreurs : `{ "error": "message", "details": [...] }`.

**Authentification** : cookie httpOnly `viva_token` (JWT) posé par `POST /api/auth/login`. Les requêtes d'écriture (POST/PUT/PATCH/DELETE) doivent porter l'en-tête `X-Requested-With: XMLHttpRequest` (protection CSRF). Les webhooks de paiement en sont exemptés mais vérifient une signature.

**Pagination** : `?page=1&limit=20` → `{ ..., meta: { total, page, limit, pages } }`.

| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/health` | Public |
| GET | `/api/settings` | Public |
| GET | `/api/categories` | Public |
| GET | `/api/brands` | Public |
| GET | `/api/products` | Public |
| GET | `/api/products/:slug` | Public |
| GET | `/api/products/:id/reviews` | Public |
| GET | `/api/content/:name` | Public |
| GET | `/api/posts` | Public |
| GET | `/api/posts/:slug` | Public |
| GET | `/api/shipping/methods` | Public |
| POST | `/api/newsletter` | Public |
| POST | `/api/support/tickets` | Public (session optionnelle) |
| GET | `/api/newsletter/unsubscribe` | Public (lien signé) |
| GET | `/api/orders/track` | Public |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | Public |
| GET | `/api/auth/me` | Connecté |
| POST | `/api/auth/forgot-password` | Public |
| POST | `/api/auth/reset-password` | Public |
| POST | `/api/auth/verify-email` | Public |
| POST | `/api/auth/resend-verification` | Connecté |
| PUT | `/api/account/profile` | Connecté |
| PUT | `/api/account/password` | Connecté |
| POST | `/api/account/delete` | Connecté |
| GET | `/api/cart` | Connecté |
| PUT | `/api/cart` | Connecté |
| GET | `/api/account/addresses` | Connecté |
| POST | `/api/account/addresses` | Connecté |
| PUT | `/api/account/addresses/:id` | Connecté |
| DELETE | `/api/account/addresses/:id` | Connecté |
| POST | `/api/orders` | Connecté |
| GET | `/api/orders` | Connecté |
| GET | `/api/orders/:id` | Connecté |
| POST | `/api/cart/quote` | Connecté (le panier exige un compte) |
| POST | `/api/orders/:id/cancel-request` | Connecté (demande d'annulation ; seul l'administrateur change le statut) |
| POST | `/api/orders/:id/pay` | Connecté (changer de moyen de paiement) |
| GET | `/api/orders/:id/payment` | Connecté (contexte de paiement) |
| POST | `/api/orders/:id/payment/card` | Connecté (carte, mode test) |
| POST | `/api/orders/:id/payment/stripe` | Connecté |
| POST | `/api/orders/:id/payment/mobile` | Connecté |
| POST | `/api/orders/:id/payment/mobile/sandbox` | Connecté (mode test) |
| POST | `/api/orders/:id/payment/proof` | Connecté (preuve Mobile Money / virement) |
| GET | `/api/notifications/unread-count` | Connecté |
| GET | `/api/orders/:id/tracking` | Connecté |
| GET | `/api/orders/:id/invoice.pdf` | Connecté |
| GET | `/api/orders/:id/receipt.pdf` | Connecté |
| GET | `/api/account/invoices` | Connecté |
| GET | `/api/wishlist` | Connecté |
| GET | `/api/wishlist/ids` | Connecté |
| POST | `/api/wishlist/:id` | Connecté |
| DELETE | `/api/wishlist/:id` | Connecté |
| POST | `/api/products/:id/reviews` | Connecté |
| DELETE | `/api/products/:id/reviews` | Connecté |
| GET | `/api/account/reviews` | Connecté |
| POST | `/api/returns` | Connecté |
| GET | `/api/returns` | Connecté |
| GET | `/api/notifications` | Connecté |
| POST | `/api/notifications/read-all` | Connecté |
| POST | `/api/notifications/:id/read` | Connecté |
| GET | `/api/support/tickets` | Connecté |
| GET | `/api/support/tickets/:id` | Connecté |
| POST | `/api/support/tickets/:id/reply` | Connecté |
| GET | `/api/admin/dashboard` | Permission : dashboard.view |
| POST | `/api/admin/upload` | Permission : products.manage ou content.manage |
| GET | `/api/admin/products` | Permission : products.manage ou stock.view ou orders.view |
| POST | `/api/admin/products` | Permission : products.manage |
| GET | `/api/admin/products/:id` | Permission : products.manage ou stock.view |
| PUT | `/api/admin/products/:id` | Permission : products.manage |
| PATCH | `/api/admin/products/:id/status` | Permission : products.manage |
| DELETE | `/api/admin/products/:id` | Permission : products.manage |
| GET | `/api/admin/categories` | Permission : categories.manage ou products.manage |
| POST | `/api/admin/categories` | Permission : categories.manage |
| PUT | `/api/admin/categories/:id` | Permission : categories.manage |
| DELETE | `/api/admin/categories/:id` | Permission : categories.manage |
| GET | `/api/admin/brands` | Permission : categories.manage ou products.manage |
| POST | `/api/admin/brands` | Permission : categories.manage |
| PUT | `/api/admin/brands/:id` | Permission : categories.manage |
| DELETE | `/api/admin/brands/:id` | Permission : categories.manage |
| GET | `/api/admin/orders` | Permission : orders.view ou orders.manage |
| GET | `/api/admin/orders/:id` | Permission : orders.view ou orders.manage |
| PATCH | `/api/admin/orders/:id/status` | Permission : orders.manage |
| GET | `/api/admin/orders/:id/invoice.pdf` | Permission : orders.view ou orders.manage ou payments.view |
| GET | `/api/admin/orders/:id/slip.pdf` | Permission : orders.view ou orders.manage |
| GET | `/api/admin/orders/:id/receipt.pdf` | Permission : orders.view ou payments.view |
| GET | `/api/admin/payments` | Permission : payments.view ou payments.manage |
| GET | `/api/admin/payments/transactions` | Permission : payments.view ou payments.manage |
| GET | `/api/admin/payments/:id/transactions` | Permission : payments.view ou payments.manage |
| POST | `/api/admin/payments/:id/confirm` | Permission : payments.manage |
| POST | `/api/admin/refunds` | Permission : payments.manage |
| GET | `/api/admin/refunds` | Permission : payments.view ou payments.manage |
| GET | `/api/admin/shipping/zones` | Permission : shipments.manage ou settings.manage |
| POST | `/api/admin/shipping/zones` | Permission : shipments.manage ou settings.manage |
| PUT | `/api/admin/shipping/zones/:id` | Permission : shipments.manage ou settings.manage |
| DELETE | `/api/admin/shipping/zones/:id` | Permission : shipments.manage ou settings.manage |
| POST | `/api/admin/shipping/methods` | Permission : shipments.manage ou settings.manage |
| PUT | `/api/admin/shipping/methods/:id` | Permission : shipments.manage ou settings.manage |
| DELETE | `/api/admin/shipping/methods/:id` | Permission : shipments.manage ou settings.manage |
| GET | `/api/admin/shipments` | Permission : shipments.manage ou deliveries.own ou orders.view |
| GET | `/api/admin/couriers` | Permission : shipments.manage |
| PATCH | `/api/admin/shipments/:id/courier` | Permission : shipments.manage |
| PATCH | `/api/admin/shipments/:id/status` | Permission : shipments.manage ou deliveries.own |
| GET | `/api/admin/returns` | Permission : returns.manage ou orders.manage |
| PATCH | `/api/admin/returns/:id` | Permission : returns.manage ou orders.manage |
| GET | `/api/admin/coupons` | Permission : coupons.manage |
| POST | `/api/admin/coupons` | Permission : coupons.manage |
| PUT | `/api/admin/coupons/:id` | Permission : coupons.manage |
| DELETE | `/api/admin/coupons/:id` | Permission : coupons.manage |
| GET | `/api/admin/reviews` | Permission : reviews.moderate |
| PATCH | `/api/admin/reviews/:id` | Permission : reviews.moderate |
| DELETE | `/api/admin/reviews/:id` | Permission : reviews.moderate |
| GET | `/api/admin/stock` | Permission : stock.view ou stock.manage |
| GET | `/api/admin/stock/alerts` | Permission : stock.view ou stock.manage ou dashboard.view |
| GET | `/api/admin/stock/movements` | Permission : stock.view ou stock.manage |
| POST | `/api/admin/stock/move` | Permission : stock.manage |
| POST | `/api/admin/stock/inventory` | Permission : stock.manage |
| PATCH | `/api/admin/stock/:id/threshold` | Permission : stock.manage |
| GET | `/api/admin/suppliers` | Permission : suppliers.manage ou stock.manage |
| GET | `/api/admin/suppliers/:id` | Permission : suppliers.manage ou stock.manage |
| POST | `/api/admin/suppliers` | Permission : suppliers.manage |
| PUT | `/api/admin/suppliers/:id` | Permission : suppliers.manage |
| DELETE | `/api/admin/suppliers/:id` | Permission : suppliers.manage |
| POST | `/api/admin/suppliers/:id/products` | Permission : suppliers.manage |
| DELETE | `/api/admin/suppliers/:id/products/:productId` | Permission : suppliers.manage |
| GET | `/api/admin/purchase-orders` | Permission : suppliers.manage ou stock.manage |
| GET | `/api/admin/purchase-orders/:id` | Permission : suppliers.manage ou stock.manage |
| POST | `/api/admin/purchase-orders` | Permission : suppliers.manage ou stock.manage |
| POST | `/api/admin/purchase-orders/:id/receive` | Permission : stock.manage |
| POST | `/api/admin/purchase-orders/:id/cancel` | Permission : suppliers.manage ou stock.manage |
| GET | `/api/admin/customers` | Permission : customers.view ou users.manage ou support.manage |
| GET | `/api/admin/customers/:id` | Permission : customers.view ou users.manage ou support.manage |
| GET | `/api/admin/users` | Permission : users.manage |
| GET | `/api/admin/users/:id` | Permission : users.manage |
| POST | `/api/admin/users` | Permission : users.manage |
| PUT | `/api/admin/users/:id` | Permission : users.manage |
| POST | `/api/admin/users/:id/reset-access` | Permission : users.manage |
| GET | `/api/admin/roles` | Permission : roles.manage ou users.manage |
| POST | `/api/admin/roles` | Permission : roles.manage |
| PUT | `/api/admin/roles/:id` | Permission : roles.manage |
| DELETE | `/api/admin/roles/:id` | Permission : roles.manage |
| GET | `/api/admin/reports` | Permission : reports.view |
| GET | `/api/admin/reports/:type` | Permission : reports.view |
| GET | `/api/admin/settings` | Permission : settings.manage |
| PUT | `/api/admin/settings` | Permission : settings.manage |
| GET | `/api/admin/content` | Permission : content.manage |
| GET | `/api/admin/content/:name` | Permission : content.manage |
| PUT | `/api/admin/content/:name` | Permission : content.manage |
| GET | `/api/admin/posts` | Permission : content.manage |
| GET | `/api/admin/posts/:id` | Permission : content.manage |
| POST | `/api/admin/posts` | Permission : content.manage |
| PUT | `/api/admin/posts/:id` | Permission : content.manage |
| DELETE | `/api/admin/posts/:id` | Permission : content.manage |
| GET | `/api/admin/support/tickets` | Permission : support.manage |
| GET | `/api/admin/support/tickets/:id` | Permission : support.manage |
| PATCH | `/api/admin/support/tickets/:id` | Permission : support.manage |
| GET | `/api/admin/newsletter` | Permission : support.manage ou content.manage |
| POST | `/api/admin/newsletter/send` | Permission : content.manage |
| DELETE | `/api/admin/newsletter/:id` | Permission : support.manage ou content.manage |
| POST | `/api/admin/payments/:id/reject` | Permission : payments.manage |
| GET | `/api/admin/payment-config` | Permission : payments.manage ou settings.manage |
| PUT | `/api/admin/payment-config` | Permission : payments.manage ou settings.manage |
| GET | `/api/admin/audit-logs` | Permission : audit.view |

Webhooks (corps brut, signature obligatoire) : `POST /api/payments/webhook/mobile-money` (en-tête `x-signature` = HMAC-SHA256 hex du corps avec `PAYMENT_WEBHOOK_SECRET`) et `POST /api/payments/webhook/stripe` (signature Stripe).
