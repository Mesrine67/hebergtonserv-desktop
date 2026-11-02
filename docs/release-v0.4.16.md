# HébergTonServ Desktop v0.4.16

Cette version stabilise les connexions API et améliore le lancement et la fermeture de l'application Windows.

## Améliorations
- Journal API commun accessible depuis **Aide → Journal des API** : WISP, Pterodactyl et consoles Wings, sans journaliser les jetons ou les réponses sensibles (correctif de la PR #86).
- Prise en charge du format de console WISP `{url, token}` et du format Pterodactyl `{data: {socket, token}}` (PR #86).
- Écran de bienvenue plus épuré : suppression de « Passer l'introduction », action « Démarrer » harmonisée avec le thème et ses contrôles d'accessibilité.
- Ouverture plus fluide : la fenêtre apparaît après le rendu initial React, sans panneau WebView vide et sans superposition de l'introduction avec le tableau de bord.
- Fermeture progressive via la barre de titre, le menu et Alt+F4, en conservant le paramètre « réduire dans la zone de notification ».
- Tests Rust du journal API isolés pour corriger l'échec aléatoire sous exécution parallèle sur le runner Windows.

## Compatibilité et sécurité
- Aucun jeton API n'est embarqué ou enregistré dans le journal.
- Les fermetures forcées par Windows ou le Gestionnaire des tâches ne peuvent pas être animées après l'arrêt du processus.
- WISP/Pterodactyl : la couverture des endpoints expérimentaux et des permissions dépend de la version du serveur et reste suivie par l'issue #69.
- Les installateurs Windows et le manifeste de mise à jour sont publiés après validation du pipeline de release et des signatures Tauri.
