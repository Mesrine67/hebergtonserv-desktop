# Assistant IA – intégration progressive (7 novembre 2026)

## Architecture effectivement implémentée

- Une entrée **Assistant IA** est ajoutée à l'espace Développement.
- **ChatGPT Web** ouvre le domaine officiel dans le navigateur externe ; aucune extraction de cookies, de jetons, ni d'appel vers des endpoints internes `backend-api`.
- **Codex local** est appelé depuis Rust via `codex app-server` et des requêtes JSON-RPC sur **stdio**. La WebView ne reçoit pas de jetons d'authentification. Le programme lancé doit être le `codex.exe` approuvé de l'installation autonome sur E: ou la cible de la variable d'environnement administrateur `HTS_CODEX_EXECUTABLE`. Un chemin arbitraire fourni par la WebView est refusé, et aucune commande shell générique n'est exécutée.
- `account/read` doit renvoyer un compte de type `chatgpt`. Une session de type `apiKey` est **refusée**, pour empêcher une facturation API involontaire.
- Le choix du modèle est lu dynamiquement via `model/list`, non fixé dans le code. Le backend revérifie la liste autorisée pour chaque message.
- `account/rateLimits/read` récupère l'état du quota, y compris la date de réinitialisation. Quand le forfait est bloqué, l'envoi est désactivé.
- Le binaire Codex peut être installé de façon indépendante sur E: ; aucun outil Hermes n'est requis.
- Une discussion appelle `thread/start` puis `turn/start`, et une discussion poursuivie appelle `thread/resume`. Les sorties d'agent sont collectées jusqu'à `turn/completed`.
- Le thread est créé avec `sandbox=read-only` et `approvalPolicy=never`, dans un répertoire de travail vide. Cette étape est réservée aux échanges de diagnostic et à la lecture seule. Les flux de modification seront soumis à un mécanisme d'approbation dédié avant activation.
- L'historique de la conversation est conservé en mémoire dans la page et n'est pas transmis au journal de diagnostics ; seul le chemin du binaire est conservé dans `localStorage`. **Attention :** Codex App Server peut sauvegarder séparément ses threads dans le répertoire de sessions Codex du compte local.

## Limitations volontaires de ce premier lot

- L'authentification Codex doit déjà être active pour l'exécutable sélectionné ; ce lot n'implémente pas encore `account/login/start` et son cycle de callback OAuth.
- Le pont utilise un processus App Server **par requête** ; il n'a pas encore de streaming progressif dans l'interface, de reprise des événements après fermeture, ni d'annulation interactive.
- Les MCP configurés dans le profil Codex externe peuvent être chargés par App Server. Avant d'autoriser des outils puissants, créer un profil Codex isolé et un registre de permissions/approbations explicites. `sandbox=read-only` ne remplace pas une politique d'accès aux outils MCP.
- Sign in with ChatGPT + Responses API exige l'enregistrement officiel d'un client OAuth et l'autorisation `chatgpt.tokens.use.direct`. L'option est documentée mais non activée sans ces prérequis : aucune clé privée ni client OAuth fictif n'est ajoutée.
- Aucun appel ni proxy vers `chatgpt.com/backend-api`. Les modèles de ChatGPT Web ne sont pas confondus avec le catalogue de Codex ou le catalogue SIWC.

## Étapes suivantes

1. Enregistrer l'application open source dans le parcours Sign in with ChatGPT ; effectuer le flux OAuth PKCE et conserver les jetons uniquement dans un coffre natif.
2. Utiliser `GET /v1/models` avec le jeton autorisé, puis `POST /v1/responses` avec `store=false` et `stream=true`, en vérifiant l'événement final et les limites du forfait.
3. Implémenter un processus App Server persistant avec messages en flux, annulation, approbations et connexion ChatGPT entièrement pilotée dans l'UI.
4. Étudier et adapter DesktopCommanderMCP comme serveur MCP local **désactivé par défaut**, avec liste d'outils autorisés, audit, confirmations et séparation stricte des machines/projets. Ne pas reprendre les services hébergés privés de Remote Desktop Commander.
5. Conserver Monaco déjà présent sur `main` ; ajouter éventuellement une prévisualisation HTML/CSS sandboxée sans pont Tauri, inspirée de shadcn-playground, après vérification de sécurité.
6. Tester la compatibilité avec les runners Windows, lancer une PR et un déploiement seulement après validation CI.

## Sources techniques

- https://learn.chatgpt.com/docs/app-server
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery
- https://learn.chatgpt.com/docs/extend/mcp
- https://github.com/wonderwhy-er/DesktopCommanderMCP
- https://github.com/ephraimduncan/shadcn-playground
