# Mise en service — lot du 22 octobre 2026

Aucun déploiement, aucun DNS, aucun paiement réel et aucune purge réelle ne sont activés par ce lot.

## 1. Implémenté et testé

- Pages Mentions, Confidentialité, Conditions et annexe de sous-traitance, avec l'éditeur confirmé, la franchise de TVA, Vercel, IONOS, Mollie, Resend et le médiateur indiqué par l'éditeur.
- Prix serveur inchangés : 0 / 9,90 / 19,90 / 39,90 euros et devis au-delà de 300. Mention « TVA non applicable, article 293 B du Code général des impôts ». Aucune TVA ajoutée.
- Mollie Checkout en mode test seulement. Clé `live_` refusée. Le webhook ne fait pas foi : le serveur relit le paiement. Le retour navigateur ne débloque pas l'offre. Les notifications répétées portent le même identifiant d'avis. Remboursement refusé s'il n'est pas en demande, clé d'idempotence `refund-{commande}`.
- Fin d'accès : douze mois après la date de l'événement, 23 h 59 dans son fuseau. Un report qui la dépasserait est refusé. La date est affichée avant paiement et conservée avec la version des conditions.
- Calendrier de conservation codé, worker quotidien, mode simulation par défaut (`previewRetention`).
- Suppression de compte étendue aux participations, souhaits, fichiers, messages côté compte, invitations et e-mails en attente. Un organisateur d'un échange encore ouvert est bloqué. L'événement des autres n'est pas effacé.
- Photos de souhaits : dépôt refusé par l'interface et par les règles Storage. L'inventaire des fichiers est une liste, sans suppression de masse.
- Tests exécutés dans ce lot : `tests/billing.test.ts`, `tests/retention.test.ts`, et le typecheck du projet. Les règles Storage avaient déjà un test de refus de dépôt.
- E-mails d'événement : ton, palette, introduction, signature, logo et objets selon l'offre payée. Aperçu et essai sur le modèle choisi, avec le contexte réel et des données fictives. Relances `reminder_view` et `reminder_wishes` au plus une fois, par le worker quotidien, avec plafond.
- E-mails de compte : code d'action Firebase Admin, message neutre Sous pli via la file Resend. Pas de second envoi Firebase. Sans clé Resend, capture locale. L'acceptation Resend n'est pas une preuve de remise ni de lecture.

## 2. Secrets et paramètres, sans valeurs

- `MOLLIE_API_KEY` : clé `test_` uniquement, secret des fonctions.
- `MOLLIE_WEBHOOK_URL` : URL https de `mollieWebhook`.
- `MOLLIE_OPERATOR_UIDS` : identifiants autorisés à lancer un remboursement, séparés par des virgules.
- `APP_PUBLIC_URL` : origine https de l'application pour les retours Mollie.
- `RETENTION_APPLY` : `true` seulement pour exécuter les suppressions.
- `RESEND_API_KEY` et `MAIL_FROM_ADDRESS` : envoi réel. Sans clé, les e-mails sont capturés localement.
- `STORAGE_BUCKET` : bac Firebase.
- Variables `NEXT_PUBLIC_FIREBASE_*` : configuration client déjà prévue. Ne pas y mettre de secret.
- Firebase Authentication : autoriser l'origine de `APP_PUBLIC_URL` pour les liens d'action. Ne pas activer l'envoi d'e-mail natif en parallèle de Resend pour le mot de passe, la vérification et le changement d'adresse. Le modèle natif Firebase ne porte pas le design Sous pli ; le code d'action, lui, reste celui de Firebase.
- Aucun suivi de remise Resend n'est branché. L'interface ne doit pas afficher « remis au serveur destinataire ».

## 3. Actions chez les prestataires

- Vercel : créer le projet et les variables publiques au moment voulu. Pas de déploiement dans ce lot. Voir `docs/HEBERGEMENT.md`.
- Firebase : projet de production, région Firestore et Storage, déploiement des fonctions `europe-west1`, secret Mollie, URL du webhook, index Firestore. L'authentification reste traitée aux États-Unis.
- Resend : domaine d'envoi et clé, seulement pour des e-mails réels.
- Mollie : compte marchand en mode test, clé `test_`, URL de webhook. Ne pas passer en live.
- IONOS : rien dans ce lot. Le DNS reste inchangé.

## 4. Points bloquants

- Le site https://souspli.fr n'a pas été vérifié comme déployé.
- Aucun projet Firebase de production n'est créé ici. L'entité Google signataire dépend du compte de facturation de ce futur projet. Elle n'est pas nommée.
- Le contrat de domaine IONOS n'a pas été lu. Les coordonnées publiques correspondent à IONOS SARL. Un contrat avec IONOS SE serait un écart.
- Le compte marchand Mollie n'a pas été ouvert : la correspondance avec Mollie B.V. n'est pas vérifiée sur un contrat signé. Coordonnées publiques conformes à l'impressum et au registre DNB (KvK 30204462, Keizersgracht 126, 1015 CW Amsterdam).
- `MOLLIE_OPERATOR_UIDS` est vide : aucun remboursement ne peut être exécuté tant qu'une personne habilitée n'est pas désignée. La politique de rétractation est codée, elle n'est pas en service sur des ventes réelles.
- `RETENTION_APPLY` n'est pas activé. Les durées ne s'exécutent pas.
- Aucune sauvegarde Firestore ou Storage n'est configurée dans le dépôt. Il n'existe donc pas de délai de purge de sauvegarde à annoncer. Firebase Authentication indique, dans sa documentation confidentialité consultée le 22 octobre 2026, un retrait des sauvegardes d'authentification sous 180 jours après suppression de l'utilisateur. Une restauration manuelle pourrait réintroduire des données.
- Les factures JavaChrist ne sont pas émises : pas de numérotation. Le reçu Mollie et l'e-mail de commande sont distincts d'une facture.
- La convention entre JavaChrist et MÉDIATION CONSOMMATION DÉVELOPPEMENT couvrant Sous pli n'a pas été produite. Aucun numéro d'adhésion n'est inventé.
- Resend : Plus Five Five, Inc., 2261 Market Street #5039, San Francisco. Participant Data Privacy Framework, certification d'origine le 20 février 2025, recertification indiquée « en revue » à la consultation du 22 octobre 2026. Aucune clé n'est configurée.
- Les photos de souhaits déjà déposées, s'il en existe hors production, ne sont pas affichées et ne sont pas purgées en masse.

## 5. Décisions à confirmer avant publication

- Activer les ventes réelles seulement après clé live explicitement demandée, opérateur de remboursement désigné, et convention de médiation vérifiée.
- Activer `RETENTION_APPLY` seulement après une simulation relue.
- Choisir l'entité Google du projet de production et la région Firestore / Storage.
- Vérifier que le contrat de domaine est bien au nom d'IONOS SARL.
- Décider du moment de la bascule DNS vers Vercel.
