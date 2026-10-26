# Console Firebase

Ces étapes ne sont pas exécutées par le dépôt. Aucun projet, aucune facturation et aucun domaine n'ont été créés.

1. Créer un projet Google Cloud / Firebase et noter son identifiant. Ne pas coller de clé privée dans le navigateur ni dans le dépôt.
2. Activer Authentication : Google, e-mail/mot de passe, et anonyme. Ajouter le domaine de l'application aux domaines autorisés.
3. Créer Firestore en mode production, région `europe-west1`. Déployer `firestore.rules` et `firestore.indexes.json`.
4. Créer un bucket Storage dans la même région et déployer `storage.rules`.
5. Activer App Check pour le web. Renseigner la clé de site reCAPTCHA Enterprise ou Play Integrity selon la plateforme. Laisser `ENFORCE_APP_CHECK` vide tant que les jetons ne sont pas vérifiés de bout en bout, puis le passer à `true` sur les fonctions.
6. Passer au forfait Blaze avant de déployer les fonctions sortantes, le planificateur ou un prestataire d'e-mail. Créer une alerte de budget. Elle prévient, elle ne bloque pas la dépense.
7. Déployer les fonctions depuis le dossier `functions`, runtime Node 22, région `europe-west1`.
8. Renseigner les variables de fonction : `APP_PUBLIC_URL` en HTTPS, `STORAGE_BUCKET`, et seulement alors `RESEND_API_KEY` plus `MAIL_FROM_ADDRESS` si l'envoi réel est voulu. Ne pas préfixer une variable par `FIREBASE_` : ce préfixe est réservé. Vérifier le domaine d'expédition chez le prestataire.
9. Préparer le projet Vercel à partir de ce dépôt, sans le promouvoir en production dans ce lot. Renseigner les variables `NEXT_PUBLIC_*` du projet réel et `NEXT_PUBLIC_USE_EMULATORS=false`. Ne pas utiliser l'hébergement statique Firebase à la place. Voir `docs/HEBERGEMENT.md`.
10. Ajouter une application web Firebase, copier la configuration publique dans les variables d'environnement, et déposer les icônes déjà présentes dans `public/`.
11. Quand le domaine devra pointer vers Vercel, enregistrer les DNS chez IONOS et le certificat selon l'assistant Vercel. Ce changement n'est pas fait ici. Contrôler ensuite que les liens d'invitation utilisent ce domaine.
12. Créer un compte de test, un échange, un tirage, puis vérifier qu'un second compte ne lit pas `serverData`.
13. Paiement : créer un compte Mollie de test, renseigner `MOLLIE_API_KEY` (`test_` seulement) et `MOLLIE_WEBHOOK_URL` en https vers `mollieWebhook`. Ne pas coller de clé `live_`. Le régime fiscal retenu est la franchise en base. Voir `docs/PAIEMENT.md` et `docs/MISE_EN_SERVICE.md`.
