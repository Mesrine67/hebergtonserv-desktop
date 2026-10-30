# Architecture

## Vue d'ensemble

Application Tauri 2 composée d'un frontend React/TypeScript et d'un backend Rust.

```
src/                Frontend React (Vite)
src-tauri/src/      Backend Rust
  commands/         Commandes Tauri exposées à l'IPC
  ssh/              Gestion SSH locale, config, agent, connexions, known_hosts
  providers/        Adaptateurs Wisp et Pterodactyl
  security/         Validation d'URL et protections SSRF
  storage/          Stockage JSON atomique (settings, panels, profils)
  errors.rs         Type d'erreur applicative sérialisable
  state.rs          État partagé (Storage)
```

## Flux de données

1. Le frontend appelle `invoke("command", args)`.
2. La commande Rust valide l'entrée, accède au `Storage` et/ou aux outils système (ssh, ssh-keyscan).
3. Les résultats sont sérialisés en JSON vers le frontend.
4. TanStack Query gère le cache et l'invalidation côté frontend.

## Sécurité

- Les jetons d'API sont stockés via le Windows Credential Manager (crate `keyring`), jamais dans les fichiers JSON ni le localStorage.
- Les clés privées ne sont jamais envoyées aux panels.
- Les requêtes HTTP sont HTTPS uniquement, sans redirection, avec timeout.
- Les URL de panels sont validées (schéma, hôte, absence d'identifiants/requêtes).
- Les vérifications de clés d'hôte utilisent `StrictHostKeyChecking=yes`.

## Stockage

Fichiers JSON versionnés dans le répertoire de données de l'application :
- `settings.json` : préférences.
- `panels.json` : configuration des panels.
- `profiles.json` : profils de connexion SSH.

Écritures atomiques (fichier temporaire + rename, sauvegarde `.bak`).

## Providers

- `WispProvider` : endpoints documentés (compte, clés API en lecture, clés SSH en lecture).
- `PterodactylProvider` : endpoints Client API (compte, clés API CRUD, clés SSH CRUD).

Les fonctionnalités non supportées par une instance sont signalées via `Capability<T>` plutôt qu'échouer silencieusement.
