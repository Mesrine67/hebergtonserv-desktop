# HébergTonServ Desktop — correctifs de navigation après v0.4.30

## Changements

- Ajout de pl-2.5 (10px) au conteneur de navigation de la titlebar pour éviter que Retour soit collé au bord gauche de la fenêtre. Le groupe conserve son ordre Retour → Avancer → Sidebar → Fichier.
- AppSidebar utilise maintenant sidebarSectionsForPath(pathname) : l'espace Infrastructure n'affiche que Panels, Compte du panel et Serveurs ; l'espace SSH n'affiche que Clés SSH, Configuration et Profils ; l'espace Développement n'affiche que Git / GH. Cette sélection suit également les boutons Retour/Avancer.
- Le menu des espaces apparaît à droite du sélecteur sur bureau (décalage de 10px), comme dans l'exemple shadcn sidebar-07. Sur mobile il reste sous le sélecteur, dans la zone visible.
- Les pages transversales Accueil, Paramètres et Documentation restent associées à Infrastructure en l'absence d'un espace explicitement porté par leur route.

## Vérification

Les tests workspace-switcher.test.ts couvrent la sélection des sections et la position du menu, y compris les routes Serveurs/Fichiers, SSH et Git. Compléter par la validation TypeScript, ESLint, Vitest et build Vite.

Référence UI : https://ui.shadcn.com/blocks#sidebar-07
