# HébergTonServ Desktop v0.4.0

## Panels WISP et Pterodactyl

- Refonte de la page serveurs avec des cartes plus lisibles, l'état du serveur, son identifiant court, son adresse de connexion et son jeu.
- Affiche les métriques CPU, mémoire et stockage renvoyées par l'API de ressources, ainsi que les joueurs quand le panel et le jeu exposent cette information.
- Charge les métriques uniquement pour les 12 serveurs visibles, avec une actualisation automatique chaque minute.
- Ajoute recherche et pagination côté interface pour les listes de serveurs.
- Conserve le type de média WISP documenté `application/vnd.wisp.v1+json` et utilise l'API Client Pterodactyl pour les ressources compatibles.

## Interface de bureau

- Ajoute une barre supérieure intégrée avec navigation, thème et contrôles natifs de fenêtre Tauri.
- Étend la sidebar pour une navigation plein écran, avec largeur ajustée et mode réduit.
- Retire les décorations natives Windows afin d'aligner la fenêtre sur le shell de l'application.
