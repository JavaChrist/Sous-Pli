# Données et droits

Firestore refuse tout par défaut. Le navigateur ne peut pas écrire un tirage, une invitation, un fil serveur ou un secret d'e-mail.

## Lecture autorisée

- `users/{uid}` et ses attributions, notifications, fils et messages : le compte concerné.
- `events/{id}` : l'organisateur, un coorganisateur, ou une personne dont `memberIndex` porte son identifiant. La liste des événements ne renvoie que ceux de l'organisateur connecté. Un coorganisateur retrouve les siens dans `users/{uid}/coEvents`.
- `members` et `memberPrivate` : organisateur, coorganisateur, ou participant pour la liste publique des membres. Les adresses restent hors de la vue participant.
- `publishedBoard` : participants, et seulement si le mode est public et que l'échange est tiré, révélé ou archivé.
- `organizerVault` : organisateur. Le code d'inscription y est recopié pour qu'il puisse le relire. Le jeton personnel ne l'est pas.

## Interdit au client

`serverData`, `serverThreads`, `invitationTokens`, `joinCodes`, `mailOutbox`, `mailCapture`, `mailSecrets`, `contactMessages`, `rateLimits`, `wishAccess`, `payments`, `paymentNotices`, `quoteRequests`.

Un utilisateur ne peut pas modifier l'offre, les droits payés ni le statut de paiement : l'écriture d'un événement et de ces collections est refusée au client. Les coorganisateurs ne lisent pas `serverData`. Le coffre d'inscription reste à l'organisateur principal.

Le jeton d'invitation est stocké sous la forme d'un condensat SHA-256. L'ouverture du lien appelle `inspectInvitation`, qui ne consomme pas le jeton. Seul `acceptInvitation`, dans une transaction, le revendique.

## Stockage

L'envoi de nouvelles images de souhaits est refusé, dans l'interface et dans les règles. Les fichiers déjà présents restent lisibles par l'organisateur, par la personne concernée, ou par un membre autorisé dans `wishAccess`. Ils ne sont pas affichés. L'inventaire du worker de conservation les liste. Il ne les supprime en masse que dans la purge d'un événement arrivé à échéance, et seulement si `RETENTION_APPLY=true`.

## Compte

L'export ne contient que le profil, les attributions, les notifications et les fils de la personne. La suppression est refusée si la personne organise encore un échange ouvert, en inscription, prêt, tiré ou révélé. Elle retire ensuite le profil, le compte, les index, les souhaits, les fichiers de souhaits, les copies de messages du compte et les e-mails en attente. Les messages déjà reçus par un correspondant restent chez lui jusqu'à la fin de l'événement. Les pièces de paiement ne sont pas effacées avec le compte.

Le worker `retentionWorker` tourne chaque jour à 9 h 15, heure de Paris. Sans `RETENTION_APPLY=true`, il n'écrit qu'un rapport dans `retentionReports`.
