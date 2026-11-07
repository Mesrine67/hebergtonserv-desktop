# HébergTonServ Desktop Preview v0.4.39-rc.1

**Préversion expérimentale Windows x64**, depuis PR #138 : https://github.com/Mesrine67/hebergtonserv-desktop/pull/138

## Fonctionnalités incluses

- **Développement → Assistant IA** : page séparée avec accès au site officiel ChatGPT Web.
- **Codex App Server** : pont Tauri/Rust en stdio JSON-RPC, compte ChatGPT, modèles disponibles, discussions en lecture seule.
- Rejet de l'authentification par clé API pour éviter la facturation API involontaire.
- Vérification des limites du forfait et désactivation de l'envoi quand le quota est atteint.
- Monaco Editor déjà présent sur main, conservé.
- Installation **Preview** séparée : identifiant Windows `com.hebergtonserv.desktop.preview` et données d'application distinctes.

## Limites et précautions

- Préversion non stable. Conserver la v0.4.38 stable pour les services de production.
- Cette préversion n'utilise pas d'artefacts Tauri updater signés et **ne doit pas** être proposée par l'updater stable.
- Les installateurs peuvent déclencher SmartScreen faute de signature Authenticode. Vérifier la provenance et les SHA-256.
- Une installation officielle Codex indépendante de Hermes se trouve sur PC-MIKE dans `E:\DevCaches\hebergtonserv-desktop\codex-cli`. Pour un autre poste : installer Codex et définir `HTS_CODEX_EXECUTABLE` côté système.
- Le test App Server a reconnu le compte et huit modèles, mais l'inférence est actuellement bloquée par le quota du forfait ChatGPT/Codex.
- OAuth direct Sign in with ChatGPT/Responses API, MCP DesktopCommander, agents avec permissions, streaming interactif et previews Monaco avancées : **pas encore inclus**.
- Les threads peuvent être sauvegardés localement par Codex App Server, séparément de l'interface.

## Tests à réaliser

1. Installer la Preview à côté de la version stable et vérifier l'absence d'écrasement de la version stable.
2. Ouvrir Développement → Assistant IA, puis ChatGPT Web.
3. Vérifier le compte Codex, la liste des modèles et l'affichage du quota.
4. Vérifier l'éditeur Monaco et les fonctions serveurs existantes.

Tag GitHub : `preview-v0.4.39-rc.1`.
