# HébergTonServ Desktop

Application desktop Windows (Tauri 2) pour gérer les clés SSH locales, les profils de connexion et les intégrations de panels d'hébergement (Wisp / Pterodactyl).

## Stack

- Frontend : React 19, TypeScript strict, Vite, Tailwind CSS, shadcn/ui, Lucide, TanStack Query, Zod, React Router, Sonner.
- Backend : Rust (Tauri 2), reqwest (HTTPS uniquement), ssh-key, keyring (Windows Credential Manager).

## Commandes de développement

```bash
pnpm install
pnpm tauri dev
```

## Commandes de validation

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## Build Windows

```bash
pnpm tauri build
```

L'installateur NSIS et le MSI sont produits dans `src-tauri/target/release/bundle/`.

## Fonctionnalités

| Fonctionnalité | État |
|---|---|
| Gestion des clés SSH locales (~/.ssh) | Implémenté |
| Génération de clés (Ed25519 par défaut, RSA, ECDSA) avec phrase de passe | Implémenté |
| Import de clés publiques | Implémenté |
| Renommage / suppression (corbeille) | Implémenté |
| Statut de l'agent SSH Windows | Implémenté |
| Profils de connexion SSH (ajout/édition/suppression/test) | Implémenté |
| Vérification des clés d'hôte (ssh-keyscan) | Implémenté |
| Intégration panels Wisp + Pterodactyl | Implémenté |
| Gestion des clés API et SSH côté panel | Implémenté |
| Stockage sécurisé des jetons (Windows Credential Manager) | Implémenté |

## Limitations connues

- La création de clés API/SSH côté Wisp n'est pas exposée par l'API publique documentée ; l'application indique ces fonctionnalités comme non supportées pour cette instance.
- L'authentification par mot de passe n'est pas testée automatiquement (BatchMode).
- L'import depuis `~/.ssh/config` est disponible mais ne crée pas automatiquement les profils persistés (à importer manuellement).
- Le tray icon et l'autostart sont déclarés mais peuvent nécessiter des ajustements selon l'environnement Windows.
