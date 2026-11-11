/* Données de départ : rôles/permissions, administrateur, catalogue VIVA (30 produits), livraison, contenu. Idempotent. */
const bcrypt = require('bcryptjs');
const { pool, query, one } = require('../src/config/db');
const { env } = require('../src/config/env');
const { slugify } = require('../src/utils/helpers');
const { setSetting } = require('../src/services/settings');

const PERMISSIONS = {
  'dashboard.view': 'Voir le tableau de bord', 'products.manage': 'Gérer les produits', 'categories.manage': 'Gérer catégories et marques',
  'orders.view': 'Consulter les commandes', 'orders.manage': 'Gérer les commandes (statuts, annulations)', 'payments.view': 'Consulter les paiements',
  'payments.manage': 'Confirmer / rembourser les paiements', 'shipments.manage': 'Gérer les livraisons et livreurs', 'deliveries.own': 'Gérer ses propres livraisons (livreur)',
  'stock.view': 'Consulter les stocks', 'stock.manage': 'Gérer les stocks (entrées, sorties, inventaires)', 'suppliers.manage': 'Gérer les fournisseurs et approvisionnements',
  'coupons.manage': 'Gérer les promotions', 'reviews.moderate': 'Modérer les avis', 'returns.manage': 'Gérer les retours', 'customers.view': 'Consulter les clients',
  'users.manage': 'Gérer les utilisateurs', 'roles.manage': 'Gérer les rôles et permissions', 'reports.view': 'Rapports et statistiques', 'content.manage': 'Gérer le contenu du site',
  'settings.manage': 'Paramètres du site', 'support.manage': 'Service client', 'audit.view': 'Journal des actions',
};
const ROLES = {
  admin: { name: 'Administrateur principal', desc: 'Accès total', perms: [] },
  product_manager: { name: 'Gestionnaire de produits', desc: 'Catalogue, catégories, avis', perms: ['dashboard.view', 'products.manage', 'categories.manage', 'reviews.moderate', 'stock.view'] },
  stock_manager: { name: 'Gestionnaire de stock', desc: 'Stocks, fournisseurs, approvisionnements', perms: ['dashboard.view', 'stock.view', 'stock.manage', 'suppliers.manage'] },
  order_manager: { name: 'Gestionnaire des commandes', desc: 'Commandes, retours, livraisons', perms: ['dashboard.view', 'orders.view', 'orders.manage', 'returns.manage', 'shipments.manage', 'stock.view'] },
  accountant: { name: 'Comptable', desc: 'Paiements, remboursements, rapports', perms: ['dashboard.view', 'orders.view', 'payments.view', 'payments.manage', 'reports.view', 'customers.view'] },
  courier: { name: 'Livreur', desc: 'Livraisons qui lui sont attribuées', perms: ['deliveries.own'] },
  support: { name: 'Service client', desc: 'Demandes, clients, retours, avis', perms: ['dashboard.view', 'support.manage', 'customers.view', 'orders.view', 'returns.manage', 'reviews.moderate'] },
  customer: { name: 'Client', desc: 'Compte client', perms: [] },
};

