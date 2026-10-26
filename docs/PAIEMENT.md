# Paiement

Un paiement par événement, en euros, sans abonnement et sans renouvellement. Seul l'organisateur paie. Les participants ne saisissent jamais de coordonnées bancaires.

Les prix font autorité dans `shared/billing.ts`. Un montant, une capacité ou un statut « payé » envoyés par le navigateur sont ignorés.

| Offre | Prix final | Capacité |
| --- | ---: | ---: |
| Famille & amis | 0 € | 50 |
| Association | 9,90 € | 100 |
| Entreprise | 19,90 € | 100 |
| Entreprise Plus | 39,90 € | 300 |
| Grand groupe | sur devis | plus de 300 |

La page `/tarifs` montre trois cartes. La carte Entreprise choisit 100 participants, 300 participants ou un devis. Aucun frais de plateforme n'est ajouté au récapitulatif.

## Prestataire

Mollie Checkout, en paiement unique et en mode test. Aucune clé n'est livrée. `billingConfig.realChargesEnabled` reste `false`.

- `MOLLIE_API_KEY` doit commencer par `test_`. Une clé `live_` est refusée et n'ouvre aucun paiement. Dès que la clé de test est présente, `createCheckout` crée le paiement chez Mollie et redirige vers son checkout, même en local.
- L'avis Mollie ne contient que l'identifiant. La fonction `mollieWebhook` relit le paiement avec la clé, puis contrôle le montant, la devise, le mode test et la référence de commande. Sans `MOLLIE_WEBHOOK_URL` en https, ce webhook n'est pas envoyé : au retour, `getPaymentStatus` relit la même API.
- `MOLLIE_OPERATOR_UIDS` désigne qui peut lancer un remboursement. Une demande déjà envoyée ou déjà remboursée ne repart pas.
- Sans clé de test, l'émulateur garde la page locale `/paiement/test/{commande}`. Cette page n'appelle pas Mollie et n'existe pas hors émulateur.
- Le retour navigateur `/paiement/retour` interroge `getPaymentStatus`. Il affiche « Confirmation du paiement en cours » tant que Mollie n'a pas renvoyé un statut payé. Il ne débloque pas l'offre.
- Un paiement dont le mode Mollie est `live` est rejeté.
- Les confirmations sont idempotentes via `paymentNotices/{id}`. Une commande déjà réussie n'est pas redébitée par un second avis.
- Les clés, les numéros de carte et les jetons secrets ne sont pas écrits dans Firestore. Le journal d'audit note l'action, pas le moyen de paiement.

Le régime retenu est la franchise en base : « TVA non applicable, article 293 B du Code général des impôts ». Aucune facture numérotée n'est produite. L'e-mail de commande et le reçu Mollie sont deux documents distincts. La configuration restante est décrite dans `docs/MISE_EN_SERVICE.md`.

## Parcours

1. Le contexte déclaré pendant la création choisit les offres. Famille et amis ne voient que l'offre gratuite. Une organisation voit Association, Entreprise, Entreprise Plus et Grand groupe. Le contexte n'est pas vérifié au-delà de cette déclaration.
2. Le brouillon s'enregistre sans paiement.
3. `/evenements/{id}/reglement` affiche l'événement, l'offre, la capacité et le prix final. La case des conditions n'est pas précochée.
4. `createCheckout` crée la commande côté serveur, au prix du catalogue.
5. L'avis du prestataire, vérifié, passe la commande à réussi, annulé, échoué ou remboursé.
6. L'offre n'est débloquée qu'après cet avis. Le tirage reste une action séparée, avec vérification des exclusions.

États de la commande : en attente, réussi, annulé, échoué, remboursé. Un échec change le statut commercial et ne modifie ni les participants ni les exclusions.

## Capacité et changement d'offre

Le compteur inclut toute personne du tirage, y compris l'organisateur s'il participe. Un coorganisateur qui n'est pas dans la liste ne compte pas. Les plafonds sont appliqués à la saisie, à l'import, à l'inscription et avant le lancement. Les inscriptions simultanées passent par une transaction. Personne n'est retiré en silence.

Avant le tirage, le passage d'Entreprise déjà payée à Entreprise Plus coûte 20 €, la différence annoncée. Tout autre changement d'une offre déjà payée est refusé : pas de supplément ni de remboursement automatique. Après le tirage, un paiement ne modifie pas le groupe.

Dupliquer un événement reprend la configuration utile et remet le paiement à zéro. Une offre payée ne expire pas avant le jour de l'événement. La conservation relève de la politique de données.

## Ce qui n'est pas réservé au paiement

La sécurité, l'accessibilité, la suppression du compte et la protection des données restent disponibles. L'import de fichier, les exclusions de groupe, les thèmes et la personnalisation d'e-mails déjà présents dans l'application ne sont pas retirés pour créer une restriction commerciale. La grille ajoute : la capacité, le paiement avant le tirage d'une offre payante, les coorganisateurs et le suivi par équipe d'Entreprise Plus.

Les coorganisateurs lisent la gestion de l'événement. Ils ne lisent pas `serverData`. Le coffre du code d'inscription reste à l'organisateur principal.

## E-mails et pièces

Quatre modèles, sans emoji, avec l'identité Sous pli et sans attribution secrète : confirmation de paiement, échec avec lien de reprise, changement d'offre, remboursement effectivement confirmé. Ils portent l'événement, l'offre, le montant, la devise et la référence. Ce sont des reçus de commande, pas des factures JavaChrist.

Sans `RESEND_API_KEY` et `MAIL_FROM_ADDRESS`, le message est capturé localement et n'est pas annoncé comme envoyé. La demande de devis est enregistrée dans `quoteRequests` et répond `emailed: false`.

## Avant les paiements réels

À renseigner, et non inventés ici :

- régime fiscal et TVA (`billingConfig.taxRegime` vaut `non_verifie`) ;
- mentions légales, numéro de TVA, médiateur ;
- politique de remboursement ;
- parcours de rétractation adapté au service, sans renonciation automatique ;
- numérotation et mentions si une facture est un jour émise.
