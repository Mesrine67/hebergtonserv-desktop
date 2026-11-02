# HébergTonServ Desktop v0.4.15

## Changements depuis v0.4.14

- **Git local en lecture seule (PR #82)** : détection de Git et de GitHub CLI, sélection explicite d'un dossier, consultation de la branche, des fichiers suivis modifiés et des derniers commits. Aucun fetch, pull, push ni modification de dépôt depuis cette vue.
- **Console multi-panel (PR #83)** : conserve le compte panel sélectionné lors de la navigation et de l'ouverture de la console WebSocket. Refuse une bascule silencieuse vers un autre compte en cas de panel manquant.
- **Préparation du scanner Windows (PR #84, sous réserve de fusion)** : initialisation de Node.js avant pnpm pour éviter le runtime Node temporaire incomplet du scanner GitHub. Cette évolution ne désactive pas les contrôles de sécurité.

## Installation Windows x64

La publication reste conditionnée à la réussite du pipeline de release. Les fichiers attendus sont :

- `HebergTonServ.Desktop_0.4.15_x64-setup.exe` et sa signature `.sig` (NSIS)
- `HebergTonServ.Desktop_0.4.15_x64_en-US.msi` et sa signature `.sig` (MSI)
- `HebergTonServ-Desktop-v0.4.15-windows-x64-standalone-experimental.exe`
- `hebergtonserv-runner-manager.exe`
- `latest.json` avec les signatures Tauri et les URL des artefacts de mise à jour
- `SHA256SUMS.txt` pour la vérification des téléchargements

Le workflow de publication valide la cohérence des versions, les signatures et les huit assets avant de rendre la release publique. En cas d'échec, elle doit rester en brouillon.

## Limites actuelles

- L'issue #71 conserve les travaux d'authentification GitHub, PR/issues et opérations Git mutantes avec confirmations.
- L'issue #69 conserve les travaux de couverture API avancée WISP/Pterodactyl : fichiers, sauvegardes, bases de données, allocations, tâches, permissions et variantes de versions.
- Aucun jeton administrateur de panel n'est intégré dans l'application distribuée.
