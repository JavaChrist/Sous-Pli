# Sous pli — Mentions légales, confidentialité et conditions

Version de travail du 22 octobre 2026 — document unique pour intégration.

## Notice à Christian et au développeur — ne pas publier cette notice

Les textes ci-dessous sont préparés pour le lancement, à partir du retour technique fourni par Christian et des informations d’éditeur publiées sur RideCloud. Ils ne constituent pas une validation du déploiement ou une certification juridique. Ne pas publier les champs entre crochets.

### Points à compléter avant publication

1. Confirmer l’identité, l’adresse, le SIRET, le téléphone et le régime fiscal repris de RideCloud ; ajouter l’immatriculation RNE/RCS applicable si nécessaire.
2. Fournir la raison sociale, l’adresse et le téléphone de l’hébergeur effectivement retenu. Firebase App Hosting n’est que préparé. Le domaine annoncé est https://souspli.fr ; aucun hébergement de production n’est établi par le retour technique.
3. Confirmer les entités contractantes de Google/Firebase, Resend et, si activé, Stripe ; relever les régions réellement créées et les garanties de transfert applicables. Ne pas annoncer « données exclusivement en Europe » : Firebase Authentication indique un traitement aux États-Unis.
4. Désactiver l’envoi d’images de souhaits jusqu’à raccordement complet et nettoyage des fichiers orphelins. Un fichier envoyé mais non affiché demeure une donnée traitée : il faut traiter les éventuels fichiers d’essai déjà enregistrés.
5. Compléter la suppression : profil et Auth seuls ne suffisent pas. Inventorier participants, index, souhaits, messages et copies, images, invitations, notifications et file d’e-mails. La suppression d’un document Firestore ne supprime pas ses sous-collections. Distinguer effacement, anonymisation et éventuelles archives légalement nécessaires.
6. Choisir, documenter et rendre effectives les durées de conservation. Une procédure manuelle contrôlée peut convenir ; ne pas promettre une automatisation inexistante.
7. Vérifier les fonctionnalités et tarifs réellement livrés. Le webhook Stripe existe dans le code ; cela ne prouve ni contrat actif, ni paiement de production opérationnel.
8. Confirmer le médiateur effectivement conventionné et la couverture de Sous pli. Ne pas recopier automatiquement celui indiqué par RideCloud. Faire compléter le dispositif des garanties légales numériques et le parcours contractuel avant les ventes aux consommateurs ou non-professionnels concernés.
9. Pour l’offre entreprise, préciser les rôles RGPD et préparer une annexe de sous-traitance si JavaChrist traite les données des salariés pour le compte de l’organisation. Ne pas considérer une simple CGU comme cette annexe.

### Politique de conservation proposée — à approuver et mettre en œuvre

Ces durées sont des recommandations de conception, pas des fonctionnalités existantes ni des durées légales universelles :

| Données | Proposition |
|---|---|
| Invitations non acceptées | Jeton valable 30 jours ; purge des données d’invitation 60 jours après expiration |
| Brouillons abandonnés | Suppression après 6 mois sans activité, avec avertissement préalable |
| Événements, attributions, souhaits et messages | Suppression ou anonymisation effective 12 mois après la date de l’événement ; rappel préalable et duplication possible sans recopier les messages |
| Compte inactif | Avertissement après 24 mois d’inactivité, puis suppression après 30 jours sans reprise |
| Journaux de sécurité | 6 mois, sous réserve d’un incident ou d’une obligation justifiant une archive séparée |
| File d’e-mails et suivi de remise | Purge du contenu après envoi ; métadonnées limitées à 90 jours |
| Sauvegardes | Cycle maximal à choisir et vérifier, proposé à 30 jours ; données supprimées non réintroduites lors d’une restauration |
| Factures et pièces comptables | 10 ans lorsque l’obligation comptable correspondante s’applique |
| Preuves contractuelles et litiges | Durée de prescription applicable, à préciser selon la nature et le montant des contrats ; accès restreint |

