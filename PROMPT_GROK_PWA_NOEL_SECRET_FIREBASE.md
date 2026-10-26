# Prompt complet pour Grok — PWA de Père Noël secret avec Firebase

Document de cadrage et d’exécution — 22 octobre 2026.

Copie ce document intégralement dans Grok. Le contenu ci-dessous constitue une instruction de conception et de développement, pas une simple demande de conseils.

---

## 1. Mission et résultat attendu

Tu es un développeur full-stack senior, architecte Firebase, spécialiste PWA et designer produit. Construis une application web complète, responsive et installable permettant d’organiser des échanges de cadeaux secrets en famille, entre amis, en association ou en entreprise.

Le produit doit couvrir les grandes fonctionnalités de Tirokdo et les améliorations précisées ici, avec sa propre identité, ses textes, ses visuels et son code. Ne copie ni la marque, ni les ressources, ni l’interface exacte de ce service.

Nom de travail : « Noël Secret ». Centraliser ce nom dans une configuration pour pouvoir le remplacer. Ne pas prétendre avoir vérifié sa disponibilité commerciale ou celle d’un domaine.

Objectif : livrer une application exploitable avec persistance, autorisations, tirage fiable, invitations, souhaits, messagerie et installation PWA. Une maquette, des boutons sans action ou des données simulées en production ne constituent pas une livraison.

L’interface et les messages destinés aux utilisateurs sont en français. Code et noms techniques cohérents en anglais. Concevoir d’abord pour le mobile, sans imposer l’installation ni un téléchargement depuis un store pour participer.

## 2. Contraintes non négociables

- Utiliser Firebase, et non Supabase. Aucun composant Supabase, aucune dépendance Supabase.
- Aucun emoji dans l’application, les e-mails, les notifications, les textes de démonstration ou les états vides. Utiliser des icônes SVG cohérentes, par exemple Lucide.
- Utiliser des modales internes cohérentes pour les formulaires contextuels, confirmations et actions sensibles. Ne jamais utiliser window.alert, window.confirm ou window.prompt.
- Prévoir impérativement une modale de mise à jour PWA, détaillée plus bas.
- Respecter les safe areas, particulièrement les en-têtes et navigations sur iPhone et Android.
- Ne pas placer de secret Firebase Admin, SMTP, clé privée ou jeton serveur dans le navigateur.
- Les accès, états du tirage, dates de révélation et droits doivent être contrôlés côté serveur. L’interface seule ne constitue jamais une protection.
- Ne pas demander de confirmations à chaque choix technique courant. Prendre des décisions cohérentes et les documenter. Signaler seulement les blocages réels.
- Ne pas déployer en production, activer une facturation ou envoyer des invitations réelles sans instruction explicite. Préparer et tester localement avec les émulateurs.

## 3. Stack et déploiement

Base recommandée : Next.js App Router, TypeScript strict, Tailwind CSS, composants accessibles basés sur Radix/shadcn, React Hook Form et Zod. Utiliser des versions stables compatibles au moment de l’implémentation, après vérification de leurs documentations officielles. Éviter les dépendances inutiles.

Services obligatoires :

- Firebase Authentication : comptes organisateurs, connexion Google et e-mail/mot de passe, réinitialisation, vérification d’adresse. Participants avec session Firebase anonyme ou compte lié.
- Cloud Firestore : événements, membres, contraintes, souhaits, conversations, invitations et suivi.
- Cloud Functions : tirage, accès par invitation, révélation, opérations privilégiées, e-mails et traitements planifiés.
- Cloud Storage : images facultatives de souhaits et logos, avec règles privées adaptées.
- Firebase Cloud Messaging : notifications web lorsque le navigateur, l’installation et les permissions le permettent.
- Firebase App Check : protection complémentaire, sans remplacer Auth et les règles.
- Firebase Emulator Suite : développement et tests locaux.

Pour Next.js complet, préparer Firebase App Hosting si compatible avec les fonctions utilisées. Ne pas présenter Firebase Hosting statique comme capable d’exécuter seul des fonctions SSR Next.js. Si un autre hébergement est nécessaire, expliquer le choix sans modifier la base Firebase.