const CATEGORIES = [
  ['electronics', 'Électronique', 'tv'], ['fashion', 'Mode & Vêtements', 'shirt'], ['home', 'Maison & Déco', 'house'],
  ['beauty', 'Beauté & Soins', 'pump-soap'], ['sports', 'Sports & Loisirs', 'basketball'], ['toys', 'Jouets & Enfants', 'child-reaching'],
];
const U = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=500&q=80`;
// [id, cat, nom, prix, ancien prix, note, avis, photo]
const PRODUCTS = [
  [101, 'electronics', 'Casque Réducteur de Bruit', 79.99, 99.99, 5, 2354, '1505740420928-5e560c06d30e'],
  [102, 'electronics', 'Montre Connectée Sport Pro', 129.00, 159.00, 4.8, 1120, '1523275335684-37898b6baf30'],
  [103, 'electronics', 'Enceinte Bluetooth Waterproof', 45.50, 60.00, 4.7, 890, '1545454675-3531b543be5d'],
  [104, 'electronics', 'Écouteurs Sans Fil True Wireless', 39.99, 59.99, 4.6, 1540, '1590658268037-6bf12165a8df'],
  [105, 'electronics', 'Appareil Photo Rétro Compact', 199.99, 249.99, 4.9, 670, '1526170375885-4d8ecf77b99f'],
  [201, 'fashion', 'Chemise Décontractée en Lin', 33.89, 45.99, 4.5, 812, '1596755094514-f87e34085b2c'],
  [202, 'fashion', 'Sac à Dos Urban Premium', 39.99, 59.99, 4.9, 1750, '1553062407-98eeb64c6a62'],
  [203, 'fashion', "Veste d'Hiver Minimaliste", 89.99, 120.00, 4.8, 540, '1544441893-675973e31985'],
  [204, 'fashion', 'Lunettes de Soleil Polarisées', 24.99, 35.00, 4.7, 930, '1511499767150-a48a237f0083'],
  [205, 'fashion', 'Baskets White Street Style', 64.99, 85.00, 4.8, 1210, '1560769629-975ec94e6a86'],
  [301, 'home', 'Cafetière Compacte Espresso', 49.20, 69.99, 4.4, 942, '1517668808822-9e428824603b'],
  [302, 'home', 'Fauteuil Design Nordique', 149.00, 199.00, 4.9, 430, '1586023492125-27b2c045efd7'],
  [303, 'home', 'Lampe de Table Céramique', 35.00, 50.00, 4.6, 310, '1507473885765-e6ed057f782c'],
  [304, 'home', "Diffuseur d'Huiles Essentielles", 29.99, 40.00, 4.7, 1150, '1608571423902-eed4a5ad8108'],
  [305, 'home', 'Set de Tasses Artisanales', 22.50, 30.00, 4.8, 520, '1514432324607-a09d9b4aefdd'],
  [401, 'beauty', 'Sérum Éclat Niacinamide', 14.89, 19.99, 5, 1418, '1620916566398-39f1143ab7be'],
  [402, 'beauty', 'Crème Hydratante Bio', 22.00, 30.00, 4.8, 870, '1608248597261-833258657640'],
  [403, 'beauty', 'Huile Visage Régénérante', 28.50, 38.00, 4.9, 620, '1601049541289-9b1b7bbbfe19'],
  [404, 'beauty', 'Coffret Parfum VIVA Botanic', 55.00, 75.00, 4.7, 410, '1592945403244-b3fbafd7f539'],
  [405, 'beauty', 'Brosse Nettoyante Visage', 32.00, 45.00, 4.6, 780, '1522337360788-8b13dee7a37e'],
  [501, 'sports', 'Tapis de Yoga Antidérapant', 29.99, 42.00, 4.8, 920, '1601925260368-ae2f83cf8b7f'],
  [502, 'sports', 'Gourde Isotherme Inox 1L', 18.50, 25.00, 4.9, 1340, '1602143407151-7111542de6e8'],
  [503, 'sports', 'Haltères Ergonomiques (Paire)', 34.99, 50.00, 4.7, 510, '1583454110551-21f2fa2afe61'],
  [504, 'sports', 'Élastiques de Résistance Set', 14.99, 22.00, 4.6, 880, '1598289431512-b97b0917affc'],
  [505, 'sports', 'Sac de Sport Polyvalent', 38.00, 55.00, 4.8, 430, '1553062407-98eeb64c6a62'],
  [601, 'toys', 'Ours en Peluche Douceur', 19.99, 28.00, 4.9, 670, '1559454403-b8fb88521f11'],
  [602, 'toys', 'Jeu de Construction en Bois', 29.50, 40.00, 4.8, 420, '1587654780291-39c9404d746b'],
  [603, 'toys', 'Puzzle Éducatif Univers', 15.00, 20.00, 4.7, 310, '1618842676088-c4d48a6a7c9d'],
  [604, 'toys', 'Voiture Télécommandée', 35.99, 50.00, 4.6, 590, '1594787318286-3d835c1d207f'],
  [605, 'toys', 'Set de Peinture Écologique', 18.00, 24.00, 4.9, 280, '1513364776144-60967b0f800f'],
];

const CGV = `<h2>1. Objet</h2><p>Les présentes conditions générales de vente régissent les ventes effectuées sur la boutique VIVA Live Better.</p><h2>2. Prix</h2><p>Les prix sont indiqués en dollars US, toutes taxes comprises le cas échéant. VIVA se réserve le droit de modifier ses prix à tout moment ; les produits sont facturés au prix en vigueur lors de la validation de la commande.</p><h2>3. Commande</h2><p>La commande est validée après confirmation du paiement (ou à la livraison pour le paiement à la réception). Un email de confirmation est envoyé au client.</p><h2>4. Paiement</h2><p>Paiement par carte bancaire via un prestataire agréé, Mobile Money, virement bancaire ou à la livraison. Aucune donnée de carte n'est conservée par VIVA.</p><h2>5. Livraison</h2><p>Voir la politique de livraison. Livraison gratuite dès 49 $ d'achat.</p><h2>6. Retours et remboursements</h2><p>Voir la politique de retour. Retours faciles sous 30 jours.</p><h2>7. Données personnelles</h2><p>Voir la politique de confidentialité.</p><p><em>Document à faire valider par votre conseil juridique avant mise en production.</em></p>`;
const PRIVACY = `<h2>Données collectées</h2><p>Nom, prénom, email, téléphone, adresses de livraison et historique de commandes, nécessaires à l'exécution de vos achats.</p><h2>Utilisation</h2><p>Traitement des commandes, livraison, service client, et — avec votre accord — envoi d'offres.</p><h2>Sécurité</h2><p>Mots de passe chiffrés, connexions HTTPS, aucune donnée de carte bancaire stockée.</p><h2>Vos droits</h2><p>Accès, rectification, suppression de vos données depuis votre espace « Mon profil » ou en nous contactant à support@vivalivebetter.com.</p><p><em>Document à adapter à la réglementation applicable (RGPD, etc.).</em></p>`;
const SHIPPING = `<h2>Zones et délais</h2><p>France et Europe : 3 à 7 jours ouvrés (Standard), 1 à 3 jours (Express). International : 7 à 14 jours.</p><h2>Frais</h2><p>Livraison gratuite dès 49 $ d'achat (mode Standard). Les frais sont affichés avant la validation de la commande.</p><h2>Suivi</h2><p>Un numéro de suivi est généré pour chaque commande ; suivez-la depuis « Mes commandes » ou la page « Suivre ma commande ».</p><h2>Livraison échouée</h2><p>En cas d'absence, le livreur tente une nouvelle livraison ; sans succès, le colis nous est retourné et vous êtes contacté.</p>`;
const RETURNS = `<h2>Retours faciles sous 30 jours</h2><p>Vous disposez de 30 jours après la livraison pour demander le retour d'un produit depuis « Mes commandes » → « Demander un retour ».</p><h2>Étapes</h2><p>1) Demande avec motif — 2) Validation par notre équipe — 3) Retour du colis — 4) Vérification du produit — 5) Remboursement sur le moyen de paiement d'origine.</p><h2>Conditions</h2><p>Produit en parfait état, dans son emballage d'origine.</p>`;
const LEGAL = `<h2>Éditeur du site</h2><p>VIVA Live Better — 123 Avenue de la République, 75011 Paris, France — support@vivalivebetter.com</p><h2>Hébergement</h2><p>À compléter avec les informations de votre hébergeur.</p><h2>Propriété intellectuelle</h2><p>L'ensemble des contenus (textes, images, logo) est la propriété de VIVA Live Better.</p><p><em>À compléter avec vos informations légales (raison sociale, numéro d'immatriculation, directeur de la publication).</em></p>`;
const FAQ = [
  { q: 'Comment suivre ma commande ?', a: "Depuis votre espace client (Mes commandes) ou via la page « Suivre ma commande » avec votre numéro de commande et votre email." },
  { q: 'Quels moyens de paiement acceptez-vous ?', a: 'Carte bancaire, Mobile Money, virement bancaire et paiement à la livraison.' },
  { q: 'La livraison est-elle gratuite ?', a: "Oui, dès 49 $ d'achat en livraison Standard." },
  { q: 'Puis-je retourner un produit ?', a: "Oui, sous 30 jours après la livraison, depuis votre espace client." },
  { q: 'Comment réinitialiser mon mot de passe ?', a: "Cliquez sur « Mot de passe oublié » sur la page de connexion : un lien vous sera envoyé par email." },
];

