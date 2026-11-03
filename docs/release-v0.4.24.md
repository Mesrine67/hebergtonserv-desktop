# HébergTonServ Desktop v0.4.24

## Recherche et commandes serveur

- Ajoute une palette shadcn de recherche serveur, accessible avec Ctrl+K ou le bouton de loupe, et ouvrant directement la console du serveur choisi.
- Place l’actualisation des serveurs à côté de la recherche.
- Remplace les listes déroulantes natives par le composant Select shadcn dans les pages panels, SSH et diagnostics.
- Ajoute un menu d’options serveur pour reconnecter la console, actualiser les informations, copier l’identifiant et ouvrir les fichiers ou bases.

## Vérification

- `pnpm check`
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --locked --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `node scripts/validate-release.mjs`