Choisir les régions européennes compatibles avant la création des ressources et documenter les contraintes. Garder fonctions et données proches lorsque possible. Signaler les services nécessitant le plan Blaze, les coûts potentiels des SMS, e-mails, tâches et lectures ; ne pas annoncer une gratuité garantie. Prévoir alertes budgétaires et limites applicatives, en précisant qu’une alerte n’est pas un plafond de dépenses.

Les e-mails transactionnels passent par un prestataire adapté configuré côté serveur. Fournir un adaptateur et un mode local capturant les messages, pas un envoi fictif affiché comme réussi. Firebase Auth ne remplace pas un service d’invitations métier.

## 4. Identité et expérience

Créer un univers chaleureux, élégant et festif : fond clair, vert profond, bordeaux et touches dorées avec contraste suffisant. Cartes sobres, arrondis, typographie lisible, animations discrètes. Éviter la surcharge de flocons et les animations permanentes.

Prévoir une identité utilisable toute l’année pour des échanges entre amis ou collègues. Les thèmes d’événement peuvent varier sans reconstruire l’application.

Navigation mobile : accueil, mes événements, mes participations, notifications et profil. Adapter les entrées à l’état connecté. Sur ordinateur, utiliser une navigation latérale ou supérieure cohérente.

Chaque écran possède ses états chargement, vide, erreur, hors connexion et succès. Une erreur de lecture ne doit pas être présentée comme une liste vide. Conserver les formulaires après une erreur. Les boutons occupés empêchent les doubles soumissions.

## 5. Modales : exigences détaillées

Créer des composants partagés Dialog, ConfirmationDialog et FormDialog. Utiliser une véritable sémantique de dialogue avec titre, description et noms accessibles.

- Piéger le focus, le placer correctement à l’ouverture et le restituer à la fermeture.
- Respecter le clavier et les lecteurs d’écran. La touche Échap ferme les dialogues ordinaires ; documenter les exceptions liées à une opération en cours.
- Ne pas fermer un formulaire modifié par simple clic sur le fond. Demander confirmation avant d’abandonner les modifications.
- Pour une suppression, afficher la conséquence précise et une action destructive clairement nommée.
- Sur mobile, largeur adaptée, hauteur limitée à la zone visible, contenu défilant et actions accessibles avec clavier virtuel ouvert.
- Respecter env(safe-area-inset-*) et éviter les boutons masqués par les barres système.
- Éviter les modales empilées et les parcours complexes entièrement enfermés dans des dialogues.
- Utiliser des pages pour les grands espaces : tableau de bord, événement, messagerie, souhaits. Réserver les modales aux actions contextuelles.
- Utiliser des notifications discrètes pour les succès non bloquants ; une notification ne remplace pas une confirmation sensible.

Modales minimales : ajouter/modifier un participant, exclusions, invitation et partage, confirmation du tirage, révélation personnelle, modification des règles, suppression/annulation, signalement, installation PWA et mise à jour.

## 6. Page publique et création d’événement

Accueil avec proposition de valeur, explication en quatre étapes, aperçu des fonctions et appel à créer un événement. Pages publiques d’aide, contact, confidentialité, conditions et mentions à compléter avec les informations réelles de l’éditeur. Ne pas inventer de témoignages, statistiques ou certifications.

Permettre de commencer la préparation avant connexion ; conserver le brouillon local sans y stocker de secrets. Demander la connexion pour enregistrer l’événement côté serveur. Réconcilier proprement le brouillon après connexion.

Assistant en étapes :

1. Nom, occasion, date locale, heure éventuelle, fuseau IANA, lieu facultatif, description et règles.
2. Budget facultatif avec minimum/maximum, devise EUR par défaut, règles fait main ou seconde main.
3. Participants saisis manuellement, importés ou inscrits via lien.
4. Exclusions et paramètres avancés.
5. Récapitulatif, vérification de faisabilité, lancement explicite et invitations.

Les thèmes visuels personnalisent l’événement, ses e-mails et son espace participant. L’organisateur choisit explicitement s’il participe lui-même.

