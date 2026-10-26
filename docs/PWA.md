# Application installable

Le manifeste déclare Sous pli, les icônes 192 et 512, et les versions maskables. `public/sw.js` ne s'enregistre qu'en production, ou si `NEXT_PUBLIC_ENABLE_SW=true`.

## Cache

Les navigations passent d'abord par le réseau. En échec, l'écran `/hors-ligne` est servi. Les pages privées, `/api`, `/sw.js`, `/version.json`, `/invitation` et `/rejoindre` ne sont pas mises en cache. Les icônes le sont.

## Mise à jour

Toutes les 60 secondes, tant que l'onglet est visible, l'application compare `/api/version` à la version compilée. Une différence déclenche `registration.update()`. La modale « Une nouvelle version est disponible » n'apparaît pas si le contrôle a échoué, si un formulaire sensible est verrouillé, ou si une autre modale est déjà ouverte.

« Plus tard » reporte de 6 heures et pour la session. « Mettre à jour » envoie `SKIP_WAITING`, mémorise la version, puis recharge une seule fois quand le nouveau worker prend la main. La première installation active le worker sans boucle de rechargement.

`npm run dev` ne montre pas cette modale, parce que le worker y est désactivé.