Le nettoyage des invitations, événements et messages doit aussi retirer les copies et index associés. Ne pas prolonger les messages privés simplement parce que le compte reste actif.

---

# PAGE 1 — Mentions légales

Dernière mise à jour : [date de publication effective].

## Éditeur

Sous pli, accessible à l’adresse https://souspli.fr, est édité par Christian Grohens, entrepreneur individuel exerçant sous le nom commercial JavaChrist.

- Adresse : 5 rue Maurice Fonvieille, 31120 Portet-sur-Garonne, France.
- SIREN : 338 593 312.
- SIRET : 338 593 312 00030.
- Immatriculation : [mention du registre applicable à confirmer].
- Contact : support@souspli.fr.
- Téléphone : 09 52 62 31 71.
- Informations fiscales : [régime et numéro de TVA, le cas échéant, à confirmer].

Directeur de la publication : Christian Grohens.

## Hébergement

Hébergeur de l’application : [raison sociale complète, adresse et téléphone de l’hébergeur réellement choisi].

Le service s’appuie également sur Google Firebase pour ses fonctions techniques et sur Resend pour l’envoi de ses e-mails. Les modalités de traitement des données sont détaillées dans la politique de confidentialité. Un prestataire de nom de domaine ne remplace pas l’identification de l’hébergeur.

## Propriété intellectuelle

Les éléments de Sous pli, notamment ses textes, sa présentation, son identité visuelle et son code, sont protégés dans la mesure prévue par la législation applicable. Les droits des auteurs, composants libres et ressources de tiers restent réservés à leurs titulaires.

L’utilisation du service ne transfère aucun droit de propriété intellectuelle. Toute reproduction ou exploitation non autorisée est interdite, sous réserve des exceptions légales et des licences applicables. La mention du nom Sous pli ne vaut pas affirmation d’un dépôt de marque.

Les utilisateurs conservent leurs droits sur leurs propres contenus.

## Contact et signalement

Pour toute question ou pour signaler un contenu ou un incident, écrire à support@souspli.fr en indiquant l’événement ou l’élément concerné. Ne transmettre ni mot de passe, ni code d’accès personnel, ni donnée bancaire.

## Informations complémentaires

Les règles d’utilisation et de vente figurent dans les conditions générales. Les informations sur les données, les destinataires et les droits des personnes figurent dans la politique de confidentialité. Les liens présents sur le site peuvent conduire vers des services tiers disposant de leurs propres conditions.

---

# PAGE 2 — Politique de confidentialité

Dernière mise à jour : [date de publication effective].

## 1. Qui traite vos données ?

Christian Grohens, entrepreneur individuel exerçant sous le nom JavaChrist, édite Sous pli. Ses coordonnées complètes figurent dans les mentions légales. Pour les questions de protection des données : support@souspli.fr.

JavaChrist est responsable des traitements qu’il détermine pour la gestion des comptes, la sécurité, le support et la relation commerciale. Pour certains événements organisés par une entreprise ou une association, l’organisation peut être responsable des traitements liés à ses participants et JavaChrist intervenir pour son compte ; cette répartition et les coordonnées utiles sont alors précisées dans les informations de l’événement et l’accord applicable.

## 2. Données traitées et origine

Selon votre utilisation, Sous pli traite :

- les données de compte : identifiant technique, prénom ou pseudonyme, adresse e-mail, informations de connexion et données nécessaires à l’authentification ;
- les informations d’événement : nom, date, fuseau, budget, règles, organisation et participants ;
- les invitations et leurs statuts, groupes et exclusions, attributions et consultations du résultat ;
- les souhaits et liens que vous choisissez de communiquer ;
- les messages, statuts de lecture, signalements et blocages ;
- les notifications internes et préférences ;
- les informations de commande, facturation, montant, référence et état du paiement si vous achetez une offre ;
- les données techniques nécessaires à la connexion, à la sécurité, au fonctionnement de la PWA et à la remise des e-mails.

