# Couverture

Légende : fait, testé, ou restant. « Testé » signifie un test automatique exécuté dans ce dépôt, pas une recette manuelle complète.

| Exigence | État | Preuve |
| --- | --- | --- |
| Next.js, TypeScript strict, Tailwind | Fait | `npm run typecheck` |
| Firebase Auth, Firestore, Functions, Storage, règles | Fait et testé sur les règles | `npm run test:rules`, 10 tests |
| App Check préparé, non forcé | Fait | `ENFORCE_APP_CHECK` vide |
| Tirage serveur, exclusions dures, préférence réciproque | Fait et testé | `tests/draw.test.ts` |
| Non-uniformité documentée | Fait | `docs/TIRAGE.md` |
| Invitations : jeton hashé, lecture sans consommation | Fait et testé sur la fonction pure | `tests/product.test.ts` |
| E-mails transactionnels, échappement, pas de destinataire du cadeau | Fait et testé | `tests/product.test.ts` |
| Capture locale distincte d'un envoi | Fait | Retour `captured_locally` |
| Fuseau Europe/Paris et heure d'été 2026 | Testé | `tests/product.test.ts` |
| Import CSV / Excel, formules neutralisées | Fait et testé sur le texte | Interface branchée |
| Modes classique, public, double mystère | Fait | Vues serveur |
| Ajout tardif sans changer une attribution découverte | Fait et testé sur le moteur | Interface branchée |
| PWA, hors-ligne, modale de mise à jour | Fait et testé sur la décision | Le cycle réel N vers N+1 n'a pas été joué sur deux builds |
| Pages légales | Fait | Textes du 22 octobre 2026, points ouverts restés dans le corps |
| Tarifs, catalogue serveur, capacité, montée à 20 € | Fait et testé sur les fonctions pures | `tests/billing.test.ts`, `docs/PAIEMENT.md` |
| Paiement Mollie test, débit réel désactivé | Fait et testé sur la lecture d'état | Clé `live_` refusée, retour navigateur non décisif |
| Client interdit d'écrire un paiement | Testé avec les règles | `tests/rules.test.ts` |
| Facture, TVA, rétractation | Restant | Emplacements préparés, mentions non inventées |
| Déploiement, domaine, envoi réel | Restant | Volontaire |
| Tests des règles Firestore et Storage | Testé | 10 tests passés avec Java 21 |
| Nettoyage des participations après suppression de compte | Restant | Documenté |
| Recette navigateur | Faite sur le parcours local | Accueil, connexion, liste, faisabilité, modale d'annulation refusée, exclusions, mentions |
