# HébergTonServ Desktop v0.4.17

Cette mise à jour améliore la console Wings et la gestion des panels WISP / Pterodactyl.

## Console et interface
- Rendu des séquences ANSI des logs serveur : palette de couleurs standard, 256 couleurs et RGB, sans affichage brut des codes ESC.
- Terminal modernisé dans le style de l'application : indicateur de connexion, copie des logs, effacement du tampon, retour à la ligne optionnel et défilement automatique désactivable.
- Les séquences de contrôle non prises en charge sont filtrées ; les messages restent affichés comme du texte, jamais comme du HTML.

## Infrastructure
- Page Panels enrichie : indicateurs de connexions, statuts distincts, accès directs aux serveurs et au compte associé.
- Notifications d'erreurs corrigées : les objets d'erreur Tauri sont convertis en messages compréhensibles plutôt que « [object Object] ».
- Page Compte du panel revue : sélection explicite du panel actif, accès aux serveurs propres à ce panel et présentation des détails API du compte.
- L'authentification dans Desktop reste basée sur la Client API ; la connexion e-mail/mot de passe par session protégée fait l'objet de l'issue #88, sans introduire un formulaire inopérant.

## Tests et publication
- Tests du parseur ANSI et suite frontend exécutés sur le worktree Windows.
- Installation NSIS/MSI et manifestes de mises à jour signées publiés uniquement après validation du workflow Release.