Les informations peuvent provenir de vous, d’un organisateur qui vous invite ou du fournisseur d’identité choisi à la connexion. La première invitation indique l’organisateur et donne accès à cette politique. Vous pouvez demander à ne pas participer et l’effacement des informations vous concernant, sous réserve des exceptions légales.

Les champs obligatoires sont indiqués dans les formulaires. Sans les informations nécessaires, certaines fonctions ne peuvent pas être fournies. Évitez de saisir des informations sensibles ou des données sur des tiers qui ne sont pas nécessaires à l’échange.

[Si les images restent activées : ajouter les images de souhaits, leur visibilité et leurs règles de conservation après réparation du parcours. Si désactivées : ne pas annoncer la fonction.]

## 3. Pourquoi et sur quelle base ?

| Usage | Base juridique selon la situation |
|---|---|
| Gestion du compte et fourniture du service demandé | Exécution du contrat avec l’utilisateur |
| Invitation initiale d’une personne par un organisateur | Intérêt légitime à permettre l’échange sollicité par l’organisateur, sous réserve des droits et attentes de la personne ; autre base à préciser pour les événements gérés pour une organisation |
| Tirage, exclusions, souhaits, messages et alertes de service | Exécution du contrat pour les utilisateurs contractants ; instructions et base déterminée par l’organisation lorsqu’elle est responsable du traitement |
| Sécurité, prévention des abus et gestion des signalements | Intérêt légitime à protéger le service et ses utilisateurs |
| Commandes et paiements | Exécution du contrat |
| Comptabilité et obligations imposées par la loi | Obligation légale |
| Support et réclamations | Exécution du contrat ou intérêt légitime à répondre selon la demande |

Aucune newsletter ou prospection n’est activée sur la base d’une simple invitation. Toute future prospection fera l’objet de l’information et, lorsque nécessaire, du consentement requis.

## 4. Qui peut voir vos informations ?

Les informations sont accessibles selon les droits de l’événement. L’organisateur dispose des informations nécessaires à sa gestion et au suivi de participation ; cela ne lui donne pas, à lui seul, accès aux attributions secrètes ni à toutes les conversations privées.

Le destinataire autorisé peut consulter les souhaits nécessaires à la préparation de son cadeau. En mode classique et double mystère, la messagerie masque l’identité selon les règles du mode choisi. En mode public, ou après révélation collective, les identités et attributions sont dévoilées aux membres selon les informations annoncées avant le tirage.

Un message ou un souhait peut néanmoins permettre de deviner une identité. L’anonymat d’affichage n’est pas un chiffrement de bout en bout. Des personnes techniquement habilitées peuvent accéder à certaines données lorsque cela est nécessaire au support, à la sécurité, à la modération ou au respect de la loi, dans un cadre limité.

Les messages ne sont pas recopiés dans les e-mails d’alerte. Les données ne sont pas vendues à des annonceurs.

## 5. Prestataires et transferts internationaux

Les prestataires interviennent dans la mesure nécessaire à leurs missions :

- Google/Firebase : authentification, base de données, fichiers et fonctions serveur utilisés par Sous pli ;
- Resend : acheminement des e-mails et suivi technique de leur remise ;
- [hébergeur réel] : hébergement et distribution de l’application ;
- [entité Stripe contractante, uniquement si activée] : paiements et prévention de la fraude.

Les régions réellement sélectionnées sont : [Firestore, Storage, Functions et hébergement à compléter après création]. Une région européenne pour la base ne signifie pas que tous les traitements sont européens. Firebase Authentication indique traiter les données aux États-Unis ; d’autres opérations de support ou sous-traitance peuvent également impliquer des transferts internationaux.

