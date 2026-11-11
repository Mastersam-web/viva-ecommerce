# Installation et déploiement

## 1. Prérequis
- Node.js 18.18 ou supérieur (20 LTS recommandé), npm
- MySQL 8.0+ ou MariaDB 10.5+ (`docker compose up -d` à la racine fournit une base de développement)
- Un utilisateur MySQL pouvant créer la base (ou créez-la vous-même : `CREATE DATABASE viva_live_better CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`)

## 2. Installation locale
Voir le README : `npm run install:all`, copie des `.env`, `npm run db:setup`, puis `npm run dev:api` et `npm run dev:web`.

`npm run db:setup` est **idempotent** : relancer ne supprime ni ne duplique rien. Il crée tables, rôles/permissions, catégories, marques, les 30 produits d'origine, zones/modes de livraison, le code `WELCOME10`, les contenus légaux par défaut et le compte administrateur défini par `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## 3. Variables d'environnement

**backend/.env** (modèle commenté : `backend/.env.example`)

| Variable | Rôle |
|---|---|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | Connexion MySQL |
| `JWT_SECRET` | Secret de signature des sessions — **obligatoire et long en production** (l'API refuse de démarrer avec la valeur d'exemple) |
| `FRONTEND_URL`, `API_PUBLIC_URL` | URLs publiques (CORS, liens des emails, retours de paiement) |
| `COOKIE_SECURE` | `true` en HTTPS |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Compte créé par le seed |
| `SMTP_*`, `MAIL_FROM` | Envoi d'emails (sinon affichés dans la console) |
| `PAYMENT_MODE` | `sandbox` (simulation) ou `live` |
| `PAYMENT_WEBHOOK_SECRET`, `STRIPE_*` | Voir `PAIEMENTS.md` |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Images produits |

**frontend/.env.local** : `API_URL` (URL interne de l'API, ex. `http://localhost:4000`) et `NEXT_PUBLIC_SITE_URL` (URL publique, pour sitemap et SEO).

## 4. Mise en production (exemple Linux + Nginx + PM2)

```bash
npm run install:all
# Renseignez backend/.env : NODE_ENV=production, JWT_SECRET fort, COOKIE_SECURE=true,
# PAYMENT_MODE=live, SMTP_*, FRONTEND_URL=https://votre-domaine.com, API_PUBLIC_URL=https://votre-domaine.com/api
npm run db:setup
npm run build
npm i -g pm2
pm2 start "npm run start:api" --name viva-api
pm2 start "npm run start:web" --name viva-web
pm2 save && pm2 startup
```

Nginx (HTTPS via Let's Encrypt/certbot) : tout le trafic vers Next.js (`127.0.0.1:3000`), qui proxifie déjà `/api` et `/uploads` vers l'API.

```nginx
server {
  listen 443 ssl http2;
  server_name votre-domaine.com;
  client_max_body_size 12m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 5. Sauvegardes et maintenance
- Base : `mysqldump --single-transaction viva_live_better > sauvegarde.sql` (quotidien).
- Images : sauvegarder `backend/uploads/`.
- Mises à jour : `git pull`/remplacement des fichiers, `npm run install:all`, `npm run db:migrate`, `npm run build`, `pm2 restart all`.
- Les commandes en ligne non payées sont annulées automatiquement après `PAYMENT_TIMEOUT_MIN` minutes et le stock est restitué.

## 6. Check-list avant ouverture
- [ ] `JWT_SECRET` et mots de passe changés, `ADMIN_PASSWORD` modifié après la première connexion
- [ ] HTTPS actif, `COOKIE_SECURE=true`
- [ ] `PAYMENT_MODE=live` + prestataire de paiement configuré et testé
- [ ] SMTP configuré (vérification d'email, confirmations de commande)
- [ ] Textes légaux relus par un juriste
- [ ] Sauvegardes automatiques en place
