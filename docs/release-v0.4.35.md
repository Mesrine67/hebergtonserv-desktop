# HébergTonServ Desktop v0.4.35

## Panneaux flottants et navigation

- Centralisation des panneaux dans un composant partagé non modal, sans voile ni blocage de la page située dessous.
- La console et les bases de données s’ouvrent au-dessus de la liste des serveurs, qui reste montée, visible et navigable.
- Conservation de la position de défilement de la liste lors de l’ouverture et de la fermeture de la console.
- Remontée des onglets d’explorateurs dans une rangée dédiée sous les contrôles de fenêtre, sans déformer la barre de titre.
- Menus, sélecteurs, info-bulles et popovers apparaissent au-dessus des panneaux.

## Vérification et livraison

- Version synchronisée dans `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` et `src-tauri/tauri.conf.json`.
- CI et validation de la fenêtre native requises avant la publication du tag `v0.4.35`.