async function seedAccess() {
  const permIds = {};
  for (const [code, desc] of Object.entries(PERMISSIONS)) {
    await query('INSERT INTO permissions (code, description) VALUES (?,?) ON DUPLICATE KEY UPDATE description=VALUES(description)', [code, desc]);
    permIds[code] = (await one('SELECT id FROM permissions WHERE code=?', [code])).id;
  }
  const roleIds = {};
  for (const [code, r] of Object.entries(ROLES)) {
    await query('INSERT INTO roles (code, name, description, is_system) VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), is_system=1', [code, r.name, r.desc]);
    roleIds[code] = (await one('SELECT id FROM roles WHERE code=?', [code])).id;
  }
  // Permissions par défaut uniquement à la création (ne pas écraser les réglages de l'administrateur)
  for (const [code, r] of Object.entries(ROLES)) {
    const has = await one('SELECT COUNT(*) AS n FROM role_permissions WHERE role_id=?', [roleIds[code]]);
    if (!has.n) for (const p of r.perms) await query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?,?)', [roleIds[code], permIds[p]]);
  }
  return roleIds;
}
async function ensureUser({ email, password, first, last, role }, roleIds) {
  let u = await one('SELECT id FROM users WHERE email=?', [email]);
  if (!u) {
    const r = await query('INSERT INTO users (first_name,last_name,email,password_hash,email_verified_at) VALUES (?,?,?,?,NOW())', [first, last, email, await bcrypt.hash(password, 12)]);
    u = { id: r.insertId };
    await query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?,?)', [u.id, roleIds[role]]);
    return true;
  }
  return false;
}