Distinguer enregistrer le brouillon, ouvrir les inscriptions, lancer le tirage et envoyer les invitations. Aucun envoi réel implicite lors d’une sauvegarde.

## 7. Participants et invitations

Participant : identifiant stable, prénom/pseudonyme, nom facultatif, adresse e-mail facultative selon le canal choisi, groupe d’exclusion, statut et identité Firebase associée après acceptation. Accepter les prénoms identiques grâce aux identifiants, sans confondre les personnes.

Import CSV et Excel avec aperçu, correspondance des colonnes, détection d’erreurs, validation et contrôle des doublons. Protéger les exports contre l’injection de formules. Ne pas exécuter de contenu importé.

Deux types de liens distincts :

- Lien d’inscription au groupe : permet de demander à rejoindre, mais ne donne accès à aucune identité existante. Approbation de l’organisateur par défaut, clôture des inscriptions et limitation des abus.
- Invitation personnelle : permet de revendiquer une participation précise. Jeton fort, expirant, stocké sous forme d’empreinte, échange serveur contre une association de session. Un jeton consommé ne peut pas être repris par une autre personne. Prévoir récupération et révocation.

Partager un lien avec la feuille de partage du système ou copier le lien pour WhatsApp/SMS. Aucun envoi WhatsApp/SMS automatique sans intégration et configuration explicites.

Ne pas inclure le nom tiré au sort dans les invitations, aperçus de liens, titres de notifications ou métadonnées publiques. Ne pas consommer une invitation lors d’un simple GET : les scanners d’e-mails et aperçus de messagerie ne doivent pas revendiquer une identité. L’acceptation est une action explicite.

Après échange du jeton, retirer le secret de l’URL. Éviter sa journalisation, les scripts tiers sur la page et les fuites via Referer. Prévoir une session persistante sécurisée et l’accès depuis un autre appareil après vérification adaptée.

Prévoir des participants sans e-mail via invitation privée. Pour les enfants, prévoir une participation gérée par un adulte avec accès distinct ; expliquer que cet adulte peut connaître le tirage de l’enfant. Ne pas prétendre garder ce résultat secret vis-à-vis du responsable.

## 8. Exclusions et moteur de tirage

Exclusions : soi-même toujours interdit ; exclusions directionnelles individuelles ; exclusions réciproques explicites pour couples ; groupes dont les membres ne peuvent pas se tirer entre eux ; anciennes attributions exclues lors d’une reprise annuelle.

Éviter les attributions réciproques A vers B et B vers A comme préférence optionnelle. Si cette préférence n’est pas une contrainte stricte, indiquer quand elle ne peut pas être satisfaite. Ne jamais assouplir silencieusement une exclusion stricte.

Prendre en charge de un à cinq destinataires distincts par participant, dans les limites du groupe. Pour k cadeaux, chaque membre doit offrir et recevoir exactement k cadeaux, sans doublon et sans se tirer lui-même.

Implémenter un algorithme serveur de matching contraint avec source aléatoire cryptographique. Éviter le choix glouton successif qui laisse le dernier participant bloqué. Pour k > 1, utiliser une méthode adaptée de flot/matching capacitaire. Borner les ressources et tester les cas impossibles.

Ne pas revendiquer une distribution uniforme de toutes les solutions si elle n’est pas démontrée : documenter les propriétés réelles de l’algorithme et ses limites.

Avant lancement : validation des participants, limites, contraintes et faisabilité. Si impossible, afficher des explications actionnables uniquement à l’organisateur ; ne pas révéler les exclusions aux autres participants.

Au lancement : figer une version de configuration, calculer toutes les attributions côté serveur puis les publier atomiquement. Verrou serveur et clé d’idempotence contre doubles clics et requêtes concurrentes. Aucun tirage partiel visible. L’animation de découverte ne recalcule jamais le résultat.

## 9. Modes de confidentialité

A. Secret classique : chacun découvre son ou ses destinataires ; les autres attributions restent privées. L’organisateur ne voit que la progression.

B. Public : les attributions deviennent visibles aux membres après lancement, selon une règle clairement annoncée avant participation.

