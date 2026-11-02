# HébergTonServ Desktop v0.4.8

## Discussion intégrée à la titlebar

- Nouveau bouton **Discussion** immédiatement à gauche du bouton **Mises à jour**.
- Panneau flottant shadcn Mira, compatible avec les palettes de couleurs et les modes clair/sombre.
- Composants officiels shadcn : **Message Scroller**, **Message**, **Bubble**, **Input Group**, **Popover** et **Textarea**.
- Défilement adapté aux conversations, bulles alignées selon l'émetteur, horodatages et retour au dernier message.
- Champ de saisie multiligne, envoi par **Entrée**, saut de ligne par **Maj + Entrée**, raccourcis de questions et bouton « Nouvelle discussion ».
- Historique de discussion sauvegardé uniquement sur le PC, limité à 80 messages (aucune transmission réseau de cet historique).
- Conseils locaux sur les mises à jour, les clés SSH, les panels Wisp/Pterodactyl et les thèmes.

## Limites explicites

Cette première version n'est pas un assistant IA connecté et ne fournit pas de messagerie entre utilisateurs. Les réponses sont des fiches d'aide locales. Aucun token, fournisseur IA ou endpoint distant n'est configuré et aucune réponse fictive de modèle n'est simulée.

## Fiabilité

- Préservation de la taille et des interactions de la titlebar Tauri.
- Protection contre les données de stockage invalides, limite de longueur des messages et fallback si le stockage navigateur est indisponible.
- Accessibilité : libellés, clavier, focus, thème et réduction des mouvements.
- Build React/Vite et tests ; publication Windows via les workflows officiels signés de GitHub.

## Références

- https://ui.shadcn.com/docs/components/base/message-scroller
- https://ui.shadcn.com/docs/components/base/message
- https://ui.shadcn.com/docs/components/base/bubble
- https://ui.shadcn.com/docs/components/base/input-group
- https://ui.shadcn.com/docs/ai-elements/base/chat