Ces transferts reposent sur les mécanismes effectivement applicables aux prestataires : [décision d’adéquation et certification applicable, ou clauses contractuelles types et mesures complémentaires à vérifier]. Vous pouvez demander des informations et une copie des garanties communicables à support@souspli.fr.

## 6. Conservation et suppression

[Insérer ici le tableau des durées approuvées et effectivement appliquées, en retirant la formulation « proposition » de la notice interne. Préciser séparément les données de service, journaux, sauvegardes et archives légales.]

L’expiration d’un lien d’invitation ne constitue pas à elle seule un effacement des données. De même, l’archivage d’un événement ne le supprime pas.

Pour demander l’effacement de votre compte, de votre participation ou de vos contenus, contactez support@souspli.fr. La demande porte aussi sur les données associées, sous réserve des éléments dont la conservation reste légalement nécessaire ou justifiée. Ces éléments sont isolés et leur accès limité. Les échanges contenant plusieurs personnes font l’objet d’un examen pour protéger les droits de chacune.

## 7. Stockage local, cookies et notifications

Sous pli utilise des mécanismes techniques nécessaires à l’authentification, aux préférences, au fonctionnement et à la mise à jour de la PWA. [Compléter l’inventaire effectif : mécanisme, finalité et durée.]

Aucun outil de mesure d’audience ni traceur publicitaire n’est activé dans la version décrite. Les notifications sont consultables à l’intérieur de l’application. Les notifications push système ne sont pas activées ; les e-mails de service restent distincts des notifications internes.

Toute activation ultérieure d’un outil non indispensable sera précédée des informations et choix requis. Le téléchargement technique d’une ressource ne doit pas être présenté automatiquement comme un suivi publicitaire.

## 8. Sécurité

Le service met en œuvre des restrictions d’accès et des contrôles destinés à protéger les données. Aucune transmission ou conservation informatique ne peut être garantie sans risque. Gardez vos liens personnels confidentiels, utilisez un appareil de confiance et signalez tout accès suspect. Ne communiquez jamais votre mot de passe au support.

## 9. Vos droits

Selon les conditions prévues par le RGPD, vous disposez de droits d’accès, de rectification, d’effacement, de limitation, de portabilité et d’opposition aux traitements fondés sur l’intérêt légitime. Si un traitement repose sur un consentement, vous pouvez le retirer sans affecter la licéité des opérations antérieures. Vous pouvez également donner des directives relatives au sort de vos données après votre décès dans les conditions légales françaises.

Adressez votre demande à support@souspli.fr en précisant l’adresse liée à votre compte et l’objet de votre demande. Une vérification proportionnée de votre identité peut être demandée en cas de doute raisonnable ; aucune pièce d’identité n’est exigée systématiquement.

La réponse intervient en principe dans un mois. Ce délai peut être prolongé de deux mois si la complexité ou le nombre des demandes le justifie ; vous en êtes informé dans le premier mois. Vous pouvez introduire une réclamation auprès de la CNIL : https://www.cnil.fr/fr/plaintes, sans être tenu de nous contacter auparavant.

## 10. Évolutions

Cette politique est mise à jour lors de modifications importantes du service ou des traitements. Les changements significatifs sont portés à votre connaissance par un moyen adapté. Une modification de texte ne remplace pas le recueil d’un consentement lorsqu’il est nécessaire.

---

# PAGE 3 — Conditions générales d’utilisation et de vente

Dernière mise à jour : [date de publication effective].

## 1. Objet et éditeur

Les présentes conditions encadrent Sous pli, service d’organisation d’échanges de cadeaux édité par Christian Grohens EI, sous le nom commercial JavaChrist, identifié dans les mentions légales. Contact : support@souspli.fr.

Sous pli s’adresse aux familles, amis, associations et entreprises. Il permet de préparer un événement, inviter des participants, définir des exclusions, réaliser un tirage, partager des souhaits et échanger des messages selon les fonctions effectivement proposées.