C. Double mystère : le donneur ne voit pas l’identité de son destinataire avant révélation. Souhaits et messagerie utilisent un pseudonyme temporaire. Expliquer que les textes ou photos des participants peuvent permettre de deviner une identité ; ne pas promettre un anonymat absolu.

Mode A par défaut ; B et C dans les options avancées. Une fois lancé, ne pas changer silencieusement le niveau de confidentialité.

La révélation collective est une action explicite de l’organisateur, autorisée à partir de la date/heure configurée dans le fuseau de l’événement. Le simple passage du jour J ne publie rien automatiquement. Prévoir aperçu de la conséquence et confirmation.

Le secret vis-à-vis de l’organisateur est une règle d’accès applicative. Ne pas le présenter comme un chiffrement de bout en bout empêchant l’exploitant ou un administrateur technique privilégié de lire la base.

## 10. Tableaux de bord et cycle de vie

États explicites : brouillon, inscriptions ouvertes, prêt, tirage lancé, résultats révélés, archivé et annulé. Les transitions sont validées côté serveur et auditées.

Organisateur : gérer ses événements, participants, exclusions et invitations ; suivre invitation envoyée/échec, acceptation, résultat consulté et souhaits renseignés. Ne pas confondre e-mail remis, e-mail ouvert et attribution consultée. La consultation est enregistrée uniquement sur action authentifiée, pas par un aperçu automatique.

Actions : relance individuelle ou groupée avec plafond, correction d’adresse, duplication annuelle, annulation, archivage et suppression encadrée.

Après lancement, les attributions sont immuables. Les changements de budget, lieu et consignes sont possibles avec notification. Les exclusions et participants ne se modifient pas librement.

Ajout tardif : autorisé uniquement si une solution conserve toutes les attributions déjà découvertes et respecte toutes les contraintes. Calcul côté serveur, contrôle de concurrence et opération atomique. Si impossible, expliquer et proposer l’annulation/recréation explicite. Ne pas attribuer silencieusement un autre destinataire à une personne.

Retrait après lancement : même exigence ; aucune suppression isolée qui laisserait quelqu’un sans cadeau. Si cette fonction avancée n’est pas encore implémentée, la désactiver honnêtement avec explication.

## 11. Espace participant, souhaits et messagerie

Accueil personnel : événement, date, budget, règles, statut et bouton de découverte. Révélation dans une modale élégante avec animation facultative et accessible, compatible prefers-reduced-motion. Prévoir une action claire pour masquer de nouveau le résultat à l’écran.

Liste de souhaits : texte libre, plusieurs idées, liens HTTPS validés, prix indicatif, préférences, tailles facultatives et choses à éviter. Images facultatives privées. Ne pas encourager la saisie de données sensibles inutiles.

Ne pas récupérer arbitrairement côté serveur les URL de produits : si prévisualisation distante, protéger contre SSRF, réseaux privés, redirections et fichiers surdimensionnés. Une liste de liens simple est préférable à une prévisualisation non sécurisée.

Messagerie anonyme entre donneur et destinataire, conversations séparées lorsque plusieurs cadeaux sont prévus. Pseudonymes neutres, dates, compteurs de non-lus, limites de taille et de fréquence, signalement et blocage encadré. Ne jamais retourner dans les documents accessibles l’identité du donneur caché.

Pas de pièces jointes de messagerie dans le premier lot ; si ajout ultérieur, contrôles et règles dédiés. Les notifications indiquent seulement qu’un message est disponible, sans révéler l’attribution.

Mode jour J : déroulement progressif de l’échange, cadeaux distribués et révélation autorisée. Une commande participant ne doit pas pouvoir publier les résultats de tout le groupe.

## 12. PWA et modale de mise à jour obligatoire

Fournir manifest, icônes 192/512 et maskable, apple-touch-icon, noms, couleurs, mode standalone, service worker et écran hors connexion. L’application reste utilisable en navigateur normal.

Installation : proposer au moment opportun, avec possibilité de refuser et sans répétition intrusive. Sur iPhone, afficher une aide d’ajout à l’écran d’accueil adaptée au navigateur. Vérifier le comportement réel sur Safari/iOS et Android.

Mises à jour :

