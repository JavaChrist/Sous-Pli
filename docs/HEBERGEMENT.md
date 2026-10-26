# Hébergement

Ce lot prépare Vercel. Il ne crée pas de déploiement et ne modifie pas le DNS.

## Rôles

- Vercel héberge l'application Next.js. Entité relevée le 22 octobre 2026 : Vercel Inc., société du Delaware, 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis. Sources : https://vercel.com/legal/privacy-notice et https://vercel.com/legal/dpa.
- IONOS gère le nom de domaine souspli.fr. Il n'héberge pas l'application. Mentions françaises consultées : IONOS SARL, 7, place de la Gare, BP 70109, 57200 Sarreguemines Cedex, téléphone 09 70 80 89 11, https://www.ionos.fr/terms-gtc/terms-imprint/. Le contrat du domaine n'a pas été ouvert ici : s'il est au nom d'IONOS SE plutôt que d'IONOS SARL, l'entité diffère.
- GitHub sert au code source. Ce n'est pas l'hébergeur du site public.
- Firebase reste le backend : authentification, Firestore, Cloud Functions, Storage. Firebase App Hosting n'est plus la cible d'hébergement. Le fichier `apphosting.yaml` a été retiré.

## Mise en place, plus tard

1. Créer le projet Vercel à partir du dépôt, sans promouvoir une production dans ce lot.
2. Régler les variables publiques de build (`NEXT_PUBLIC_FIREBASE_*`, émulateurs désactivés, service worker selon le besoin). Ne pas y placer la clé Mollie ni la clé Resend.
3. Quand le domaine devra pointer vers Vercel, modifier le DNS chez IONOS. Ce n'est pas fait ici.
4. Le fichier `vercel.json` indique seulement le framework Next.js.

Aucun alias de production ni certificat n'a été demandé.
