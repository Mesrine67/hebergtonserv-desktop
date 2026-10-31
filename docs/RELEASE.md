# Livraison Windows et mises à jour signées

La version de production est définie dans `package.json`, `src-tauri/Cargo.toml`,
`src-tauri/Cargo.lock` et `src-tauri/tauri.conf.json`.

## Vérifications

Depuis la racine du dépôt :

```powershell
pnpm install --frozen-lockfile
pnpm check
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --locked --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

## Signature de mise à jour

L'updater Tauri 2 utilise la clé publique dans `tauri.conf.json`. La clé
privée ne doit **jamais** entrer dans le dépôt ou les logs. Les deux secrets
GitHub Actions sont `TAURI_SIGNING_PRIVATE_KEY` et
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Vérifier que la clé privée stockée
dans GitHub correspond à la clé publique avant chaque publication majeure.

La machine de développement conserve une sauvegarde locale dans un dossier
ignoré par Git (`.tauri/`). Ne pas exposer ni recopier le contenu de la clé
privée dans une issue, PR ou ticket.

## Procédure de publication

1. Fusionner les PR validées sur `main` et attendre les contrôles frontend et Rust.
2. Vérifier que la version de l'application est identique dans les quatre fichiers.
3. Créer un **nouveau** tag `vX.Y.Z` pointant vers un commit de `main` (ne jamais déplacer un ancien tag).
4. Le workflow Release doit produire une release **draft** avec les installateurs
   NSIS/MSI, les signatures updater et `latest.json`.
5. Examiner les assets, la version, les signatures et les journaux du workflow.
   Si le workflow échoue, garder la release en brouillon et ne pas annoncer de
   nouvelle version.
6. Publier la release une fois les artefacts vérifiés. La route updater
   `releases/latest/download/latest.json` ne fonctionnera qu'après publication.

## Comportement de l'application

La page Paramètres propose une vérification manuelle des mises à jour. Elle
n'installe rien en arrière-plan. L'utilisateur décide explicitement de
télécharger et d'installer une nouvelle version. Sur Windows l'installateur
signé de l'updater prend ensuite le relais.

Les signatures minisign de l'updater ne sont **pas** une signature de code
Windows Authenticode. Pour éviter les avertissements « Éditeur inconnu »,
ajouter ultérieurement une signature Authenticode appropriée.