1. Chaque build possède un identifiant stable. Un endpoint ou fichier de version est servi sans cache obsolète.
2. Rechercher une mise à jour au démarrage, toutes les 60 secondes lorsque la page est visible, au retour du focus et au retour à l’état visible. Éviter les vérifications concurrentes et les requêtes excessives en arrière-plan.
3. Détecter un nouveau service worker prêt à l’activation ; ne pas annoncer une mise à jour installable si le nouveau build n’est pas disponible.
4. Ouvrir une modale : titre « Une nouvelle version est disponible », court résumé facultatif, actions « Mettre à jour » et « Plus tard ». Aucun emoji.
5. Ne jamais recharger automatiquement pendant une saisie, un tirage, une invitation ou une opération sensible. Préserver les brouillons non secrets et prévenir si une saisie ne peut pas être conservée.
6. À la demande de l’utilisateur, activer le worker en attente avec un message SKIP_WAITING ; attendre controllerchange puis recharger une seule fois. Gérer aussi le cas sans worker actif, les mises à jour en échec et les délais d’attente.
7. Synchroniser les onglets lorsque pertinent ; ne pas provoquer de boucles de rechargement ni plusieurs modales simultanées.
8. Enregistrer par appareil la dernière version acceptée, par exemple lastAcknowledgedAppVersion. Réinitialiser les états transitoires après activation réussie. « Plus tard » évite une réouverture toutes les 60 secondes ; définir un rappel raisonnable ou à la prochaine session.
9. Si le réseau est absent, expliquer l’impossibilité temporaire sans casser l’application. Une erreur de vérification ne doit pas apparaître comme une nouvelle version.
10. Documenter et tester le cycle déploiement N vers N+1, le premier chargement, plusieurs onglets et la conservation des brouillons.

Cache : ressources statiques publiques seulement selon stratégie documentée. Ne jamais mettre en cache service worker les invitations, attributions, messages, réponses authentifiées ou jetons. Vérifier aussi les caches Next.js et HTTP. Désactiver la persistance Firestore durable sur cet usage partagé et sensible sauf décision explicite ; vider les données locales concernées à la déconnexion. Hors connexion, ne pas générer ni prétendre valider un tirage.

Notifications push : demander la permission après une action contextualisée, pas au premier affichage. Gérer refus, désabonnement, changement de token et appareils multiples. Vérifier les restrictions iOS et conserver un recours e-mail. Une notification n’est jamais une preuve de livraison ou de lecture.

## 13. Architecture Firestore et sécurité

Proposer un schéma documenté, par exemple :

- users/{uid} : préférences et profil minimal.
- events/{eventId} : métadonnées sans attributions secrètes.
- events/{eventId}/members/{memberId} : profil membre autorisé, sans jeton ni association secrète.
- events/{eventId}/constraints/{constraintId} : contraintes privées organisateur/serveur.
- events/{eventId}/wishlists/{memberId} : souhaits avec droits adaptés au mode.
- collections serveur privées : invitations, attributions complètes, routage anonyme, tentatives et file d’e-mails.
- vues personnelles minimales si nécessaires, rédigées par le serveur, ne contenant que ce que leur propriétaire est autorisé à voir.
- notifications et subscriptions privées par utilisateur.

Adapter le schéma aux limites réelles de Firestore. Les règles autorisent ou refusent un document entier : elles ne cachent pas certains champs d’un document déjà lisible. Séparer les secrets physiquement ; ne pas mettre une attribution globale dans un document d’événement lu par tous.

Pour les messages anonymes, ne pas exposer l’UID de l’expéditeur caché dans un document accessible au destinataire. Séparer routage privé et présentation. Privilégier une API serveur pour les données dont les droits ne s’expriment pas simplement dans les règles.

Firebase Admin contourne les règles : chaque fonction doit vérifier l’identité, le rôle dans l’événement, l’état, les limites et la propriété des objets. Un UID transmis par le client n’est pas une preuve d’identité.

Fournir règles Firestore et Storage en refus par défaut, tests d’isolation entre événements, index, transactions et configuration des émulateurs. Valider tailles, types, champs autorisés et transitions. Storage privé, limites d’images, chemins contrôlés et suppression des métadonnées sensibles quand possible. Éviter les URL de téléchargement permanentes partagées comme si elles étaient privées.

