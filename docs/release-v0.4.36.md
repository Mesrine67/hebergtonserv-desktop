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
- Le langage et les couleurs de syntaxe sont détectés selon l’extension, avec prise en charge étendue des formats de configuration et de code usuels.

## Vérification et livraison

- Vérifications locales : `pnpm check` et validation native du placement des onglets dans la titlebar.
- Validation native des interactions à effectuer dans le workflow Tauri avant la publication de `v0.4.36`.
