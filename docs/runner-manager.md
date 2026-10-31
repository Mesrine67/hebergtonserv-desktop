# Gestionnaire de runner HébergTonServ — Windows

Le gestionnaire se lance indépendamment du runner GitHub Actions officiel. Il n'altère ni `C:\actions-runner\run.cmd`, ni l'enregistrement GitHub du runner. L'exécutable autonome est compilé avec Bun et conserve les mêmes commandes que `scripts/runner.mjs`.

## Compilation et installation

Sur Windows avec Bun installé : `pnpm runner:build`. Le fichier obtenu est `dist-runner/hebergtonserv-runner-manager.exe`. Ce fichier est également prévu comme asset de release à partir de v0.1.5. Aucune installation de Node.js n'est requise pour exécuter le binaire.

## Commandes

```powershell
.\dist-runner\hebergtonserv-runner-manager.exe --help
.\dist-runner\hebergtonserv-runner-manager.exe status --json
.\dist-runner\hebergtonserv-runner-manager.exe doctor --offline --json
.\dist-runner\hebergtonserv-runner-manager.exe jobs --limit 10
.\dist-runner\hebergtonserv-runner-manager.exe workflows
.\dist-runner\hebergtonserv-runner-manager.exe projects --project-number 3
.\dist-runner\hebergtonserv-runner-manager.exe projects sync --dry-run --json
.\dist-runner\hebergtonserv-runner-manager.exe projects sync --apply --json
.\dist-runner\hebergtonserv-runner-manager.exe tui
```

Le TUI du script est une interface terminal clavier/ANSI : `J` jobs, `W` workflows, `T` projets, `P` pull requests, `I` issues, `L` journaux, `D` diagnostics, `R` actualiser et `Q` quitter. Le rafraîchissement est limité à une fois toutes les dix secondes ; le mode `--offline` n'envoie aucune requête GitHub.

Paramètres disponibles : `--repo OWNER/REPO`, `--runner-dir PATH`, `--project-number N`, `--json` et `--offline`. Les appels GitHub utilisent l'authentification déjà configurée dans GitHub CLI, sans ajouter de PAT dans le dépôt.

`projects sync` **n'ajoute aucun élément par défaut**. Seul `--apply` ajoute les issues absentes du projet ; la commande charge d'abord les URL des éléments existants pour éviter les doublons. Ne pas l'exécuter avec `--apply` dans une automatisation sans validation.

## Sécurité et limitations

Le runner auto-hébergé est installé sur le PC principal : éviter toute PR non fiable ; utiliser si possible un compte Windows sans droits administrateur ou une machine isolée. `stop` et `restart` refusent l'arrêt forcé, pour éviter d'interrompre un job actif. Dans un terminal où le runner a été lancé manuellement, utiliser `Ctrl+C` pour l'arrêter proprement.

Le binaire autonome est le gestionnaire CLI/TUI, **pas** un remplacement de l'exécuteur GitHub officiel. Le packaging Bun et les tests non interactifs sont automatiques. La validation visuelle finale du TUI dans Windows Terminal (taille du terminal, navigation clavier, Unicode) reste une vérification manuelle distincte.

## Tests

`pnpm test:runner` lance les tests CLI et les tests d'idempotence GitHub Projects avec mocks. La compilation du binaire lance également un test `--help` et un test `status --offline --json` sans dépendre du réseau.
