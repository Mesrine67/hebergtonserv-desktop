# HébergTonServ Desktop v0.4.18

## Expérience Windows
- Gestionnaire de tâches réparé : fenêtre flottante dans l’application, sans WebView2 secondaire vide.
- Inventaire des processus exécuté de façon asynchrone avec limite de temps, sans bloquer l’interface.
- Changelog et raccourcis dans un centre d’aide flottant à navigation latérale, inspiré du modèle shadcn sidebar-13.
- Versions GitHub sélectionnables ; notes lisibles avec titres et listes.

## Journal de diagnostic global
- Journal étendu aux commandes Tauri, à la navigation, aux événements d’interface et aux processus Windows, en plus des API WISP/Pterodactyl et Wings.
- Filtres par sous-système, 1 500 événements volatils et durée des commandes.
- « Copier pour ChatGPT » et « Copier pour Codex » : rapport structuré sans jetons, arguments, URL ni réponses sensibles.

## Fiabilité de la release
- Actions checkout/setup-node actualisées pour Node 24.
- Cache Rust facultatif conditionné à rustup et chemin workspace explicite.
- Découpage réel Vite 8/Rolldown des pages, React, Radix et Tauri : plus d’avertissement de chunk > 500 ko.

## Remarques
- Les messages de dépréciation des actions tierces peuvent persister sans affecter la signature ou les installateurs.
- Certains serveurs WISP renvoient encore HTTP 400/422 lors de la lecture de ressources : voir le suivi de compatibilité API.
