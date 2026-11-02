# HébergTonServ Desktop v0.4.14

Version Windows x64 cumulative depuis v0.4.13. PR incluses : #77, #78, #79, #80 et #81.

## Nouveautés et correctifs
- **Console serveur intégrée** : connexion WebSocket Wings sécurisée via des identifiants éphémères demandés à l'API Client ; affichage du flux et envoi de commandes depuis l'application. La prise en charge dépend des permissions du compte et du panel.
- **Reconnexion après mise à jour** : une nouvelle validation du compte Client API est demandée lors du premier lancement d'une version différente.
- **Diagnostics API** : journal dépliable et export enrichi, avec protection des informations sensibles.
- **Interface** : améliorations de la sidebar et de ses styles.
- **Runner de sécurité** : configuration et documentation du runner Windows.

## Installation Windows
- `HebergTonServ.Desktop_0.4.14_x64-setup.exe` : installateur NSIS.
- `HebergTonServ.Desktop_0.4.14_x64_en-US.msi` : installateur MSI.
- `HebergTonServ-Desktop-v0.4.14-windows-x64-standalone-experimental.exe` : version autonome expérimentale.
- `hebergtonserv-runner-manager.exe` : outil pour le runner.
- `latest.json` et `*.sig` : métadonnées et signatures de mise à jour Tauri.
- `SHA256SUMS.txt` : empreintes SHA-256.

La publication est conditionnée à la réussite du pipeline Windows, à la présence des huit assets attendus et à la validation des signatures et de `latest.json`. La release reste en brouillon tant que ces vérifications ne sont pas terminées.

## Limites connues
Les API WISP/Pterodactyl (fichiers, bases, sauvegardes, allocations, tâches) et la gestion Git/GH complète restent des travaux de la roadmap (#69, #71). La console WebSocket nécessite un panel compatible et les permissions Client API appropriées. Ne jamais insérer une clé administrateur dans l'application cliente.
