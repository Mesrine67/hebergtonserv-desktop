# HébergTonServ Desktop v0.4.33

## Interface et fenêtres

- Stabilisation de l’ouverture et de l’interaction des panneaux flottants, notamment Nouveautés et changelog, Paramètres, Sécurité, raccourcis et thèmes.
- Fenêtre splash compacte et centrée, avec démarrage Tauri mieux intégré.
- Panneaux sans voile de flou superposé à l’application ; interactions et navigation du contenu conservées.

## Diagnostics et outils

- Notifications positionnées en bas à droite et harmonisées avec le thème de l’application.
- Journal de l’application enrichi pour les diagnostics JSON, WebSocket et `console_websocket` / `ws_authenticated`.
- Gestionnaire de tâches étendu pour améliorer le suivi des processus.
- Documentation Tauri actualisée dans `TAURI.md`.

## Dépendances

- Mise à jour de `@tanstack/react-query`, `@vitejs/plugin-react`, `log`, Tailwind CSS et `lucide-react` par les PR Dependabot #121, #123, #119, #120 et #122.

## Vérification et livraison

- Version synchronisée dans `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` et `src-tauri/tauri.conf.json`.
- Le tag `v0.4.33` sera posé sur le commit fusionné de `main` après validation de cette préparation.
- Le workflow Windows devra produire les installateurs NSIS/MSI, signatures updater, manifeste `latest.json`, gestionnaire runner et artefacts attendus avant publication.
