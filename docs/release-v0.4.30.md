# HébergTonServ Desktop v0.4.30

## Navigation et sidebar

- Le bouton Afficher/masquer la sidebar est désormais placé **après Retour et Avancer, juste avant Fichier** dans la barre de titre.
- Le haut de la sidebar devient un sélecteur d'espaces de travail : **HébergTonServ / Infrastructure, SSH, Développement**. Les entrées naviguent vers les véritables pages.
- Suppression du groupe Application de la navigation principale. Paramètres, Sécurité et Documentation se trouvent dans le menu utilisateur du bas.

## Mises à jour automatiques

- Vérification automatique et discrète 12 secondes après l'ouverture de l'application, puis toutes les heures ; nouvelle vérification au retour au premier plan si la précédente date de plus de 15 minutes.
- Badge de notification animé sur le bouton de mise à jour lorsqu'une nouvelle version signée est disponible, avec prise en compte de la préférence Réduire les animations.
- Statut et informations de version partagés avec la section Paramètres, notification dédupliquée par version, et affichage des notes de mise à jour.
- **Aucune installation automatique** : l'utilisateur doit cliquer Installer.

## Explorateur et éditeur de fichiers serveur

- Correction d'un bug de hooks React pouvant casser l'interface en ouvrant Fichiers lors de la transition du chargement à la liste.
- Éditeur de code intégré avec coloration légère, numéros de lignes, indentation, copie, retour à la ligne, état modifié et Ctrl+S.
- Sauvegarde à la demande sur le serveur via l'API client WISP ou Pterodactyl, avec contrôle de chemin, limite de 1 Mio et détection d'un fichier modifié à distance.
- Correction de la lecture Pterodactyl en texte brut (au lieu d'attendre du JSON).

## Qualité

- 61 tests Frontend, typage TypeScript, ESLint et build Vite réussis.
- 63 tests Rust, Rustfmt et Clippy réussis.
- CI GitHub Frontend et Rust/Tauri verte sur la PR #109.
- Les fichiers des panels sont modifiés uniquement à la demande de l'utilisateur. La sauvegarde dans un panel réel doit être essayée sur un serveur de test avant une configuration de production.

**Pull request fonctionnelle :** https://github.com/Mesrine67/hebergtonserv-desktop/pull/109

**Comparaison :** https://github.com/Mesrine67/hebergtonserv-desktop/compare/v0.4.29...v0.4.30