async function seedCatalog() {
  if ((await one('SELECT COUNT(*) AS n FROM products')).n > 0) { console.log('• Catalogue déjà présent : ignoré'); return; }
  const catIds = {};
  for (const [i, [slug, name, icon]] of CATEGORIES.entries()) {
    catIds[slug] = (await query('INSERT INTO categories (slug, name, icon, sort_order) VALUES (?,?,?,?)', [slug, name, icon, i])).insertId;
  }
  const brandIds = {};
  for (const b of ['VIVA', 'Nordika', 'Aura', 'Terra']) brandIds[b] = (await query('INSERT INTO brands (slug, name) VALUES (?,?)', [slugify(b), b])).insertId;
  const brandList = Object.values(brandIds);
  for (const [i, [id, cat, name, price, old, rating, reviews, photo]] of PRODUCTS.entries()) {
    const slug = slugify(name);
    const r = await query(`INSERT INTO products (sku, slug, name, short_description, description, category_id, brand_id, price, sale_price, status, is_featured, rating_avg, rating_count, sold_count, specs, weight_kg)
      VALUES (?,?,?,?,?,?,?,?,?,'active',?,?,?,?,?,?)`,
    [`VIVA-${id}`, slug, name, `${name} - sélection VIVA Live Better.`, `<p>${name} : un produit sélectionné et testé par l'équipe VIVA pour sa qualité, son design et sa durabilité.</p><p>Garantie satisfait ou remboursé sous 30 jours.</p>`,
      catIds[cat], brandList[i % brandList.length], old, price, id < 200 ? 1 : (i % 5 === 0 ? 1 : 0), rating, reviews, Math.round(reviews * 0.6), JSON.stringify({ Garantie: '1 an', Origine: 'Importé' }), 0.5]);
    await query('INSERT INTO product_images (product_id, url, alt, is_primary) VALUES (?,?,?,1)', [r.insertId, U(photo), name]);
    await query('INSERT INTO inventories (product_id, variant_id, quantity, low_stock_threshold) VALUES (?,0,?,5)', [r.insertId, 25 + ((i * 7) % 40)]);
    await query("INSERT INTO stock_movements (product_id, variant_id, type, quantity, balance_after, note) VALUES (?,0,'in',?,?,'Stock initial')", [r.insertId, 25 + ((i * 7) % 40), 25 + ((i * 7) % 40)]);
  }
  // Variantes de démonstration (taille) sur les produits de mode
  for (const sku of ['VIVA-201', 'VIVA-203', 'VIVA-205']) {
    const p = await one('SELECT id FROM products WHERE sku=?', [sku]);
    await query('DELETE FROM inventories WHERE product_id=?', [p.id]);
    for (const size of ['S', 'M', 'L', 'XL']) {
      const v = await query('INSERT INTO product_variants (product_id, sku, name, attributes) VALUES (?,?,?,?)', [p.id, `${sku}-${size}`, `Taille ${size}`, JSON.stringify({ Taille: size })]);
      await query('INSERT INTO inventories (product_id, variant_id, quantity, low_stock_threshold) VALUES (?,?,?,5)', [p.id, v.insertId, 12]);
      await query("INSERT INTO stock_movements (product_id, variant_id, type, quantity, balance_after, note) VALUES (?,?,'in',12,12,'Stock initial')", [p.id, v.insertId]);
    }
  }
  console.log(`✔ Catalogue : ${CATEGORIES.length} catégories, ${PRODUCTS.length} produits`);
}

