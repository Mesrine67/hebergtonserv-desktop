# HébergTonServ Desktop v0.4.36

## Fiabilité des panneaux flottants

- Une interaction avec la page située sous un panneau n’entraîne plus sa fermeture implicite ; les contrôles de la page restent utilisables.
- Les panneaux peuvent être refermés puis rouverts sans perdre leur déclencheur.
- Paramètres et Sécurité s’ouvrent depuis les menus utilisateur et Accueil au moyen du même hôte de panneaux que Journal et Raccourcis.
- Nouveautés et changelog est géré par le même hôte et son événement d’ouverture reste réutilisable après fermeture.
- Les liens obsolètes vers les pages Paramètres et Sécurité sont remplacés par les actions qui ouvrent leurs panneaux.
- Les onglets d’explorateurs de fichiers sont intégrés à la rangée de la titlebar, à côté des menus, et restent visibles pendant toute la navigation.
- La sélection de fichier et les modifications non enregistrées restent en cache mémoire lors d’une navigation entre pages ; l’onglet affiche un indicateur et ne peut pas être fermé avant enregistrement ou annulation.
- La page Fichiers utilise maintenant toute la hauteur disponible : l’arborescence et le code défilent dans leurs propres panneaux, y compris quand la fenêtre est maximisée.
- Le titre de page Fichiers est retiré pour libérer l’espace ; l’action Actualiser est intégrée à la barre d’outils de l’éditeur.
- Le langage du fichier et ses couleurs de syntaxe sont détectés selon l’extension, avec une couverture élargie des formats de configuration et de code courants.
- L’éditeur utilise Monaco, le moteur d’édition issu de VS Code, avec coloration, pliage de code, coloration des paires de crochets et workers dédiés aux langages pris en charge.
- L’arborescence et l’éditeur peuvent être redimensionnés et la largeur choisie reste mémorisée sur cet appareil.
- Les dépendances de Monaco et du redimensionnement sont incluses dans le lockfile afin que l’installation verrouillée de CI retrouve tous les modules.

## Vérification et livraison

- Vérifications locales : installation `pnpm install --frozen-lockfile --ignore-scripts`, TypeScript, ESLint, 68 tests Vitest, 14 tests du gestionnaire de runner et build Vite.
- Le premier workflow de release a été interrompu avant publication après un contrôle visuel ayant révélé une hauteur incorrecte du panneau éditeur. Le correctif et sa livraison sont suivis dans `release-v0.4.37.md`.
