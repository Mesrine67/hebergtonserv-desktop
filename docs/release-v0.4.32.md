# HébergTonServ Desktop v0.4.32

## Console et bases de données

- La console serveur s’ouvre dans une fenêtre flottante centrée, avec fermeture dédiée et sans les onglets Console/Fichiers/Bases de données dans la fenêtre.
- Les bases de données s’ouvrent dans leur propre fenêtre flottante. Le bouton Retour local a été retiré au profit de la navigation de la barre de titre.

## Explorateurs de fichiers

- Ajout d’onglets d’explorateurs inspirés des navigateurs, persistés localement et identifiés par panel et serveur.
- Chaque onglet ouvre l’URL des fichiers d’un serveur précis. Les onglets peuvent être fermés ou changés, et le bouton + revient à la sélection du serveur.

## Journal de l’application

- Ajout d’un export JSON structuré contenant la version de l’application, l’heure d’export, le nombre d’événements et les diagnostics expurgés.
- L’export texte existant reste disponible; les détails de réponse sont filtrés avant leur ajout au journal.
- Ajout d’identifiants d’événement et d’une version de schéma, ainsi que de détails whitelistes pour chaque phase WebSocket (connexion, authentification, expiration et envoi), les appels de commandes et les captures Windows.
- Copie JSON directe, détail des événements et export texte enrichi disponibles pour le diagnostic temporaire pré-stabilisation.

## Interface

- Notifications affichées en bas à droite et accordées au thème actif de l’application.
- Raccourcis clavier dans un panneau dédié depuis le menu Aide; le changelog est accessible depuis « Mises à jour de l’application ».
- Paramètres et Sécurité présentés sous forme de panneaux flottants.
- Gestionnaire de tâches enrichi avec tri, filtre, sessions, fréquence de rafraîchissement, export CSV et aperçu des processus les plus consommateurs; lecture seule.

## Interface et validation

- Composant shadcn/ui Tabs ajouté selon la configuration Mira/Radix existante.
- Vérifications locales : typecheck, lint, tests frontend, build et contrôles Rust/Tauri.

## Préparation de publication

- Version synchronisée : `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` et `src-tauri/tauri.conf.json` en `0.4.32`.
- Fonctionnalités intégrées dans la PR #113 (`772d21c`).
- Après validation des contrôles de cette préparation, créer le tag annoté `v0.4.32` sur le commit fusionné de `main`. Le workflow Windows construira et vérifiera les installateurs signés avant de publier la release.
