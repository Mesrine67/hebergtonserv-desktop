
# HébergTonServ Desktop v0.1.6

## Correctifs Windows
- Corrige l'ouverture de **hebergtonserv-runner-manager.exe** au double-clic : menu interactif visible sans argument, commandes et mode hors ligne conservés.
- Ajoute un test de lancement sans argument à la compilation du gestionnaire autonome.
- Stabilise le workflow GitHub Actions sur le runner Windows : conserve pnpm 12.15.0 installé, sans écraser le lanceur Hermes.

## Interface
- Corrige la double sélection entre une section SSH et la sous-page courante, avec navigation active unique.
- Ajoute le menu de session Windows locale en bas de sidebar : informations de l'appareil, paramètres, sécurité, clés SSH.
- Ajoute un bouton de mises à jour en haut : vérification des releases signées et confirmation explicite avant installation.
- Applique le symbole bleu HébergTonServ fourni aux icônes Tauri Windows (ICO, barre des tâches, tray, installateurs), ainsi qu'aux icônes PNG/ICNS et à l'en-tête de l'application.

## Validation
- TypeScript, ESLint, tests React, build Vite, tests CLI.
- Rust formatting, Clippy, tests Rust Windows.
- Exécutable autonome lancé sans argument et fermé normalement par Q.
- Release Windows : NSIS, MSI, deux signatures updater, latest.json et runner-manager.exe.

La release reste en brouillon tant que les contrôles des artefacts de distribution ne sont pas terminés.