async function seedShipping() {
  if ((await one('SELECT COUNT(*) AS n FROM shipping_zones')).n > 0) return;
  const eu = (await query('INSERT INTO shipping_zones (name, countries) VALUES (?,?)', ['France & Europe', 'FR,BE,LU,DE,ES,IT,PT,NL,CH,GB,IE,AT'])).insertId;
  await query('INSERT INTO shipping_methods (zone_id, code, name, fee, free_over, min_days, max_days) VALUES (?,?,?,?,?,?,?)', [eu, 'standard', 'Livraison Standard', 4.99, 49, 3, 7]);
  await query('INSERT INTO shipping_methods (zone_id, code, name, fee, free_over, min_days, max_days) VALUES (?,?,?,?,?,?,?)', [eu, 'express', 'Livraison Express', 9.99, null, 1, 3]);
  const world = (await query('INSERT INTO shipping_zones (name, countries) VALUES (?,?)', ['International', '*'])).insertId;
  await query('INSERT INTO shipping_methods (zone_id, code, name, fee, free_over, min_days, max_days) VALUES (?,?,?,?,?,?,?)', [world, 'international', 'Livraison Internationale', 12.99, 149, 7, 14]);
  console.log('✔ Zones de livraison');
}

(async () => {
  const demo = process.argv.includes('--demo');
  const roleIds = await seedAccess();
  console.log('✔ Rôles et permissions');
  if (await ensureUser({ email: env.admin.email, password: env.admin.password, first: env.admin.firstName, last: env.admin.lastName, role: 'admin' }, roleIds)) console.log(`✔ Administrateur créé : ${env.admin.email}`);
  else console.log(`• Administrateur existant : ${env.admin.email}`);
  await seedCatalog();
  await seedShipping();
  if (!(await one("SELECT 1 AS x FROM coupons WHERE code='WELCOME10'"))) {
    await query("INSERT INTO coupons (code, description, type, value, min_order, usage_limit, per_user_limit) VALUES ('WELCOME10','10% de bienvenue','percent',10,20,1000,1)");
    console.log('✔ Code promo : WELCOME10');
  }
  const content = { cgv: CGV, privacy: PRIVACY, shipping_policy: SHIPPING, return_policy: RETURNS, legal: LEGAL, faq: JSON.stringify(FAQ) };
  for (const [k, v] of Object.entries(content)) if (!(await one('SELECT 1 AS x FROM settings WHERE setting_key=?', [`content.${k}`]))) await setSetting(`content.${k}`, v, true);
  if (demo) {
    const pw = 'Demo!2026pass';
    const accounts = [['client@demo.com', 'Client', 'Démo', 'customer'], ['produits@demo.com', 'Gestionnaire', 'Produits', 'product_manager'], ['stock@demo.com', 'Gestionnaire', 'Stock', 'stock_manager'],
      ['commandes@demo.com', 'Gestionnaire', 'Commandes', 'order_manager'], ['compta@demo.com', 'Comptable', 'Démo', 'accountant'], ['livreur@demo.com', 'Livreur', 'Démo', 'courier'], ['support@demo.com', 'Service', 'Client', 'support']];
    for (const [email, first, last, role] of accounts) await ensureUser({ email, password: pw, first, last, role }, roleIds);
    console.log(`✔ Comptes de démonstration (mot de passe : ${pw}) : ${accounts.map((a) => a[0]).join(', ')}`);
  }
  console.log('✔ Seed terminé');
  await pool.end();
})().catch((e) => { console.error('✖ Seed échoué :', e); process.exit(1); });
