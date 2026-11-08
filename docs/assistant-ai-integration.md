# HébergTonServ Desktop — Assistant IA (ChatGPT Web, forfait ChatGPT, Codex et MCP)

## Trois modes distincts

### 1. ChatGPT Web
Le bouton ouvre le site officiel `https://chatgpt.com/` dans le navigateur du poste. Aucune requête vers les endpoints privés `chatgpt.com/backend-api` ni lecture de cookies, sessions ou jetons WebView2. Les conversations ChatGPT Web ne sont pas importées dans l'application.

### 2. ChatGPT plan / Responses API (intégration native)

Client open source, selon le processus officiel Sign in with ChatGPT. Aucun secret client et aucune clé API payante ne sont nécessaires.

- Enregistrement dynamique initial `client_id=dynamic_agent_client`, nom réel de l'application et identifiant d'hôte stable `urn:uuid:…`. Au retour, conserver le `client_id` émis pour le poste.
- Ouverture du navigateur par l'application (action volontaire). Callback HTTP limité à `127.0.0.1` sur un port éphémère, chemin strict `/auth/callback`, `state` et `nonce` aléatoires, PKCE S256.
- Échange du code auprès de `https://auth.openai.com/api/accounts/oauth/token`, sans secret client.
- Vérification cryptographique du `id_token` RSA SHA-256 avec le JWKS public OpenAI, émetteur `https://auth.openai.com`, audience égale au client enregistré, `exp`, identité du compte et nonce du login.
- Vérification du scope `chatgpt.tokens.use.direct` avant tout appel aux modèles ou à l'inférence. Jetons non transmis au frontend, non consignés dans les diagnostics.
- Stockage dans **Windows Credential Manager** via `keyring`, par fragments sécurisés en deux banques pour respecter les limites de taille, avec marqueur activé seulement après écriture complète. Aucun fichier contenant des jetons n'est écrit en clair. Les éditions Preview (versions contenant un suffixe de préversion) utilisent un **service de coffre distinct de la version stable**.
- **Coffre du panel WISP également isolé** : le service Windows `hebergtonserv-desktop.preview.panel` est distinct de `hebergtonserv-desktop.panel` utilisé par la stable. Les clés WISP de production ne sont ni lues, ni écrasées, ni effacées depuis une Preview. Il faut se reconnecter au panel dans chaque édition après l'installation.
- Renouvellement des jetons avant expiration via `refresh_token`, sérialisé pour protéger les rotations ; validation de l'identité en cas de nouveau jeton d'identité.
- Catalogue du compte : `GET https://api.openai.com/v1/models`, filtrage `visibility=list`, noms et identifiants fournis par le service.
- Messages : `POST https://api.openai.com/v1/responses` avec `store=false`, `stream=true` et le modèle autorisé, streaming des `response.output_text.delta` vers la fenêtre principale uniquement. Seul `response.completed` signale le succès.
- Déconnexion : tentative de révocation distante du renouvellement, puis effacement local des fragments sécurisés. Une révocation distante impossible est signalée explicitement.

**Limitation de cette première implémentation :** un compte ChatGPT plan à la fois. L'inférence réelle reste à vérifier par une connexion volontaire d'un utilisateur éligible ; les tests automatiques n'utilisent pas de vrai compte ni de jeton de production. Les quotas et les autorisations dépendent du compte, et rien n'est illimité.

### 3. Codex App Server

- `codex.exe app-server` lancé par Rust sans shell à partir d'un binaire approuvé, indépendant de Hermes.
- Le type de compte Codex doit être `chatgpt` ; les connexions avec clé API sont refusées.
- Profil `CODEX_HOME` isolé de la configuration principale, catalogue `model/list`, limites `account/rateLimits/read`. La Preview utilise un **profil Codex distinct** de la future version stable pour éviter de partager les identifiants et les discussions.
- Connexion ChatGPT depuis l'application via `account/login/start` ; l'URL officielle s'ouvre dans le navigateur, et seul l'état de connexion revient à l'interface.
- Discussions avec `thread/start`, `thread/resume`, `turn/start`, texte progressivement affiché et bouton Arrêter via `turn/interrupt`.
- Mode de travail Codex `read-only`, approbations refusées. Le profil ne récupère pas les MCP mondiaux et refuse tout serveur MCP non attendu.
- Le moteur Codex peut conserver des threads dans son profil isolé ; ces données ne sont pas équivalentes aux conversations ChatGPT Web.

## DesktopCommander MCP

Fork : https://github.com/Mesrine67/DesktopCommanderMCP

Le mode `HTS_MCP_READ_ONLY=1` nécessite un `HTS_MCP_ROOT` absolu. Quatre outils seulement : `read_file`, `read_multiple_files`, `list_directory`, `get_file_info`. Les écritures, commandes, accès URL, changements de configuration et ressources UI sont bloqués. Les chemins sont canonisés pour interdire les liens symboliques et jonctions Windows hors de la racine.

Dans le panneau IA, l'utilisateur peut autoriser un dossier ou révoquer son accès. Aucun MCP n'est lancé sans autorisation, et la permission disparaît au redémarrage de l'application. Le fork et le binaire Node doivent être installés et approuvés sur la machine concernée. Pas d'accès SSH/VPS ni d'actions administratives.

## Monaco et interface

Monaco Editor est **déjà intégré à main** et conservé. Une prévisualisation dynamique HTML/CSS inspirée de shadcn-playground doit être isolée de l'IPC Tauri avant toute activation ; le dépôt Next.js externe n'est pas ajouté comme dépendance de l'application.

## Validation et publication

Frontend : `pnpm check` (TypeScript, ESLint, Vitest, build Vite).

Rust : `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib`.

Pour isoler le cache Cargo de développement du cache de livraison et des autres projets, définir `CARGO_TARGET_DIR=E:\DevCaches\hebergtonserv-desktop\cargo-target-siwc-check` lors des vérifications. Conserver `CARGO_HOME` sur le cache dédié de `E:`.

Le code direct OAuth peut être vérifié par des tests de construction d'URL, PKCE, audiences, validation des entrées et parsing du streaming. Ne jamais utiliser des jetons réels dans des tests automatisés ou joindre des credentials aux issues/PR.

**Ne pas fusionner une préversion expérimentale dans une release stable** avant validation de la connexion OAuth réelle, du comportement après expiration/renouvellement et de la sécurité des permissions MCP sur l'application installée.

## Références officielles

- https://developers.openai.com/siwc/token-sharing-open-source/
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/accounts-and-sessions
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- https://learn.chatgpt.com/docs/app-server
- https://github.com/Mesrine67/DesktopCommanderMCP
