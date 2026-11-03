# HébergTonServ Desktop v0.4.22

## Sécurité

- Force `minimatch` à la version corrigée 11.0.1 pour toutes les dépendances npm transitives.
- Retire la CLI `shadcn`, qui n'était référencée dans aucun code ni script du dépôt. Elle introduisait la dépendance transitive `deepmerge` 4.3.1; l'avis GitHub n'ayant pas encore de version corrigée, le retrait du consommateur inutilisé élimine cette dépendance du lockfile.
- Conserve son petit jeu de styles Tailwind directement dans le dépôt, avec l'avis de licence MIT, pour que le build ne dépende plus de la CLI.

## Vérification

- Vérifier le graphe final avec `pnpm why minimatch` et `pnpm why deepmerge`.
- `pnpm check`, `pnpm audit`, `cargo fmt`, `cargo clippy` et `cargo test`.
