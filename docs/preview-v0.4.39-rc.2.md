# HébergTonServ Desktop Preview v0.4.39-rc.2

**Préversion Windows x64 pour tester le cumul des changements des PR #137 et #138.**
- PR #137 : version 0.4.39 et correctifs de stabilité/sécurité (fusionnée dans main).
- PR #138 : premier lot Assistant IA, ChatGPT Web (navigateur externe), pont Tauri Rust vers Codex App Server, catalogue dynamique des modèles et affichage du quota (encore en brouillon).

## Installation
- NSIS EXE ou MSI pour Windows x64.
- Identité d'application séparée `com.hebergtonserv.desktop.preview` pour préserver l'installation stable.
- Version applicative `0.4.39-rc.2` ; le package MSI affiche `0.4.39-2` car WiX exige un suffixe de préversion numérique.
- Ni mise à jour automatique stable ni signature d'updater ne sont produites pour cette préversion.
- Binaire non signé Authenticode ; vérifier la provenance et le fichier SHA256SUMS.txt.

## Tests attendus
1. Vérifier la coexistence des installations Preview et stable.
2. Ouvrir Développement > Assistant IA > ChatGPT Web.
3. Vérifier le chargement des modèles Codex et le message d'état du forfait.
4. Vérifier Monaco et les fonctions serveurs déjà présentes.
5. Relever les erreurs dans le journal de l'application.

## Limites connues
- L'inférence Codex a été bloquée lors des essais par les limites du forfait. Le quota n'est pas contourné par une clé API payante.
- Le mode Sign in with ChatGPT directement vers Responses API, l'authentification OAuth intégrée, la passerelle MCP DesktopCommander et les outils agentiques avec approbations restent à développer.
- Le Codex local indépendant de Hermes est installé sur PC-MIKE sous `E:\DevCaches\hebergtonserv-desktop\codex-cli`. Sur un autre PC, configurer `HTS_CODEX_EXECUTABLE` avec un exécutable Codex vérifié.
- Les discussions Codex peuvent être enregistrées par le moteur local, indépendamment de la page.
- Ce build est réservé aux tests ; ne pas l'utiliser comme version stable de production.

Source : https://github.com/Mesrine67/hebergtonserv-desktop/pull/138
