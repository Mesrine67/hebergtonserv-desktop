# HébergTonServ Desktop — v0.1.5

## Changements
- Correction de la fenêtre Tauri, du tray et de l'autostart Windows (restauration, seconde instance et lancement réduit).
- Renforcement de la validation des clés d'hôtes SSH Windows.
- Sécurisation Wisp/Pterodactyl : contrôle DNS IPv4/IPv6, limite de lecture HTTP et messages 401/403.
- Gestionnaire GitHub Actions en CLI/TUI : diagnostics, fonctionnement hors ligne et synchronisation Projects #3 sans doublons.
- Compilation d'un gestionnaire Windows autonome `hebergtonserv-runner-manager.exe`.
- Stabilisation de la CI Windows et documentation des licences.

## Distribution
La version Windows comprend un installateur NSIS, un MSI, deux signatures Tauri updater, `latest.json` et le gestionnaire de runner autonome. Les mises à jour applicatives sont proposées sur confirmation et requièrent la signature Tauri.

## Conditions de publication
Tests frontend et Rust, build Tauri Windows et signatures, manifeste `latest.json` et six assets vérifiés avant publication du brouillon.
