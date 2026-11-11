# Tests

`npm test` (à la racine) crée une base isolée `<DB_NAME>_test` (le script refuse de toucher une base dont le nom ne se termine pas par `_test`), applique le schéma, charge les données de démonstration et exécute 18 scénarios de bout en bout (`backend/tests/e2e.test.js`, `node:test`) :

catalogue et recherche · en-têtes de sécurité, CSRF, injection SQL · inscription/connexion/verrouillage · devis et prix serveur · commande à la livraison complète (statuts, stock, facture) · parcours livreur · avis · retours et remboursements · paiement carte simulé, Mobile Money/virement avec preuve et rejet, configuration des moyens de paiement, notifications admin/client, demande d'annulation, remboursement · webhook Mobile Money (signature, idempotence, montant) · CRUD administrateur, stock, approvisionnement, promotions, rapports · permissions par rôle et protection du dernier administrateur · suivi public, contact, newsletter, contenus.

Résultat de la livraison : **18/18 réussis**. L'interface (boutique, tunnel de commande, compte, 19 écrans d'administration) a été vérifiée dans un navigateur automatisé : aucune erreur JavaScript ni erreur API.
