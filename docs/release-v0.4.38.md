# HébergTonServ Desktop v0.4.38

## Éditeur de fichiers

- Les fichiers ouverts restent accessibles dans des onglets propres à chaque serveur, et les brouillons non enregistrés sont conservés lorsqu’on quitte puis rouvre l’explorateur.
- Les commandes de l’éditeur sont regroupées dans sa barre d’état; une aide liste les raccourcis Monaco courants, dont annuler/rétablir, rechercher/remplacer, commenter, déplacer/copier une ligne et enregistrer.
- L’éditeur occupe maintenant sa zone de travail sans carte imbriquée.
- Le séparateur redimensionnable conserve le partage de largeur entre l’arborescence et l’éditeur et s’adapte aux fenêtres étroites.

## Mode navigateur de développement

- Les commandes Rust et le coffre Windows sont explicitement réservés à l’application Tauri. En mode navigateur, la connexion sécurisée est désactivée avec une explication claire; la clé API n’est ni persistée dans le navigateur ni transmise.
- Les appels aux commandes Tauri affichent une erreur explicite si une fonctionnalité réservée au bureau est appelée depuis le navigateur.

## Vérification et livraison

- Compilation de production et contrôles CI Frontend et Rust/Tauri réussis pour la PR #133.
- Le workflow GitHub Actions produit les installateurs Windows signés et publie cette version après les contrôles de release associés au tag `v0.4.38`.
