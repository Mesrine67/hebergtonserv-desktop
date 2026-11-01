# HébergTonServ Desktop v0.4.2

## Fenêtre et navigation unifiées

- Recompose le shell de l'application selon la référence FXMP / tauri_games_rockstar.
- Intègre la sidebar dans le flux du conteneur desktop, sans positionnement fixe au viewport ni décalage artificiel de 2,75 rem.
- Supprime la séparation visuelle entre le rail de navigation, la titlebar et la sidebar.
- Place la page principale dans un cadre intérieur arrondi, avec des marges cohérentes en thèmes clair et sombre.
- Aligne la zone de navigation repliée sur la largeur réelle de la sidebar.
- Conserve les contrôles Windows, Windows Snap, la réduction et la maximisation.
- Aucun changement de format de données, de clés API ou de configuration SSH.

## Vérifications

- Frontend : TypeScript, ESLint, Vitest et Vite validés.
- GitHub Actions : jobs Frontend et Rust/Windows validés sur PR #58.
- Changement source : PR #58, commit fusionné 0f5cd8763e32385ddbeb139a5c3755a3990af898.

## Installation

Pour la mise à jour Windows, privilégier l'installateur NSIS signé ou la mise à jour intégrée.
La variante MSI est également disponible dans les assets de release.
