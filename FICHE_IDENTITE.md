# Sous pli

## Présentation en une phrase
Sous pli permet à une personne d'organiser un échange de cadeaux secret, en famille, entre amis, dans une association ou au travail, afin que chacun découvre son destinataire dans un espace protégé.

## Public visé
Les personnes qui organisent l'échange, les participantes et participants, y compris un enfant accompagné par un adulte, ainsi que les associations et les entreprises dont l'organisateur prend en charge l'événement.

## Problème résolu
Organiser un tirage au sort sans dévoiler les attributions dans les e-mails, les aperçus de liens ou les notifications, tout en permettant les invitations, les souhaits et les messages.

## Fonctionnalités principales
- Préparer l'échange : occasion, date, budget, règles, participants et exclusions.
- Inviter par un lien personnel ou un code, puis accepter ou refuser les inscriptions.
- Tirer au sort sur le serveur : chacun ne voit que son propre résultat, jusqu'à la révélation collective.
- Échanger des souhaits et des messages sans publier le nom tiré au sort.
- Choisir une offre gratuite ou payante une seule fois par événement. Les participants ne paient pas. Au-delà de 300 personnes, la demande est un devis, sans paiement automatique.

## Statut
En développement.
Le parcours est implémenté dans le dépôt, de la création de l'échange jusqu'à la révélation, l'annulation et la suppression. L'adresse déclarée est https://souspli.fr, avec Vercel et Firebase prévus, mais le dépôt n'établit pas que le site est actuellement en ligne. Les e-mails ne partent que si l'envoi est configuré ; sinon ils sont seulement conservés. Les paiements ne sont créés que si une clé Mollie est présente : une clé réelle encaisse, une clé de test n'encaisse pas. Les suppressions automatiques de conservation ne s'exécutent que si elles sont explicitement activées. Le dépôt d'une photo de souhait est refusé. L'application ne produit pas de facture numérotée.

## Adresse du site
https://souspli.fr
