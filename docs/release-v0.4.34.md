# HébergTonServ Desktop v0.4.34

## Gestionnaire de tâches

- Ajout de la mesure CPU par processus Windows, calculée à partir des compteurs natifs `GetProcessTimes`.
- Tri par CPU, total des processus lisibles, détail CPU par processus et ajout de la colonne CPU à l’export CSV.
- La première mesure et les processus inaccessibles restent indiqués comme inconnus; aucune commande d’arrêt n’est ajoutée.
- Le rafraîchissement reste limité à l’ouverture du gestionnaire et à l’intervalle choisi.

## Vérification et livraison

- Version synchronisée dans `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` et `src-tauri/tauri.conf.json`.
- Le tag `v0.4.34` est publié après validation de cette préparation sur `main`.
