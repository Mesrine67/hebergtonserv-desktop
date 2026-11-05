# HébergTonServ Desktop v0.4.31

## Navigation et espaces de travail

- **Bouton Retour** : marge de 10 px au bord gauche de la barre de titre. Les boutons conservent l'ordre Retour → Avancer → Afficher/masquer la sidebar → Fichier.
- **Sidebar contextuelle** : seules les sous-pages de l'espace de travail actif sont maintenant visibles :
  - Infrastructure : Panels, Compte du panel, Serveurs.
  - SSH : Clés SSH, Configuration, Profils.
  - Développement : Git / GH.
- **Changement d'espace et historique** : la navigation se réorganise lorsque l'on choisit un autre espace ou utilise Retour/Avancer ; les groupes SSH et Développement ne polluent plus l'espace Infrastructure.
- **Menu des espaces** : le sélecteur affiche son panneau flottant à droite, avec 10 px d'écart sur Windows, comme shadcn sidebar-07. Sur mobile, il s'ouvre sous le sélecteur et reste contraint par la fenêtre.

## Périmètre et qualité

- Mise à jour ciblée de la navigation ; aucun changement des clés d'API, de la gestion des serveurs ou de l'éditeur de fichiers de v0.4.30.
- Nouveaux tests de filtrage pour les trois espaces et de placement du menu.
- Référence PR : https://github.com/Mesrine67/hebergtonserv-desktop/pull/111
- Comparaison des releases : https://github.com/Mesrine67/hebergtonserv-desktop/compare/v0.4.30...v0.4.31

Les mises à jour Tauri continuent d'être recherchées automatiquement, mais leur installation nécessite une confirmation explicite.
