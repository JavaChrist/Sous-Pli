# Tirage

Le tirage s'exécute dans une fonction callable, en `europe-west1`, avec le SDK Admin. Le navigateur reçoit un succès ou un échec, jamais une attribution qui ne le concerne pas.

## Propriétés

- Chaque personne est exclue d'elle-même.
- Les exclusions directionnelles, réciproques, de groupe et d'historique sont dures. Elles ne sont pas retirées si le tirage est difficile.
- Éviter qu'une personne rende le cadeau à celle qui lui offre est une préférence. Si elle est impossible, le tirage peut aboutir avec le drapeau `reciprocalPreferenceRelaxed`.
- La recherche est un retour arrière aléatoire, plus contraint d'abord, avec un budget de nœuds. Ce n'est pas un tirage uniforme sur l'ensemble des solutions.
- Un repli par flot n'est utilisé que s'il n'y a aucun verrou et que la préférence réciproque est désactivée.
- Un échec ne contient pas d'attributions partielles.
- Le nombre de cadeaux par personne va de 1 à 5. Le dernier participant ne doit pas échouer à cause d'un choix glouton.

## Lancement

La transaction relit les participants et les contraintes. La même clé d'idempotence rejoue le reçu. Une autre clé, après un tirage déjà écrit, est refusée. Un verrou encore actif est refusé.

Les vues, les fils, les souhaits et les e-mails sont écrits après la transaction. Une personne qui a déjà découvert son résultat conserve cette information lors d'un ajout ou d'un retrait tardif. Si des messages existent, le changement tardif est refusé.

L'organisateur voit des compteurs et la date de découverte, pas les paires.