Prévoir pagination, listeners limités aux écrans actifs et nettoyage des abonnements. Pas de lecture globale de tous les membres ou messages de tous les événements.

## 14. Fiabilité, e-mails et exploitation

Les fonctions et tâches peuvent être rejouées : toutes les opérations sensibles sont idempotentes. Utiliser une file/outbox persistante pour les invitations avec statut, tentatives bornées, délai entre relances et déduplication. Ne pas envoyer un e-mail dans une transaction susceptible d’être rejouée.

Journaux techniques sans jetons, messages privés, attributions ou adresses en clair inutiles. Audit des changements sensibles sans recopier les secrets. Fournir supervision des échecs, sauvegarde/restauration adaptée et procédure d’annulation de déploiement.

Configurer SPF, DKIM et DMARC pour le domaine d’envoi lors de la mise en service. Vérifier la remise des e-mails avec un environnement de test avant les invitations familiales réelles.

Confidentialité : collecte minimale, règles de conservation explicites, suppression de compte et d’événement, export personnel sans fuite d’autres membres. Expliquer comment une suppression interagit avec un échange en cours. Préparer les pages légales à faire compléter ; ne pas afficher une conformité juridique certifiée.

Aucune publicité, aucun tracker marketing et aucune affiliation cachée par défaut.

## 14 bis. E-mails personnalisés par événement — exigence obligatoire

Créer un véritable système de modèles transactionnels, pas un seul e-mail générique. Séparer le contexte (famille, amis, entreprise, association) de l’occasion (Noël, échange annuel ou autre), puis proposer un thème par défaut adapté à leur combinaison.

Trois ensembles de modèles minimum :

- Noël en famille : présentation chaleureuse et festive, tutoiement par défaut, nom de la famille et message personnel de l’organisateur.
- Échange entre amis : présentation conviviale, thème de la soirée, consignes et signature personnalisée.
- Entreprise/association : présentation sobre, logo, nom de la structure, couleurs de marque, service/équipe facultatif, ton professionnel et tutoiement/vouvoiement configurable.

L’organisateur personnalise depuis une page dédiée : thème, palette contrôlée, logo, bannière facultative, nom affiché de l’expéditeur, objet, introduction, consignes, texte du bouton et signature. Utiliser des champs structurés et un éditeur limité, jamais du HTML arbitraire ou du JavaScript. Les liens sensibles et mentions de service restent protégés.

Variables autorisées et validées : prénom du participant, nom de l’événement, organisateur, structure, date et heure formatées dans le fuseau de l’événement, budget, devise, lieu, règles et lien personnel approprié. Ne jamais exposer l’identité du destinataire tiré au sort dans un objet, un pré-en-tête, une notification ou un e-mail ordinaire. Les résultats se consultent dans l’espace protégé.

Fournir pour chaque contexte les modèles suivants : invitation/acceptation, tirage disponible, invitation renvoyée, rappel de consultation, rappel des souhaits, nouveau message anonyme, modification des informations pratiques, rappel avant l’événement, révélation collective disponible et annulation. Les notifications de messagerie ne contiennent ni identité cachée ni contenu privé par défaut.

Prévoir des exemples de textes complets français, sans emoji, pour chaque ensemble. Les e-mails de sécurité et récupération d’accès restent clairement identifiables et ne doivent pas être confondus avec une invitation.

Édition et validation :

