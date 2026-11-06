# Tauri — HébergTonServ Desktop

Référence de l’intégration Tauri 2. À revoir à chaque évolution des capacités natives, permissions, dépendances ou workflows.

## Configuration et démarrage

- Version Tauri : `2.12.5` (`src-tauri/Cargo.toml`); CLI et API frontend : `2.12.4` (`package.json`). Garder les versions Rust et JavaScript compatibles et verrouillées.
- Configuration principale : `src-tauri/tauri.conf.json`; permissions : `src-tauri/capabilities/default.json`; initialisation native : `src-tauri/src/lib.rs`.
- La fenêtre unique `main` rend d’abord l’écran `StartupSplash`, puis rejoint `/` après le premier rendu. Cette version mono-fenêtre conserve une seule surface WebView2 et les contrôles natifs de titre. Le démarrage `--minimized` masque `main`.
- `src/App.tsx` présente ensuite l’introduction de marque (`StartupWelcome`), qui reste distincte de l’écran de chargement natif. Le splash ne simule pas de délai artificiel : il reste affiché seulement jusqu’au rendu initial.
- Les changements d’interface utilisent React, Radix et shadcn/ui dans la fenêtre principale; les panneaux flottants sont des dialogs web. N’ajouter une fenêtre native séparée que pour un besoin de cycle de vie réellement indépendant.

## Plugins installés

| Plugin | Usage dans l’application | Permissions / remarques |
| --- | --- | --- |
| `single-instance` | Une seule instance; une seconde ouverture réaffiche la fenêtre | Fenêtre principale |
| `window-state` | Persistance de la taille, position, visibilité, maximisation et plein écran | Revoir si les règles de taille changent |
| `dialog` | Sélection de chemins et sauvegarde | `dialog:allow-save`; maintenir les opérations minimales |
| `opener` | Ouverture de liens externes et ressources documentaires | `opener:default`; valider les destinations avant ouverture |
| `clipboard-manager` | Copie de texte et exports depuis l’interface | Permission accordée uniquement pour l’écriture |
| `log` | Journal natif | Ne jamais y écrire tokens, mots de passe, contenu de fichiers ou sorties serveur sensibles |
| `store` | Stockage persistant local | Les secrets panel utilisent le stockage sécurisé dédié, pas le store générique |
| `updater` | Vérification et installation explicite des mises à jour signées | Endpoint GitHub HTTPS, clé publique et artefacts signés |
| `process` | Relance/quitte l’application après installation de mise à jour | Conserver le flux d’installation explicite |
| `autostart` | Démarrage Windows réduit dans la zone de notification | `--minimized`; aucune visibilité avant action explicite |
| `websocket` | Connexion console aux WebSockets du fournisseur | Le jeton et les commandes ne sont pas journalisés |
| `notification` | Notifications natives complémentaires, notamment pour une mise à jour disponible | La boîte de réception interne reste la source de vérité. La documentation Tauri précise que Windows ne les affiche que pour une app installée; tester sur le MSI/NSIS installé, pas seulement en dev. |
| `snap-layout` (communautaire) | Bouton d’accrochage Windows 11 dans la barre de titre personnalisée | Vérifier la compatibilité à chaque mise à jour Windows/Tauri |

Les commandes Rust propres au projet couvrent SSH, appels API panel, fichiers distants bornés, gestionnaire de tâches en lecture seule et diagnostics expurgés. Elles n’ont pas besoin d’un plugin générique supplémentaire.

## Plugins et exemples évalués

