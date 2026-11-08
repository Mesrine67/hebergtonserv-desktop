# HébergTonServ Desktop Preview v0.4.39-rc.4

**Préversion de test Windows x64** issue de la [PR #138](https://github.com/Mesrine67/hebergtonserv-desktop/pull/138) et des évolutions de la rc.3.

## Nouveautés rc.4

- **ChatGPT plan / Responses API**, via « Continuer avec ChatGPT » : enregistrement OAuth officiel dynamique, PKCE, retour local 127.0.0.1, vérification cryptographique de l'identité et autorisation du forfait, sans clé API payante.
- Sélection des modèles effectivement accessibles au compte via `GET /v1/models`, chat direct via `POST /v1/responses` avec `store=false` et `stream=true`.
- Jetons conservés côté Rust dans Windows Credential Manager (fragments sécurisés) et non transmis à React ; renouvellement et déconnexion avec tentative de révocation distante.
- Commandes sensibles accessibles seulement à la fenêtre principale Tauri.
- **Monaco** : bouton Aperçu pour les fichiers HTML/CSS, avec iframe sandboxée sans scripts, accès au réseau ni pont Tauri. L'éditeur Monaco existant reste le même.
- **Codex et MCP** : connexion ChatGPT, streaming et arrêt des réponses ; accès DesktopCommanderMCP en lecture seule et à un seul dossier explicitement autorisé, conservés depuis la rc.3.

## Installation

- Installez NSIS (EXE) ou MSI pour Windows x64. Application séparée : `com.hebergtonserv.desktop.preview`.
- Version de l'application : `0.4.39-rc.4`. Le MSI utilise la version technique `0.4.39-4` pour satisfaire WiX.
- Aucune signature Authenticode dans cette Preview ; comparer les SHA-256 avant l'installation.
- Pas d'artefacts Tauri updater ; la mise à jour de la stable ne publie pas cette Preview.
- Les fonctionnalités Codex et MCP local requièrent les binaires correspondants approuvés sur le poste ; voir `docs/assistant-ai-integration.md`.

## Vérifications de code

- `pnpm check` : TypeScript, ESLint, tests et build Vite : réussi (71 tests, dont 3 tests supplémentaires pour la prévisualisation Monaco).
- `cargo check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --lib` : réussis dans un cache Cargo dédié (71 tests Rust).
- Tests du fork DesktopCommanderMCP en lecture seule déjà réalisés sur le client MCP stdio.

## Essais à réaliser dans l'application installée

1. Vérifier la coexistence avec la dernière version stable.
2. Ouvrir **Développement → Assistant IA → Continuer avec ChatGPT** : accepter le consentement dans le navigateur, tester le retour automatique et la liste des modèles, puis une réponse et la déconnexion.
3. Tester Codex App Server avec un compte ayant du quota restant, l'affichage en temps réel et l'arrêt d'une réponse.
4. Autoriser puis révoquer un dossier MCP et vérifier le refus des chemins extérieurs.
5. Ouvrir un fichier HTML/CSS dans Monaco et vérifier l'aperçu isolé et la conservation des modifications non enregistrées.

## Limitations

- L'authentification et l'inférence **réelles sur un compte tiers ne sont pas couvertes par les tests automatisés**, car elles demandent le consentement de l'utilisateur. Les quotas du forfait ChatGPT s'appliquent.
- La préversion est expérimentale. Ne pas la traiter comme une release stable.
- Pas de synchronisation automatique avec l'historique de ChatGPT Web.
- Pas d'accès SSH/VPS, d'écriture ou de commande autorisé via le MCP de lecture seule.
- Les conversations Codex restent gérées par le profil local isolé ; le mode direct garde ses messages dans l'interface pendant la session.

Sources : [PR #138](https://github.com/Mesrine67/hebergtonserv-desktop/pull/138) et [fork DesktopCommanderMCP](https://github.com/Mesrine67/DesktopCommanderMCP).
