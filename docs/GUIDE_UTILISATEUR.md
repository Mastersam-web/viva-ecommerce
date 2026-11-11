# Guide utilisateur

## Client
1. **Créer un compte** (Compte → Inscription) puis cliquer le lien reçu par email pour le vérifier.
2. **Acheter** (compte obligatoire : un visiteur qui clique « Ajouter au panier » est dirigé vers la connexion, puis le produit est ajouté) : ajouter au panier (tiroir latéral), ouvrir le panier, saisir un code promo (ex. `WELCOME10`), « Passer la commande » → adresse → livraison → paiement.
3. **Suivre** : Mon compte → Mes commandes (chronologie, n° de suivi). Sans compte : page « Suivre ma commande » (n° + email).
4. **Après achat** : demander l'annulation (l'équipe répond par notification ; seul l'administrateur change le statut d'une commande), télécharger facture/reçu, demander un retour sur une commande livrée, laisser un avis, contacter le service client.

## Équipe (Administration → /admin)
Le menu n'affiche que les écrans autorisés pour votre rôle.

| Rôle | Principales responsabilités |
|---|---|
| Administrateur | Tout, dont utilisateurs, rôles, paramètres, audit |
| Gestionnaire de produits | Produits, catégories, marques, avis |
| Gestionnaire de stock | Stocks, inventaires, fournisseurs, approvisionnements |
| Gestionnaire des commandes | Commandes, retours, livraisons (assignation des livreurs) |
| Comptable | Paiements, remboursements, rapports |
| Livreur | Voit uniquement ses colis, met à jour leur statut, encaisse le paiement à la livraison |
| Service client | Demandes clients, retours, avis, fiches clients |

### Tâches courantes
- **Ajouter un produit** : Produits → Nouveau produit (images glisser/sélectionner, variantes, prix promo avec dates, stock).
- **Traiter une commande** : Commandes → ouvrir → boutons de statut (seules les transitions valides sont proposées) ; Facture / Bon de livraison en PDF.
- **Réapprovisionner** : Approvisionnements → Nouvelle commande → à l'arrivée « Ouvrir » et saisir les quantités reçues (le stock est mis à jour).
- **Inventaire** : Stocks → Inventaire sur une ligne (l'écart est journalisé).
- **Rembourser** : Commande → Paiements → Rembourser (total ou partiel).
- **Modifier la page d'accueil / les textes** : Contenu & blog.
- **Exporter** : Rapports → choisir le rapport et la période → Excel ou PDF.

## Notifications
- **Client** : la cloche (en-tête) affiche les non lues : statut de commande, paiement reçu/rejeté, réponse du service client.
- **Administrateur** : cloche dans l'en-tête de l'administration + page `/admin/notifications` : nouvelle commande, nouveau compte client, paiement à vérifier, message de contact, abonné newsletter, avis, retour, stock faible. Les messages de contact et abonnements sont aussi envoyés par email à l'adresse de contact de la boutique.

## Statuts de commande et paiements
- Seul l'administrateur (ou le personnel autorisé) change le statut d'une commande ; le client est notifié. Le livreur met à jour la livraison depuis son écran.
- Par défaut, une commande payée reste « à confirmer » : activez Administration → Paramètres → « Confirmer automatiquement les commandes payées » pour l'automatiser.
- **Admin → Paiements → Moyens de paiement** : activer/désactiver chaque moyen, libellés, opérateurs Mobile Money (numéro marchand, nom du compte, instructions), coordonnées bancaires.
- **Paiements à vérifier** : pour Mobile Money (hors mode test) et virement, le client envoie sa référence de transaction ; confirmez ou rejetez (avec motif) dans Admin → Paiements (filtre « À vérifier »).
- **Newsletter** : Admin → Service client → Abonnés newsletter : liste, suppression, envoi d'une newsletter (lien de désabonnement ajouté automatiquement).