Le service n’est ni le vendeur ni le transporteur des cadeaux. Il ne collecte pas le budget des cadeaux et ne garantit pas qu’un participant achètera ou remettra un cadeau.

## 2. Acceptation et accès

Les conditions sont accessibles avant la création du compte ou l’achat. L’acceptation nécessaire à la conclusion d’un contrat est recueillie par une action explicite et conservée avec la version applicable. La prise de connaissance de la politique de confidentialité ne vaut pas consentement général à tous les traitements.

Une connexion internet et un navigateur compatible sont nécessaires. L’installation PWA est facultative. Certaines opérations, notamment tirage, paiement et première consultation d’un résultat, nécessitent une connexion.

L’organisateur doit être majeur et disposer du pouvoir nécessaire s’il agit pour une structure. La participation d’un mineur doit être encadrée par son représentant légal et compatible avec les modalités proposées. Un adulte gérant la participation d’un enfant peut connaître son attribution.

## 3. Comptes et invitations

Les utilisateurs fournissent des informations exactes et protègent leur compte et leurs liens privés. Ils signalent rapidement toute utilisation suspecte. Une action depuis un compte ne peut être irréfragablement imputée à son titulaire en cas de compromission.

L’organisateur invite uniquement des personnes ayant un lien pertinent avec l’événement. Les invitations ne doivent pas servir à la prospection, au démarchage ou à l’envoi massif non sollicité. Il informe les participants des règles et, s’il agit professionnellement, assume ses obligations relatives aux données qu’il fournit.

Un lien personnel ne doit pas être publié ou partagé avec un tiers. La validité d’une invitation est indiquée au participant ; son expiration n’implique pas l’effacement immédiat de toutes les données de l’événement.

## 4. Tirage et confidentialité

L’organisateur vérifie la liste des participants, le budget, les exclusions et le mode avant le lancement. Un ensemble de contraintes impossible empêche le tirage ; aucune exclusion stricte ne doit être écartée sans action explicite.

Les modes disponibles sont décrits avant le lancement. Le mode classique masque les autres attributions ; le mode public les expose selon les règles annoncées ; le double mystère masque aussi l’identité du destinataire jusqu’à la révélation prévue. La révélation collective est explicite et soumise aux conditions de date configurées.

Le tirage n’est pas renouvelé lors d’une nouvelle consultation. Une modification tardive ne peut pas changer silencieusement une attribution déjà consultée. Les changements ne sont possibles que lorsque la fonction est proposée et que l’intégrité du groupe est conservée ; sinon, l’organisateur doit annuler et recréer l’événement de façon transparente.

Les organisateurs et coorganisateurs ne disposent pas d’un droit général de lecture des conversations ou résultats secrets. La confidentialité applicative ne garantit toutefois pas l’impossibilité de deviner une identité à partir d’un texte ou d’un souhait.

## 5. Contenus et comportement

Chaque utilisateur conserve ses droits sur ses textes et contenus. Il autorise JavaChrist à les héberger, reproduire techniquement et afficher uniquement dans la mesure nécessaire au fonctionnement, à la sécurité et aux opérations légalement requises. Cette autorisation n’inclut pas leur exploitation publicitaire indépendante.

Sont interdits les contenus illicites, menaces, harcèlement, usurpations d’identité, atteintes aux droits de tiers, logiciels malveillants et tentatives de contournement des accès ou plafonds. Les liens vers des produits relèvent de services tiers ; un souhait n’est pas une commande.

Un dispositif permet de signaler un message ou de bloquer une interaction. Le support peut demander les informations nécessaires à l’examen. En cas de mesure de restriction, son motif est communiqué lorsque cela est possible et compatible avec la sécurité et les obligations légales. Une contestation peut être adressée au support. Les urgences graves peuvent justifier une intervention immédiate.

## 6. Offres et prix

Les tarifs de lancement sont les suivants, sous réserve de leur présence effective au moment de la commande :

