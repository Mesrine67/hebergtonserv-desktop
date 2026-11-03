# HébergTonServ Desktop v0.4.23

## Connexion et détection des panels

- Met à jour l'écran de première connexion pour expliquer que le contrat WISP Client exige un Bearer préexistant, y compris sur son endpoint API Login. La connexion par mot de passe seul n'est donc pas présentée comme prise en charge.
- Détecte automatiquement WISP ou Pterodactyl, puis sélectionne le contrat Pterodactyl v1 ou JSON v2 à partir d'une réponse de compte valide. Les erreurs d'authentification ne déclenchent pas de repli.
- Garde la clé Client API dans Windows Credential Manager. Pterodactyl n'expose pas d'échange public documenté entre identifiants du compte et clé Client API.
- Met à jour un panel déjà configuré à la même adresse au lieu de créer un doublon, et vérifie automatiquement les nouvelles clés.
- Met à jour l'index API pour préciser les flux d'authentification et les limites des contrats détectés.

## Vérification

- `pnpm check`
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --locked --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `node scripts/validate-release.mjs`

La connexion par clé a été vérifiée auparavant sur l'API de test; un test WISP par mot de passe seul a été rejeté et confirmé incompatible avec le contrat documenté. Les tests automatisés n'utilisent aucun secret réel.
