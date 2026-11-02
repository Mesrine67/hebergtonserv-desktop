# HébergTonServ Desktop v0.4.9

## Compatibilité API WISP / Pterodactyl

- Confirmation du **User-Agent** versionné déjà présent dans le transport Rust, testé avec les en-têtes JSON et Bearer (sans jamais afficher de jeton).
- Envoi cohérent de `Content-Type: application/json` et du bon `Accept`, y compris sur les requêtes GET.
- Nouveau sélecteur de contrat API lors de l'ajout d'un panel :
  - **WISP v1 documentée** par défaut ;
  - **WISP v2 expérimentale** uniquement sur sélection explicite, sans promesse de compatibilité ;
  - **Pterodactyl Auto / 1.x** (compatibilité existante) ou **Pterodactyl 2.x** avec `Accept: application/json`.
- Conservation des formats des panels existants ; aucun jeton n'est déplacé hors du coffre d'identifiants Windows.
- Le mode WISP v2 reste expérimental : le changelog de WISP Panel 2.x n'établit pas à lui seul une API `vnd.wisp.v2+json`.

## Référentiel documentaire

- `docs/PANEL_API_INDEX.md` : cartographie WISP/Pterodactyl, sources officielles, versions HTTP, authentification, fonctionnalités existantes et domaines restant à implémenter.
- La documentation Pterodactyl 2.0 conserve les chemins `/api/client` ; les méthodes Client, Application et Admin ne sont pas interchangeables.
- Les exemples de cookies WISP ne sont pas utilisés par l'application.

## Contrôles

- Tests Rust supplémentaires pour les en-têtes et les variantes de versions WISP et Pterodactyl.
- Tests frontend, TypeScript, ESLint, build Vite et vérifications CI Windows avant publication.
- La version synchronisée React/Tauri/Cargo est `0.4.9`.

Pour les systèmes WISP v2, une validation contractuelle sur une instance compatible sera nécessaire avant d'activer cette variante par défaut.
