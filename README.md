# VRT — Atelier mécanique

Application responsive de suivi partagé : voiture interactive, 19 systèmes, cinq étapes par système, échéances, responsables, problèmes, solutions retenues et notes.

## Utilisation

Ouvrir l’application, choisir **Équipe**, entrer le code d’accès, puis cliquer sur un système. Cliquer sur une étape fait défiler **À démarrer → En cours → Terminé**. Enregistrer la fiche pour partager les modifications. Le suivi se rafraîchit toutes les 15 secondes. Une connexion Internet est nécessaire pour charger et enregistrer les données partagées.

Les exportations JSON servent de sauvegardes. Une importation remplace les fiches concernées pour toute l’équipe après confirmation. Les conflits entre modifications simultanées sont bloqués pour préserver le travail de chacun.

## Architecture

Le navigateur affiche les fichiers statiques ; l’API Worker conserve les données dans D1. Le code d’accès est configuré dans le secret serveur `TEAM_CODE`, jamais dans les fichiers publics. La palette rouge, noir, blanc et gris reprend le site https://www.vrt-fs.ch/.

## Développement

Node.js 24+. Installer les dépendances avec pnpm. `pnpm dev` lance un aperçu avec une base SQLite séparée des données de production. Son code par défaut est `preview-only` (ou la variable `TEAM_CODE`). `pnpm test` vérifie l’authentification, la synchronisation, les conflits et l’import atomique. `pnpm build` prépare le Worker et ses migrations.

Sur GitHub Pages, publier uniquement `index.html`, `style.css`, `app.js`, `config.js`, `icon.svg`, `manifest.webmanifest` et `.nojekyll`. Configurer l’API de production dans `config.js`. La base de données et les secrets ne sont jamais publiés sur GitHub Pages.