- Aperçu ordinateur/mobile dans une modale utilisant uniquement des données fictives.
- Bouton d’envoi de test à l’adresse vérifiée de l’organisateur ; le test ne contient aucun vrai jeton de participant ni attribution et reste soumis à une configuration d’envoi réelle.
- Contrôle des variables manquantes avant envoi, solution de repli pour logo indisponible et échappement de tous les contenus.
- Sauvegarde d’une version du thème par événement ; une modification d’un thème global ne change pas rétroactivement les invitations déjà préparées.
- Stocker la version du modèle utilisée avec chaque tâche d’envoi pour reproduire et diagnostiquer un envoi sans conserver inutilement de secrets.
- Un e-mail par destinataire, jamais une liste familiale ou d’employés exposée dans À/Cc.
- HTML responsive compatible avec les grandes messageries, version texte, images avec texte alternatif et bouton doublé d’un lien utilisable.
- Utiliser des images publiques de présentation sans informations privées ; ne pas inclure les photos privées des souhaits dans des ressources publiques d’e-mails.
- En-tête From utilisant un domaine vérifié. Le nom affiché peut varier, mais ne pas usurper l’adresse de l’organisateur. Reply-To seulement vers une adresse vérifiée et explicitement autorisée.
- Préférences séparant relances facultatives, notifications d’activité et messages indispensables à l’accès ou à une annulation. Aucun abonnement marketing implicite.
- Les préférences et plafonds sont revérifiés avant chaque envoi ; gérer échecs, rebonds et adresses invalides.

Tests obligatoires supplémentaires : invitation familiale et invitation entreprise visuellement distinctes ; variables correctes et aucune variable brute restante ; absence d’emoji ; aucune fuite d’attribution ; données fictives dans les aperçus/tests ; protection contre injection HTML et injection d’en-têtes ; un destinataire ne voit aucune autre adresse. Livrer les modèles et leur éditeur dans le projet, avec captures ou rendus de vérification si les outils le permettent.

## 15. Monétisation préparée, sans paiement fictif

Séparer les droits produit et le moteur de paiement. Proposition à rendre configurable :

- Offre famille gratuite : tirage classique, exclusions, invitations, souhaits et suivi, dans des limites documentées.
- Option événement : thèmes, personnalisation, animation de soirée et fonctions avancées.
- Offre entreprise/association : logo, import et gestion de groupes plus importants.

Pas d’abonnement mensuel imposé pour un usage annuel. Aucun tarif inventé présenté comme validé. Sans prestataire configuré, ne pas afficher de bouton de paiement fonctionnel fictif. Prévoir un module désactivé et documenté ; les fonctions principales restent testables sans paiement.

## 16. Écrans à livrer

Accueil public ; aide et questions fréquentes ; connexion/inscription/récupération ; tableau organisateur ; assistant de création ; gestion d’événement et participants ; gestion des exclusions ; acceptation d’invitation ; inscription à un groupe ; tableau participant ; révélation ; souhaits ; messagerie ; notifications ; déroulement jour J ; historique et duplication ; profil et préférences ; pages légales ; écrans accès refusé, lien expiré, hors connexion et erreur.

Ne pas laisser d’écran orphelin. Les routes privées vérifient la session et les droits. Les écrans publics ne contiennent aucune donnée privée dans leurs métadonnées ou rendu initial.

## 17. Validation et critères d’acceptation

Fournir des tests unitaires, d’intégration sur émulateurs et de parcours pour les fonctions critiques. Ne pas se contenter de tests de rendu.

Cas obligatoires :

1. Un organisateur crée un groupe de six personnes dont deux couples ; les contraintes sont respectées et chacun donne/reçoit un cadeau.
2. Un groupe de trois fonctionne lorsque ses contraintes le permettent ; un cas impossible est expliqué sans tirage partiel.
3. Un groupe à exclusions directionnelles et un groupe avec plusieurs cadeaux respectent les degrés attendus.
4. Deux lancements simultanés produisent une seule version de tirage.
5. Un participant ne peut lire ni l’attribution d’un autre ni un événement extérieur, même par requête directe.
6. L’organisateur ne récupère pas les attributions secrètes via API, Firestore ou export avant révélation autorisée.
7. En double mystère, aucun identifiant caché ne fuit dans les réponses, souhaits, messages et notifications.
8. Un scanner d’e-mail ne consomme pas une invitation ; un jeton expiré, révoqué ou déjà revendiqué par un autre compte est refusé.
9. Une relance ou une répétition de tâche ne recrée pas de tirage et n’envoie pas de doublons non maîtrisés.
10. La révélation collective est refusée avant l’échéance serveur ; fuseau, passage de minuit et heure d’été sont couverts.
11. Un ajout tardif ne change aucune attribution découverte et échoue proprement si impossible.
12. Une mise à jour PWA N vers N+1 ouvre la modale, respecte « Plus tard », préserve le formulaire et recharge une seule fois après acceptation.
13. Plusieurs onglets et une perte réseau n’entraînent ni double opération ni boucle de mise à jour.
14. Déconnexion et changement de compte ne montrent pas les données privées du compte précédent.
15. Le parcours fonctionne à 320 px, sur iPhone avec safe areas, sur Android et sur ordinateur ; modales accessibles au clavier et avec clavier virtuel.
16. Aucun emoji dans les contenus livrés ; aucune utilisation des dialogues natifs du navigateur.

