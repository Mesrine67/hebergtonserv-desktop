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

## Interface et validation

- Composant shadcn/ui Tabs ajouté selon la configuration Mira/Radix existante.
- Vérifications locales : typecheck, lint, tests frontend, build et contrôles Rust/Tauri.
