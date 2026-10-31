# HébergTonServ Runner Manager (Windows)

Le CLI/TUI gère et surveille le **runner GitHub Actions officiel**, sans le modifier.

## Utilisation

Depuis la racine du dépôt, dans **Windows Terminal** :

```powershell
pnpm runner:tui
pnpm runner:doctor
pnpm runner:status
pnpm runner:jobs
node scripts/runner.mjs prs
node scripts/runner.mjs issues
node scripts/runner.mjs logs --lines 35
node scripts/runner.mjs status --json
```

Le TUI propose les vues Jobs, Pull Requests, Issues, Logs et Diagnostic. Touches : `R` (rafraîchir), `J`, `P`, `I`, `L`, `D`, `Q` (quitter). Le rafraîchissement s'effectue toutes les 10 secondes.

Configuration sans chemin codé en dur :

```powershell
$env:HTS_RUNNER_DIR = 'D:\actions-runner'
$env:HTS_GITHUB_REPO = 'Mesrine67/hebergtonserv-desktop'
pnpm runner:tui
```

Les options `--runner-dir` et `--repo` sont aussi acceptées. Les commandes de lecture proposent `--json`, et `jobs`, `prs`, `issues` acceptent `--limit`.

## Actions sûres

- `pnpm runner:start` tente un démarrage seulement si aucun Runner.Listener.exe n'est déjà actif.
- `pnpm runner:stop` refuse la terminaison forcée. Pour arrêter un runner interactif, utilisez **Ctrl+C dans son terminal** ; un service Windows doit être arrêté avec ses contrôles de service.
- Le tableau de bord et les commandes de lecture n'exécutent aucune commande issue des réponses de GitHub.
- L'authentification GitHub repose sur la session existante de `gh auth`. Aucun jeton d'accès n'est conservé dans le dépôt.
- Ne lancez pas de code non fiable de PR extérieures sur un ordinateur personnel. Le workflow GitHub doit filtrer les forks ; utiliser idéalement un compte Windows ou une machine dédiée sans privilèges.

## Diagnostic de la toolchain

Le CLI signale l'absence du cargo MSVC stable et détecte les proxies Rustup vides. Le workflow CI peut utiliser le vrai chemin `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin` sans réécrire les exécutables système.

## Limites

Ce gestionnaire ne remplace ni l'interface de configuration GitHub Actions ni les contrôles de sécurité réseau. Le TUI est en lecture seule. Il ne télécharge, ne supprime et ne publie aucune release, et il ne fusionne pas les PR. 
