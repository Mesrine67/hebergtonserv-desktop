# GitHub Projects — HébergTonServ Desktop

Ce dépôt utilise **GitHub Projects v2** pour la planification de la maintenance et des développements confiés à Hermes.

## Installation par Hermes sur Windows

Depuis la racine du dépôt, avec une version récente de GitHub CLI :

```powershell
gh auth status
gh auth refresh -s project
.\scripts\setup-github-project.ps1 -DryRun
.\scripts\setup-github-project.ps1
```

Si un projet adéquat est déjà créé, préciser son numéro pour éviter un doublon :

```powershell
.\scripts\setup-github-project.ps1 -ProjectNumber 3
```

Le script réutilise un projet existant qui correspond à HébergTonServ Desktop (ou exige le numéro lorsqu'il y en a plusieurs), crée sinon un GitHub Project lié à `Mesrine67/hebergtonserv-desktop`, ajoute les issues et pull requests ouvertes, et initialise uniquement les champs manquants. Il n'efface rien, ne publie rien et ne fusionne pas de PR.

### Champs du projet

- **Status** : utiliser le champ natif GitHub et une vue **Board** groupée par statut.
- **Priorite** : P0 (bloquant), P1 (haute), P2 (normale), P3 (secondaire).
- **Domaine** : CI, Panels, SSH, Windows, Security, Release, Other.

Pour les nouveaux items, les priorités et domaines sont préremplis selon les tickets #1-#5, #8-#9, #13-#17 et la PR #12. Les statuts déjà modifiés manuellement restent inchangés.

### Ordre de traitement Hermes

1. PR #12 et issue #8 — restaurer l'installation pnpm, régénérer le lockfile et valider les workflows.
2. Issue #13 — authentification API des panels et stockage sécurisé des jetons.
3. Issue #16 — validation HTTP/SSRF et limites de réponses.
4. Issues #14 et #15 — SSH `known_hosts`, démarrage, tray, autostart.
5. Issue #17 et #9 — artefacts Windows signés et updater Tauri.
6. Issues #1-#5 — maintenir/fermer selon les corrections réellement fusionnées.

### Configuration UI recommandée

Dans GitHub Projects, créer une vue **Board** groupée par Status, une vue **Table** pour toutes les tâches, et des vues filtrées `Domaine:CI`, `Domaine:Security` ou `Domaine:Release`. Les vues ne sont pas créées par ce script : GitHub CLI ne fournit pas de commande de création de vues. Activer dans l'interface l'automatisation native qui passe une issue fermée ou une PR fusionnée à Done.

### Garde-fous

Ne jamais committer de secrets ou de clés de signature. Conserver les licences existantes. Chaque correctif de Hermes doit être isolé dans une branche et documenté dans une PR. Les releases ne doivent être produites qu'après validation des tests et des signatures.

> Cette configuration a été ajoutée au dépôt pour exécution par Hermes. Elle n'implique **pas** qu'un tableau Projects a déjà été créé ou modifié à distance.
