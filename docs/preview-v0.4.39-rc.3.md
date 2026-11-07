# HébergTonServ Desktop Preview v0.4.39-rc.3

**Préversion Windows x64** pour tester les avancées ChatGPT / Codex / MCP sur la base mise à jour de v0.4.39.

## Ajouts depuis la Preview rc.2

- Connexion directe à un compte ChatGPT pour Codex App Server depuis le panneau Assistant IA, via le flux officiel `account/login/start` dans le navigateur système.
- Profil Codex indépendant de l'utilisateur global, sous `LocalAppData/HebergTonServDesktop/codex-isolated`; les jetons restent uniquement côté Codex.
- Affichage des réponses de Codex au fur et à mesure, bouton **Arrêter**, limitation à un tour actif et annulation backend.
- Connexion facultative du fork <https://github.com/Mesrine67/DesktopCommanderMCP> en lecture seule, avec autorisation d'un dossier existant, révocation et suppression de l'autorisation au redémarrage.
- Le serveur MCP refuse le terminal, la modification de fichiers, les changements de configuration, les URL distantes et les accès hors du dossier sélectionné.
- Monaco déjà présent dans la base v0.4.39 reste disponible.

## Installation et prérequis

- Installer NSIS (EXE) ou MSI, sur Windows x64. La Preview possède une identité indépendante `com.hebergtonserv.desktop.preview`.
- Le MSI utilise la version technique `0.4.39-3`, pour respecter la limitation WiX sur les suffixes de préversion ; l'application affiche `0.4.39-rc.3`.
- Sur PC-MIKE, Codex et le fork MCP sont présents dans les chemins de développement `E:\DevCaches\hebergtonserv-desktop\codex-cli` et `E:\Projects\hebergtonserv-desktopcommander`. Sur un autre PC, installer une version officielle Codex et le fork compilé, puis configurer côté système `HTS_CODEX_EXECUTABLE`, `HTS_NODE_EXECUTABLE` et `HTS_MCP_SERVER_PATH`.
- Les installateurs ne sont pas signés Authenticode ; vérifier la provenance et les sommes SHA-256.
- Pas d'artefacts Tauri updater signés. Cette Preview ne sera pas servie par l'updater stable.

## Vérifications de code

- TypeScript, ESLint, build Vite, 68 tests frontend : OK.
- Clippy strict, 68 tests Rust : OK.
- DesktopCommanderMCP : build TypeScript et tests unitaires + intégration MCP réelle par stdio : OK.
- Vérification App Server de zéro MCP non autorisé avec profil isolé et de la déclaration unique `hts_readonly` : OK.

## Limitations connues

- Cette version est **expérimentale**, les flux de connexion et de génération doivent être testés dans l'application installée. L'inférence de bout en bout a été bloquée lors des essais précédents par le quota du forfait ChatGPT, sans contournement via API facturable.
- La connexion directe Sign in with ChatGPT à la Responses API nécessite toujours l'enregistrement du client OAuth de l'application ; elle n'est pas incluse.
- Le MCP actuel est local et strictement limité à la lecture. Aucun accès SSH/VPS, écriture ou exécution de commande n'est activé.
- Le moteur Codex relance encore un processus App Server à chaque message ; un gestionnaire persistant et la sauvegarde de conversations dans l'UI sont à venir.
- Cette Preview ne remplace pas une release stable et ne modifie pas les paramètres de la version stable.

Sources : https://github.com/Mesrine67/hebergtonserv-desktop/pull/138 et https://github.com/Mesrine67/DesktopCommanderMCP/pull/1
