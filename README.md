# Sous pli

Application web installable pour organiser un échange de cadeaux. L'interface est en français. Le tirage, les invitations et les droits sont appliqués côté serveur. Rien n'est déployé par ce dépôt.

## Prérequis

- Node.js 22 ou plus récent pour le développement. Les fonctions Cloud sont prévues pour le runtime Node 22.
- Java, uniquement pour les émulateurs Firestore et Storage.

## Installation

```bash
npm install
npm install --prefix functions
copy .env.example .env.local
copy functions\.env.example functions\.env
```

Les clés publiques de `.env.example` sont des clés de démonstration Firebase. Elles ne donnent accès à aucun projet réel tant que `NEXT_PUBLIC_USE_EMULATORS=true`.

## Lancer en local

Deux terminaux :

```bash
npm run emulators
npm run dev
```

L'interface des émulateurs est sur `http://127.0.0.1:4000`. L'application est sur `http://127.0.0.1:3000`.

Avec les émulateurs déjà démarrés :

```bash
npm run seed
```

Le seed crée uniquement `organisateur@exemple.local` / `motdepasse-local` et un brouillon. Il refuse une cible qui n'est pas `127.0.0.1` ou `localhost`. Pour tout effacer : arrêter les émulateurs et supprimer le dossier `.emulator-data` s'il a été exporté, puis relancer. Les émulateurs de ce dépôt ne persistent pas les données entre deux lancements.

## E-mails

Sans `RESEND_API_KEY` et sans `MAIL_FROM_ADDRESS`, un envoi est enregistré dans `mailCapture` avec le statut `captured_locally`. L'interface ne doit pas le présenter comme un e-mail envoyé. Aucun message réel n'est émis par la configuration livrée.

## Notifications

L'enregistrement d'un jeton push se fait après une action explicite. Le worker de rappel quotidien et le worker de file d'attente planifié demandent le forfait Blaze et ne tournent pas tant qu'ils ne sont pas déployés. Les invitations passent par le traitement immédiat de la file, pas par le planificateur.

## Hébergement prévu

Next.js sert l'interface. L'hébergement retenu pour l'application est Vercel ; il n'est pas déployé dans ce dépôt. IONOS est prévu pour le nom de domaine, pas pour héberger le site. Firebase reste le backend. Les fonctions sont prévues en `europe-west1`. Voir `docs/HEBERGEMENT.md`.

Le forfait Blaze est nécessaire pour les fonctions sortantes, l'e-mail et les planifications. Une alerte de budget Google Cloud n'est pas un plafond de dépense.

## Vérifications

```bash
npm test
npm run typecheck
npm run build
```

`npm run test:rules` lance les émulateurs Firestore et Storage. Il échoue si Java est absent. Les tests du moteur de tirage et des modèles d'e-mail n'ont pas besoin des émulateurs.

## Paiement

Le catalogue et le parcours sont décrits dans `docs/PAIEMENT.md`. Mollie Checkout est préparé en paiement unique, clé de test seulement. Aucune clé n'est fournie et les débits réels restent désactivés. Dans l'émulateur, la page de test simule l'avis du prestataire. Le retour du navigateur ne débloque pas l'offre. Le lot de mise en service est décrit dans `docs/MISE_EN_SERVICE.md`.

## Ce qui n'est pas fait

Aucun projet Firebase de production, aucun domaine déployé, aucun débit réel, aucun envoi réel. Les pages légales reprennent les informations d'éditeur confirmées le 22 octobre 2026. Les écarts encore bloquants sont dans `docs/MISE_EN_SERVICE.md`.
