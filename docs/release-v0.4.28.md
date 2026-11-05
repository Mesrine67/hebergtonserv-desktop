# HébergTonServ Desktop v0.4.28

## Cartes serveurs : interface simplifiée

- Un **seul bouton d'actions (···)** par serveur remplace les boutons visibles Console et Gérer.
- Le menu déroulant regroupe **Ouvrir la console**, **Fichiers**, **Bases de données** et **Sous-utilisateurs**, sans modifier les routes existantes.
- Le **type de service** est affiché sous le badge de statut (En ligne, Arrêté, Suspendu, etc.) ; les libellés longs restent lisibles au survol.
- La zone centrale vide des cartes a été supprimée. Les statistiques CPU, mémoire, stockage, joueurs et réseau restent accessibles.

## Habillage selon le service

- Fonds dégradés et icônes discrètes intégrés à l'application pour **FiveM/RedM, Node.js, Minecraft, Discord, Java, Python, bases de données et jeux courants**.
- Icône générique pour les services inconnus ou sans egg.
- Aucun téléchargement d'image externe et aucun nouveau droit API administrateur : le nom de l'egg retourné par WISP/Pterodactyl suffit.

## Qualité et compatibilité

- Les chemins de navigation de console, fichiers, bases de données et sous-utilisateurs sont conservés.
- Tests ajoutés pour la reconnaissance des types de service, le menu unique et le placement des badges.
- Aucun changement du système de signatures ou de mise à jour Tauri.

**Changement principal :** https://github.com/Mesrine67/hebergtonserv-desktop/pull/105

**Comparaison :** https://github.com/Mesrine67/hebergtonserv-desktop/compare/v0.4.27...v0.4.28
