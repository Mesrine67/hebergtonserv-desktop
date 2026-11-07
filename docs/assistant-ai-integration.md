# Assistant IA – intégration HébergTonServ Desktop

## Fonctionnalités réellement intégrées

- **ChatGPT Web** : ouverture du site officiel dans le navigateur extérieur. Aucune extraction de session, cookie, token ou appel aux endpoints privés `backend-api`.
- **Codex App Server** : liaison Rust via JSON-RPC sur `stdio`, lancement uniquement d'un `codex.exe` préautorisé (installation autonome sur E: ou variable système `HTS_CODEX_EXECUTABLE`), sans shell arbitraire.
- **Connexion ChatGPT depuis l'application** : `account/login/start` avec `type=chatgpt`. L'URL OAuth officielle est contrôlée et ouverte dans le navigateur. Le callback est géré par le processus Codex jusqu'à `account/login/completed` ; l'UI reçoit uniquement l'état de connexion, jamais les jetons.
- **Profil isolé** : le processus reçoit son propre `CODEX_HOME` sous `LocalAppData/HebergTonServDesktop/codex-isolated`. Il ne reprend pas les sessions, hooks, plugins ou MCPs de la configuration Codex globale. Une vérification `mcpServerStatus/list` échoue fermement si un MCP non déclaré est actif. Test de protocole réel : zéro serveur MCP hérité.
- **Zéro facturation API involontaire** : `account/read` doit renvoyer `type=chatgpt` et les sessions `apiKey` sont refusées.
- **Modèles et quota** : modèles disponibles obtenus par `model/list` puis revérifiés côté Rust à l'envoi ; limites lues via `account/rateLimits/read`.
- **Chat** : `thread/start`, `thread/resume`, `turn/start`, notifications `item/agentMessage/delta` relayées à la fenêtre principale avec un identifiant UUID de requête, texte final `turn/completed`.
- **Annulation** : bouton Arrêter, signal Rust et méthode officielle `turn/interrupt`. L'exécution Codex demeure en lecture seule avec approbations refusées.
- **Confidentialité** : seul le chemin du binaire est mémorisé par le frontend. Les échanges ne sont pas ajoutés au journal d'application. Codex peut toutefois enregistrer ses threads localement dans le `CODEX_HOME` isolé.
- **Monaco** : éditeur existant sur `main` conservé.

## Fork DesktopCommanderMCP

Le fork est créé à https://github.com/Mesrine67/DesktopCommanderMCP, avec les fichiers upstream préservés.

Un mode de développement `HTS_MCP_READ_ONLY=1` est ajouté au fork : dossier `HTS_MCP_ROOT` absolu et obligatoire, quatre outils de lecture uniquement, vérification des liens symboliques, refus des commandes, écritures, configurations, ressources MCP et URL. Les tests unitaires et les tests réels sur stdio sont réussis. **Le fork est maintenant raccordé en mode opt-in** au profil Codex isolé : l'utilisateur choisit explicitement un dossier dans le panneau IA, puis peut révoquer l'autorisation. En l'absence de dossier, aucun serveur MCP n'est lancé. Les permissions sont effacées au redémarrage de l'application. Les commandes et écritures restent interdites.

## Ce qui n'est pas encore terminé

- Authentification directe **Sign in with ChatGPT / Responses API** : il faut enregistrer le client OAuth éligible, obtenir les paramètres officiels et l'autorisation `chatgpt.tokens.use.direct`. Aucun jeton de `backend-api` n'est utilisé comme solution de rechange.
- Serveur Codex maintenu en mémoire entre les tours : la version actuelle ouvre encore un processus isolé par demande ; les événements sont affichés en streaming uniquement pendant le tour actif.
- Gestion de plusieurs conversations, persistance de l'historique visible, reprise après fermeture et approbations granulaire pour les futurs outils.
- Pour de futurs outils de modification et d'administration VPS, ajouter des confirmations de chaque action sensible ; seul le MCP de lecture est actuellement disponible.
- Améliorations du playground Monaco inspirées de shadcn-playground avec prévisualisation HTML/CSS sandboxée.

## Vérifications

- Exécuter `pnpm check` (TypeScript, ESLint, Vitest, build Vite).
- Exécuter `cargo check --offline`, `cargo clippy --all-targets -- -D warnings`, `cargo test --lib`.
- Le test de protocole App Server avec un `CODEX_HOME` neuf et `mcp_servers={}` a confirmé que `mcpServerStatus/list` renvoie zéro serveur MCP.
- L'inférence de bout en bout est soumise aux limites effectives du compte ChatGPT ; lors du précédent essai, le quota était atteint. Ne pas affirmer qu'une génération a été testée si ce blocage persiste.

## Références

- https://learn.chatgpt.com/docs/app-server
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://github.com/wonderwhy-er/DesktopCommanderMCP
- https://github.com/Mesrine67/DesktopCommanderMCP
- https://github.com/ephraimduncan/shadcn-playground
