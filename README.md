# VIVA LIVE BETTER — Plateforme e-commerce v2.0

Votre frontend d'origine (`viva_live_better_e_commerce_store.html`) converti **à l'identique** en application **Next.js + React**, relié à une API **Node.js / Express** et une base **MySQL**, conformément au cahier des charges.

| Couche | Technologie |
|---|---|
| Frontend | React 18, Next.js 14 (App Router), Tailwind CSS (thème d'origine : pine/sage/accent, Plus Jakarta Sans), Font Awesome |
| Backend | Node.js ≥ 18, Express 4, API REST, validation Zod |
| Base de données | MySQL 8 / MariaDB 10.5+ (46 tables, `backend/database/schema.sql`) |
| Sécurité | JWT en cookie httpOnly, bcrypt (coût 12), RBAC, CSRF, Helmet, rate-limiting, requêtes SQL préparées |
| Documents | PDF (pdfkit) : factures, reçus, bons de livraison, rapports ; Excel (exceljs) |

## Démarrage rapide (≈ 5 minutes)

Prérequis : Node.js 18.18+, MySQL 8 (ou MariaDB). Un utilisateur MySQL avec droit de création de base (ou `docker compose up -d` pour une base prête).

```bash
# 1. Dépendances
npm run install:all

# 2. Configuration
cp backend/.env.example backend/.env       # puis éditez DB_*, JWT_SECRET, ADMIN_PASSWORD
cp frontend/.env.example frontend/.env.local

# 3. Base de données : tables + rôles + catalogue (30 produits d'origine) + administrateur
npm run db:setup
npm run db:seed:demo        # (facultatif) comptes de démonstration

# 4. Lancer (2 terminaux)
npm run dev:api             # API sur http://localhost:4000
npm run dev:web             # Site sur http://localhost:3000
```

- Boutique : <http://localhost:3000> — Administration : <http://localhost:3000/admin>
- Administrateur : `ADMIN_EMAIL` / `ADMIN_PASSWORD` de `backend/.env` (par défaut `admin@vivalivebetter.com` / `ChangeMe!2026` — **à changer**).
- Comptes de démo (mot de passe `Demo!2026pass`) : `client@demo.com`, `produits@demo.com`, `stock@demo.com`, `commandes@demo.com`, `compta@demo.com`, `livreur@demo.com`, `support@demo.com`.

Production : `npm run build`, puis `npm run start:api` et `npm run start:web` (voir `docs/INSTALLATION.md`).

## Fonctionnalités (cahier des charges)

- **Visiteur** : catalogue, fiches produit (variantes, avis, SEO/JSON-LD), recherche, filtres (catégorie, marque, prix, disponibilité), tri, pagination, favoris, suivi de commande par n° + email, contact, FAQ, pages légales, blog, newsletter.
- **Client** : inscription / connexion (**compte obligatoire pour utiliser le panier**), vérification d'email, mot de passe oublié, profil, adresses, tunnel de commande (adresse → livraison → paiement → confirmation), code promo, historique, suivi avec chronologie (statuts modifiés uniquement par l'administrateur, le client est notifié), demande d'annulation, page de paiement dédiée, factures et reçus PDF, retours/remboursements, avis, notifications, service client (tickets).
- **Notifications** : cloche client et administrateur (nouvelle commande, nouveau compte, paiement à vérifier, message de contact, abonné newsletter, etc.).
- **Paiements** : à la livraison, carte, Mobile Money (opérateurs configurables), virement, avec vérification/rejet par l'administrateur ; mode `sandbox` ou Stripe ; webhooks signés et idempotents ; remboursements ; annulation automatique des commandes non payées.
- **Back-office** (`/admin`, menu filtré par permissions) : tableau de bord et graphiques, produits (images, variantes, promotions), catégories/marques, commandes (machine à états, remboursement, PDF), paiements, livraisons (zones, tarifs, livreurs), retours, promotions, avis (modération), stocks (mouvements, inventaires, alertes), fournisseurs et approvisionnements, clients, utilisateurs/rôles/permissions, rapports (écran, Excel, PDF), contenu (CMS, bannières, blog), paramètres, service client, journal d'audit.
- **Rôles** : visiteur, client, administrateur, gestionnaire de produits, de stock, de commandes, comptable, livreur, support.

## Ce qui a été conservé / ajouté côté interface

Le design (couleurs, typographie, composants, textes, animations, tiroirs panier/favoris, menu mobile) est repris tel quel. Les écrans que le cahier des charges exigeait mais que le HTML d'origine n'avait pas (connexion, panier, commande, compte, administration, filtres/tri/pagination de la boutique) réutilisent exactement les mêmes classes et composants visuels.

## Points d'attention

1. **ORM** : le cahier des charges recommande Prisma ou Sequelize ; le projet utilise `mysql2` avec requêtes préparées et transactions (`SELECT … FOR UPDATE` pour le stock). Les performances et la sécurité sont équivalentes ; le schéma SQL reste la référence.
2. **Panier** : il démarre vide (le HTML d'origine contenait 2 articles de démonstration).
3. **Paiements** : en `PAYMENT_MODE=sandbox` aucun argent n'est prélevé. Pour la production, voir `docs/PAIEMENTS.md` (Stripe prêt ; Mobile Money : brancher l'opérateur choisi).
4. **Textes légaux** (CGV, confidentialité, mentions) : modèles à faire valider par un juriste et à adapter dans Admin → Contenu.
5. **Emails** : sans `SMTP_HOST`, les emails s'affichent dans la console de l'API.
6. **Images** : les produits d'origine pointent vers Unsplash ; vos propres images se téléversent dans Admin → Produits (dossier `backend/uploads`, à sauvegarder).

## Documentation

`docs/INSTALLATION.md` (installation, production, sauvegardes) · `docs/API.md` (151 routes) · `docs/BASE_DE_DONNEES.md` · `docs/PAIEMENTS.md` · `docs/GUIDE_UTILISATEUR.md` · `docs/TESTS.md`