- **Splashscreen** : écran React léger sur la fenêtre native principale avant de charger `/`. Le patron officiel à deux fenêtres a échoué à créer le second WebView2 sur la machine de développement (`HRESULT 0x8007139F`); l’écran d’accueil mono-fenêtre évite cette erreur tout en donnant un état visuel immédiat. Réévaluer le multi-fenêtre si le runtime cible le permet.
- **Notifications** : ajouté; permission vérifiée puis demandée à la première émission native. Un refus ou une exécution navigateur/dev ne bloque pas l’historique de notifications intégré.
- **Global shortcut** : non ajouté. Les raccourcis présents sont internes à la fenêtre; enregistrer des raccourcis globaux nécessiterait un besoin explicite et des contrôles de conflits/désinscription.
- **Deep link** : non ajouté. L’app n’a pas de flux OAuth/redirection qui doive reprendre une session à partir d’une URL personnalisée.
- **Filesystem** : pas d’accès direct large au système. Les fichiers serveur passent par le fournisseur panel, avec validation du chemin et limite d’écriture; garder cette séparation.
- **SQL / Stronghold** : non requis actuellement. Le stockage structuré et les secrets sont traités par les systèmes existants; ne pas ajouter une base ou un coffre parallèle sans migration conçue.
- **Shell** : non exposé au frontend. Les opérations de processus restent dans des commandes Rust ciblées afin d’éviter l’exécution arbitraire.
- **OS information / device info / positioner / context-menu / HTTP** : non requis à ce stade; les APIs natives ciblées ou le client HTTP Rust actuel suffisent.
- **Exemples Tauri** : l’état partagé (`AppState`), les ressources embarquées pour les docs et le bridge de fichiers contrôlé sont déjà représentés. Le multiwindow existe dans Tauri mais n’est pas une raison d’ouvrir chaque panneau dans une fenêtre native. Multiwebview est expérimental/instable et ne convient pas à un besoin actuel.

## Capacités et sécurité

- Chaque permission frontend doit être listée dans une capability et le plugin correspondant initialisé côté Rust. Ne pas utiliser `core:default` comme justification pour ouvrir des permissions additionnelles.
- Toute nouvelle fenêtre doit recevoir une capability limitée à son label; vérifier que les labels déclarés correspondent aux fenêtres créées au runtime.
- Conserver le CSP strict de `tauri.conf.json`. Ajouter une source uniquement avec une fonctionnalité correspondante et vérifiée.
- En production, revalider `devtools` et `browserExtensionsEnabled` dans la configuration de build : les activer uniquement si le débogage/extension est une exigence produit documentée.
- Les accès réseau et fichiers doivent continuer à valider hôtes, protocoles, chemins et tailles; les secrets ne doivent jamais apparaître dans les diagnostics.

## Release

- Synchroniser le numéro de version entre `package.json`, `src-tauri/tauri.conf.json` et `src-tauri/Cargo.toml`.
- Le workflow `.github/workflows/release.yml` utilise l’action officielle `tauri-apps/tauri-action` v1, génère les manifestes updater, signe les bundles et exige un tag correspondant à une version sur `main`.
- Après ajout d’un plugin natif, vérifier le lockfile Rust (`src-tauri/Cargo.lock`), le lockfile pnpm (`pnpm-lock.yaml`), les capabilities et le build installé Windows. Les notifications natives doivent notamment être vérifiées depuis un paquet installé.
- Sur le runner Windows et les postes de build, le script `scripts/configure-build-caches.ps1` place Cargo, le cache npm et les paquets Bun sous `E:\DevCaches\hebergtonserv-desktop`; les commandes `pnpm install` doivent passer `--store-dir $env:PNPM_STORE_DIR` pour stocker le magasin pnpm sur E:. Il exige le volume NTFS `INATECK_STORAGE_1` monté sur E: avec 50 Go libres. Les réglages sont limités au processus/runner du projet; aucun cache Hermes, réglage utilisateur global ou outil Rust installé n’est modifié. Le workflow doit échouer clairement si ce disque amovible est absent.

## Références

- [Guide Tauri Splashscreen](https://v2.tauri.app/learn/splashscreen/)
- [Plugins officiels Tauri](https://github.com/tauri-apps/plugins-workspace)
- [Documentation Notifications](https://v2.tauri.app/plugin/notification/)
- [Exemple Splashscreen](https://github.com/tauri-apps/tauri/tree/dev/examples/splashscreen)
