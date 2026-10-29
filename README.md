# Sous pli

Sous pli est une application web en français pour organiser un échange de cadeaux secret, en famille, entre amis, dans une association ou dans une entreprise. Chacun consulte son destinataire dans un espace protégé. Le tirage, les invitations et les droits sont appliqués par des fonctions serveur.

L'adresse déclarée dans le code est [https://souspli.fr](https://souspli.fr). Le dépôt prévoit Vercel pour l'interface et Firebase pour le backend. Cela n'établit pas, à lui seul, que le site est actuellement en ligne.

## Public

- La personne qui prépare l'échange et, selon l'offre, celles qu'elle désigne comme coorganisatrices.
- Les participantes et participants, y compris un enfant représenté par un adulte.
- Une association ou une entreprise qui fait payer l'événement par l'organisateur. Les participants ne paient pas.

## Fonctionnalités opérationnelles

Ces parcours sont implémentés dans l'interface et les fonctions serveur.

- Compte : inscription et connexion par e-mail, connexion Google, session anonyme que l'on peut lier à une adresse, vérification d'adresse, changement d'adresse après confirmation, mot de passe oublié, profil, export des données et suppression du compte. Un organisateur d'un échange encore ouvert doit d'abord l'annuler ou l'archiver.
- Échange : nom, occasion, date, lieu, budget, mode de confidentialité (secret classique, attributions publiques, double mystère), nombre de cadeaux, règles, et participation de l'organisateur au tirage.
- Participants : saisie, import CSV ou Excel, reprise d'un groupe déjà créé, adulte responsable d'un enfant. Deux prénoms identiques restent deux personnes.
- Exclusions : une personne n'offre pas à une autre, dans un sens ou dans les deux ; groupe fermé ; évitement des paires déjà tirées lors d'un échange précédent.
- Tirage sur le serveur, avec explication si aucune solution n'existe. Chacun ne voit que son résultat. La révélation collective attend l'heure prévue. Après le tirage, un ajout ou un retrait reste possible par une opération dédiée.
- Invitations par lien personnel, code d'inscription, validation ou refus des demandes, et second tirage qui reprend les personnes et les exclusions.
- Souhaits écrits, idées de cadeaux, messages après tirage, signalement et blocage d'une conversation, notifications dans l'application.
- Annulation, archivage, et suppression d'un échange annulé ou encore en brouillon. La suppression demande le nom exact. Les enregistrements de paiement ne sont pas effacés avec l'échange.
- Offres : Famille et amis (gratuit, jusqu'à 50 personnes), Association (9,90 €, jusqu'à 100), Entreprise (19,90 €, jusqu'à 100), Entreprise Plus (39,90 €, jusqu'à 300), passage d'Entreprise à Entreprise Plus (20 € avant le tirage), et demande de devis au-delà de 300 sans paiement automatique. Les prix viennent du catalogue serveur. TVA non applicable, article 293 B du Code général des impôts. Aucune facture numérotée n'est produite : l'e-mail de commande et le reçu Mollie en sont distincts.
- Pages Mentions, Confidentialité, Conditions, annexe de sous-traitance, tarifs, aide, contact et écran hors ligne.
- Installation proposée sur l'écran d'accueil, jamais imposée. Le service worker ne s'enregistre pas pendant `npm run dev`, sauf si `NEXT_PUBLIC_ENABLE_SW` vaut `true`.

## Fonctionnalités partielles

Elles existent dans le code, mais dépendent d'un réglage ou ne couvrent pas tout le parcours.