| Offre | Prix final par événement | Maximum de participants |
|---|---:|---:|
| Famille & amis | Gratuit | 50 |
| Association | 9,90 € | 100 |
| Entreprise | 19,90 € | 100 |
| Entreprise Plus | 39,90 € | 300 |
| Grand groupe | Sur devis | Selon devis |

Les fonctions incluses sont décrites dans la page Tarifs et le récapitulatif de commande, conservés avec celle-ci. Aucun paiement n’est demandé aux participants. Il n’existe ni abonnement ni reconduction automatique dans ces offres.

Les prix sont exprimés en euros, taxes comprises lorsqu’elles sont applicables. [Si confirmé : « TVA non applicable, article 293 B du CGI ».] Aucun montant fiscal ne doit être ajouté de manière inattendue à la dernière étape.

La capacité inclut toute personne prenant part au tirage, organisateur compris s’il participe. Un coorganisateur non participant n’est pas compté. Une duplication crée un nouvel événement et ne transfère pas les droits achetés. Avant lancement, le passage d’Entreprise à Entreprise Plus coûte 20 € supplémentaires, sous réserve de la disponibilité de cette option.

## 7. Commande et paiement

L’organisateur vérifie l’offre, l’événement, la capacité et le prix avant de commander. Le bouton final exprime sans ambiguïté l’obligation de paiement. Une confirmation contenant les caractéristiques essentielles et les conditions applicables est remise sur un support durable, notamment par e-mail.

Les paiements sont traités par [entité contractante du prestataire effectivement activé]. Les données de carte sont saisies auprès du prestataire ; elles ne sont pas stockées dans Sous pli. L’activation dépend d’une confirmation serveur vérifiée, non du seul retour du navigateur.

Une erreur de paiement ne doit pas effacer le brouillon. Le paiement ne lance pas automatiquement le tirage. Les devis font l’objet de conditions particulières communiquées avant acceptation.

## 8. Durée et exécution

L’achat porte sur l’organisation d’un événement identifié, jusqu’à sa date et pendant la période de consultation annoncée avant commande : [durée exacte à fixer et mettre en cohérence avec la conservation]. Le récapitulatif précise toute limite de report de date ou d’accès. L’archivage ne doit pas être présenté comme un stockage permanent.

Aucun renouvellement ou paiement complémentaire n’est déclenché sans accord. Les évolutions tarifaires ne modifient pas rétroactivement les commandes déjà conclues.

## 9. Rétractation et annulation

Lorsqu’il bénéficie du droit de rétractation applicable aux contrats à distance, le client peut se rétracter dans les quatorze jours suivant la conclusion du contrat, sans avoir à justifier sa décision. Il adresse une déclaration dénuée d’ambiguïté à support@souspli.fr ou utilise le formulaire ci-dessous.

**Choix commercial proposé pour le lancement, à confirmer avant vente :** Sous pli rembourse intégralement les demandes de rétractation recevables formulées dans ce délai, y compris lorsque le service a commencé. L’activation immédiate ne vaut donc pas, à elle seule, renonciation au droit de rétractation. Ce choix doit être appliqué effectivement dans le support et le paiement.

Le remboursement intervient dans les quatorze jours suivant l’information de la décision, par le même moyen de paiement sauf accord exprès différent sans frais. L’accès aux options payantes peut être désactivé sans révéler ni redistribuer silencieusement les attributions ; le support précise les conséquences pour l’événement.

En dehors de ce droit et des garanties légales, une annulation volontaire après paiement n’entraîne pas automatiquement un remboursement. Les demandes peuvent être examinées par le support. Une défaillance du service ou une non-conformité conserve les recours prévus par la loi.

Les clients professionnels ne disposent pas automatiquement du droit de rétractation des consommateurs ; les éventuelles dispositions légales étendant une protection à certains contrats restent applicables.

### Formulaire de rétractation

À l’attention de Christian Grohens EI — JavaChrist, 5 rue Maurice Fonvieille, 31120 Portet-sur-Garonne, France — support@souspli.fr.