Tester également règles Storage, import invalide, noms identiques, liens malveillants, plafonds et suppression. Rapporter honnêtement les tests exécutés, réussis, échoués et ceux qui exigent un appareil réel. Un simulateur ne valide pas à lui seul les notifications iOS.

## 18. Organisation de l’exécution

Ne pas réduire la demande à une landing page. Procéder par lots cohérents jusqu’à couverture du périmètre complet :

- Socle : design system, Firebase, auth, règles, navigation et émulateurs.
- Parcours principal : création, membres, invitations, exclusions, tirage classique et suivi.
- Échange : souhaits, messages, modes avancés et jour J.
- Complétude : multi-cadeaux, duplication, modifications tardives encadrées, import, notifications et personnalisation.
- PWA : installation, cache sûr, modale de mise à jour et tests de version.
- Qualité : tests d’isolation, accessibilité, performance, documentation et vérification finale.

Si le contexte ou l’environnement ne permet pas de terminer un lot, enregistrer un état de reprise précis et distinguer implémenté, testé, configuré et restant. Ne jamais annoncer « terminé » avec des fonctions simulées ou des services non raccordés.

## 19. Livrables attendus de Grok

1. Projet complet structuré et exécutable, pas seulement des extraits.
2. Configuration Firebase, règles, index, fonctions et scripts des émulateurs.
3. Fichier d’exemple de configuration sans secrets réels, avec séparation client/serveur.
4. Données de démonstration uniquement pour l’environnement local et procédure de remise à zéro.
5. Tests critiques et commandes pour les lancer.
6. README avec installation, configuration, lancement, build, tests, e-mails, notifications et préparation au déploiement.
7. Documentation concise du modèle de données, des droits, du tirage et du cycle de mise à jour PWA.
8. Tableau de couverture de chaque exigence : implémentée, testée ou restante, avec limites connues.
9. Liste exacte des actions à effectuer dans la console Firebase et chez le prestataire e-mail ; ne prétends pas les avoir faites sans accès.

Avant de coder, présente brièvement tes choix d’architecture, le modèle de confidentialité et l’ordre des lots, puis commence l’implémentation sans attendre une approbation de routine. Si tu n’as pas d’outils d’écriture de fichiers, fournis l’arborescence et les fichiers complets par lots numérotés, avec un manifeste de ce qui reste à livrer. Ne remplace pas le développement demandé par un résumé.

## 20. Références fonctionnelles

Références publiques consultées pour le cadrage, à revérifier si nécessaire ; ce document ne constitue pas un audit du code privé de Tirokdo :

- https://www.tirokdo.com/
- https://www.tirokdo.com/lancer-tirage-au-sort
- https://faq.tirokdo.com/fr/article/comment-organiser-un-secret-santa-avec-tirokdo-c7pbjd/
- https://faq.tirokdo.com/fr/article/comment-definir-des-regles-dexclusion-entre-participants-z506vs/
- https://faq.tirokdo.com/fr/article/quelles-differences-entre-les-3-modes-de-tirages-1qiam9j/
- https://faq.tirokdo.com/fr/article/comment-ajouter-un-participant-apres-validation-du-tirage-nfxai/

Les améliorations demandées ici — partage privé sans e-mail obligatoire, mise à jour PWA explicite, protection des secrets et expérience sans publicité — sont des exigences du nouveau produit. Elles ne sont pas présentées comme des fonctionnalités déjà vérifiées chez Tirokdo.
