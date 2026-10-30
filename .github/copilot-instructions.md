# Instructions pour les agents de code

- Lis AGENTS.md, README.md et les instructions du dossier concerné avant de modifier le dépôt.
- Utilise pnpm; ne réintroduis pas Bun ni bun.lock.
- Conserve la configuration Tauri v2 conforme à son schéma. Les fenêtres créées à la demande par Rust gardent create: false et sont construites depuis leur configuration Tauri.
- Maintiens des capabilities distinctes et minimales pour main. Le backend Rust valide les actions système.
- Ne place jamais de clé privée, jeton, secret de signature ou donnée personnelle dans le code, les logs ou une pull request.
- N’ajoute pas de propriété crate non prise en charge à tauri.conf.json.
- Ne déclare pas un contrôle matériel ou un test comme effectué si tu ne l’as pas réellement lancé et observé.
- Pour les changements concernés, exécute les commandes de validation listées dans CONTRIBUTING.md et distingue les résultats passés, échoués et non exécutés.
- Les jetons d'API ne sont jamais stockés en clair : ils passent par le Windows Credential Manager (crate keyring).
- Les clés privées SSH ne quittent jamais la machine et ne sont jamais envoyées aux panels.
- Les requêtes HTTP vers les panels sont HTTPS uniquement, sans redirection.