Je vous notifie ma rétractation du contrat relatif à l’événement et à l’offre suivants :

- Événement et référence de commande :
- Offre :
- Date de commande :
- Nom du client :
- Adresse du client :
- Adresse e-mail associée à la commande :
- Date :
- Signature, uniquement en cas d’envoi papier :

## 10. Garanties légales et responsabilité

Les garanties légales applicables aux contenus et services numériques, notamment celles des articles L. 224-25-12 et suivants du Code de la consommation, s’appliquent lorsque leurs conditions sont réunies. Le consommateur peut demander la mise en conformité et, dans les situations prévues par la loi, une réduction du prix ou la résolution du contrat. Les mises à jour nécessaires au maintien de la conformité sont fournies conformément aux obligations applicables.

[Insérer avant vente l’encadré réglementaire d’information correspondant à la qualification et au mode de fourniture effectivement retenus ; préciser la durée contractuelle. Cette synthèse ne remplace pas cet encadré.]

JavaChrist est responsable de ses manquements dans les conditions du droit applicable. Aucune clause ne prive le consommateur de ses garanties ou droits impératifs. Les interruptions techniques peuvent affecter le service ; l’éditeur s’efforce d’y remédier et d’informer les utilisateurs des incidents significatifs.

L’éditeur n’est pas responsable du choix, du prix, de la livraison ou de la qualité des cadeaux achetés auprès de tiers. Cette précision n’exclut pas sa responsabilité propre pour le fonctionnement de Sous pli.

## 11. Données, fermeture et évolutions

Les traitements sont décrits dans la politique de confidentialité. Une demande de suppression peut être adressée à support@souspli.fr ; les effets sur un événement collectif sont expliqués et les obligations légales respectées.

Les changements importants du service sont annoncés par un moyen approprié. Une nouvelle version des conditions ne modifie pas rétroactivement une commande, sauf disposition légalement applicable ou accord requis. Les mises à jour PWA nécessaires à la sécurité et au fonctionnement sont présentées par une modale ; une interruption de saisie ou de paiement n’est pas déclenchée arbitrairement.

## 12. Réclamations, médiation et droit applicable

Pour toute réclamation : support@souspli.fr. Indiquer l’événement et la référence de commande sans transmettre de données bancaires.

Après une réclamation écrite préalable non résolue, le consommateur peut recourir gratuitement au médiateur compétent effectivement désigné par JavaChrist : [nom, adresse, site et modalités de saisine à compléter après confirmation de la convention couvrant Sous pli]. La médiation n’empêche pas les autres voies de recours prévues par la loi.

Les conditions sont régies par le droit français, sous réserve des dispositions impératives protectrices applicables au consommateur. Les juridictions compétentes sont déterminées selon les règles légales ; aucune compétence exclusive au siège de JavaChrist n’est imposée au consommateur.

---

# Références de préparation — ne pas intégrer au corps des pages

- Identité d’éditeur : https://ridecloud.app/mentions-legales — informations publiées, à confirmer par Christian.
- Information RGPD : https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence
- Conservation : https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees
- Firebase, lieux de traitement : https://firebase.google.com/support/privacy
- Conditions de traitement Firebase : https://firebase.google.com/terms/data-processing-terms
- Mentions légales : https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter
- Rétractation : https://www.economie.gouv.fr/particuliers/mes-droits-conso/bien-consommer/vente-distance-tout-savoir-sur-votre-droit-de-retractation
- Médiateur : https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/choisir-un-mediateur-de-la-consommation

Ne pas recopier l’ancien lien européen de règlement en ligne des litiges présent dans les conditions RideCloud : cette plateforme a fermé. Ne pas recopier non plus les engagements RideCloud d’effacement automatique, les prestataires Supabase/Mistral/Mollie, les durées ou limitations de responsabilité sans vérification pour Sous pli.