- Paiement Mollie : une clé `live_` encaisse un paiement réel ; une clé `test_` ouvre le paiement sans débit réel. Sans clé, aucun paiement n'est créé. Le retour du navigateur ne débloque pas l'offre : le serveur relit le paiement. Le webhook n'est utilisé que si `MOLLIE_WEBHOOK_URL` est une adresse `https`.
- Rétractation : l'organisateur peut demander le remboursement dans les quatorze jours. L'envoi effectif à Mollie n'est possible que pour les identifiants listés dans `MOLLIE_OPERATOR_UIDS`. L'interface n'a pas de bouton pour cet envoi.
- E-mails : avec `RESEND_API_KEY` et `MAIL_FROM_ADDRESS`, les messages partent par Resend. L'acceptation par Resend n'est pas une preuve de remise. Les e-mails de compte utilisent un code d'action Firebase, pas l'e-mail standard Firebase.
- Logo et personnalisation des e-mails : selon l'offre payée. Le logo d'événement peut être déposé. Le dépôt d'une photo de souhait est refusé par les règles de stockage ; une lecture d'image déjà présente existe côté serveur.
- Coorganisateurs et suivi par équipe : offre Entreprise Plus payée. Les coorganisateurs ne voient pas les attributions secrètes.
- Notifications push : la fonction d'enregistrement d'un jeton existe, aucun écran ne l'appelle. Les alertes visibles sont celles de l'application.
- Conservation : les durées sont codées (accès douze mois après la date de l'événement, avertissements, purge). Les suppressions du traitement planifié ne s'exécutent que si `RETENTION_APPLY` vaut `true`. Sinon le traitement reste une simulation.

## Comportements simulés

- Sans clé Mollie, et seulement dans l'émulateur, le paiement passe par la page locale `/paiement/test`. La simulation d'un avis de prestataire est refusée hors émulateur.
- Sans `RESEND_API_KEY`, l'envoi est enregistré dans `mailCapture` avec le statut `captured_locally`. Ce n'est pas un e-mail envoyé.
- `listCapturedMail` ne répond que dans l'émulateur.
- `npm run seed` n'écrit que vers l'émulateur local. Il crée un compte de démonstration et un brouillon. L'adresse et le mot de passe sont dans `scripts/seed.ts` ; ce mot de passe ne sert pas hors de la machine.

## Non prévu dans le code

- Facture numérotée de l'éditeur.
- Dépôt de photos dans une liste de souhaits.
- Écran pour envoyer un remboursement à Mollie.
- Enregistrement d'un abonnement : le paiement est unique, par événement.

Les notes de `docs/` décrivent des lots antérieurs. En cas d'écart, le code l'emporte. En particulier, `docs/MISE_EN_SERVICE.md` indique encore qu'une clé `live_` est refusée ; `functions/src/billing.ts` accepte aujourd'hui une clé `live_` ou `test_`.

## Stack

- Interface : Next.js 16, React 19, TypeScript, Tailwind CSS 4.
- Contrôles de formulaire : Zod 4. Le serveur reste l'autorité pour les prix, le tirage et les droits.
- Backend : Firebase Authentication, Firestore, Storage et Cloud Functions, région `europe-west1`, runtime Node.js 22.
- Paiement : Mollie. E-mails : Resend. Hébergement prévu de l'interface : Vercel. Nom de domaine déclaré : souspli.fr, enregistré chez IONOS. IONOS n'héberge pas l'application.
- Le fichier `.firebaserc` pointe par défaut vers le projet d'émulateur `sous-pli-local`.

## Prérequis

- Node.js 22 ou plus récent. Les fonctions sont prévues pour Node.js 22.
- Java, seulement pour les émulateurs Firestore et Storage.

## Installation

```bash
npm install
npm install --prefix functions
```

Copier `.env.example` vers `.env.local`, et `functions/.env.example` vers `functions/.env`.

Les valeurs de `.env.example` sont des valeurs de démonstration. Elles ne donnent accès à aucun projet réel tant que `NEXT_PUBLIC_USE_EMULATORS` vaut `true`. Ne pas y placer de secret.

## Configuration

Interface, dans `.env.local` :

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_USE_EMULATORS`
- `NEXT_PUBLIC_APPCHECK_SITE_KEY`
- `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN`
- `NEXT_PUBLIC_ENABLE_SW`

Fonctions, dans `functions/.env`. Ne jamais préfixer ces noms par `FIREBASE_` : ce préfixe est réservé.

- `APP_PUBLIC_URL`
- `STORAGE_BUCKET`
- `MOLLIE_API_KEY`
- `MOLLIE_WEBHOOK_URL`
- `MOLLIE_OPERATOR_UIDS`
- `RESEND_API_KEY`
- `MAIL_FROM_ADDRESS`
- `MAIL_FROM_DOMAIN`
- `RETENTION_APPLY`
- `ENFORCE_APP_CHECK`

`APP_PUBLIC_URL` doit être une origine autorisée dans Firebase Authentication. Ne pas activer en plus l'e-mail standard Firebase pour le mot de passe, la vérification et le changement d'adresse.

## Lancer en local

Deux terminaux :

```bash
npm run emulators
npm run dev
```

Les émulateurs sont sur `http://127.0.0.1:4000`. L'application est sur `http://127.0.0.1:3000`.

Avec les émulateurs déjà démarrés : `npm run seed`. Les données ne sont pas conservées d'un lancement à l'autre. Pour repartir d'un export éventuel, arrêter les émulateurs et supprimer le dossier `.emulator-data`.

## Commandes

```bash
npm test
npm run test:rules
npm run typecheck
npm run lint
npm run build
npm run seed
```

`npm run test:rules` lance les émulateurs Firestore et Storage. Il échoue si Java est absent. Les tests du tirage, des offres et des e-mails n'ont pas besoin des émulateurs.

## Données principales

- `users` : profil, préférences, résultats personnels, conversations et notifications.
- `events` : échange, participants, exclusions, souhaits, idées, thème d'e-mails, coorganisateurs.
- `invitationTokens`, `joinCodes` : liens et codes d'entrée.
- `payments`, `paymentNotices`, `quoteRequests` : commandes, avis de paiement et devis.
- `mailOutbox`, `mailCapture`, `mailSecrets` : file d'e-mails et captures locales.

Les règles Firestore et Storage interdisent les écritures directes du navigateur sur ces données métier. Les modifications passent par les fonctions.
