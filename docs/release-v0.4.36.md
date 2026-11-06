# HébergTonServ Desktop v0.4.36

## Fiabilité des panneaux flottants

- Une interaction avec la page située sous un panneau n’entraîne plus sa fermeture implicite ; les contrôles de la page restent utilisables.
- Les panneaux peuvent être refermés puis rouverts sans perdre leur déclencheur.
- Paramètres et Sécurité s’ouvrent depuis les menus utilisateur et Accueil au moyen du même hôte de panneaux que Journal et Raccourcis.
- Nouveautés et changelog est géré par le même hôte et son événement d’ouverture reste réutilisable après fermeture.
- Les liens obsolètes vers les pages Paramètres et Sécurité sont remplacés par les actions qui ouvrent leurs panneaux.
- Les onglets d’explorateurs de fichiers sont intégrés à la rangée de la titlebar, à côté des menus.
- La sélection de fichier et les modifications non enregistrées restent en cache mémoire lors d’une navigation entre pages ; l’onglet affiche un indicateur et ne peut pas être fermé avant enregistrement ou annulation.

## Vérification et livraison

- Vérifications locales : `pnpm check` et validation native du placement des onglets dans la titlebar.
- Validation native des interactions à effectuer dans le workflow Tauri avant la publication de `v0.4.36`.
