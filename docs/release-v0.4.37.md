# HébergTonServ Desktop v0.4.37

## Éditeur de fichiers

- Le panneau de l’éditeur remplit toute la hauteur disponible de l’explorateur de fichiers.
- Monaco et sa zone de code s’étendent avec le panneau redimensionnable, y compris quand la fenêtre est maximisée.
- L’arborescence conserve son propre défilement et son séparateur reste redimensionnable.
- Le séparateur a une cible de glissement plus large et laisse un espace entre l’arborescence et l’éditeur, y compris avec WISP.
- Le glissement du séparateur redimensionne les deux panneaux ensemble et conserve leurs proportions dans le layout.

## Console et diagnostic

- Ajout de la recherche dans la console avec Ctrl+F/F3, d’un badge d’uptime, des contrôles de démarrage/redémarrage/arrêt/arrêt forcé, et de l’ouverture dans une fenêtre détachée.
- Les logs de console peuvent être exportés sur le disque local. Aucune transmission à un service externe n’est effectuée.
- Le journal de diagnostic inclut maintenant les arguments et réponses JSON structurés des commandes Tauri et les corps JSON des échanges Client API, avec valeurs sensibles expurgées et taille bornée.
- Les étapes de WebSocket Wings (authentification, demandes de flux, états, lots de sorties, commandes et erreurs) sont documentées sans stocker le texte de console, les commandes ou les jetons.

## Vérification et livraison

- TypeScript, ESLint, les 68 tests Vitest, les 65 tests Rust et la compilation de production passent.
- Le glissement entre l’arborescence et l’éditeur a été vérifié dans l’application Tauri : la largeur est passée de 24,38 % à 35,64 % et les deux cartes ont bougé ensemble.
- Le workflow GitHub Actions est chargé de produire et publier les installateurs Windows signés NSIS/MSI après le tag `v0.4.37`.
