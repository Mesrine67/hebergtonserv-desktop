# HébergTonServ Desktop v0.4.10 — Desktop shell Mira

## Titlebar
- Retire le texte de titre et le libellé de page de la titlebar ; conserve le logo.
- Ajoute le **Menubar officiel shadcn** : Fichier, Modifier, Affichage et Aide.
- Actions fonctionnelles : accès aux pages existantes, retour/avancer, afficher/masquer la sidebar, mode clair/sombre, assistance et vérification des mises à jour.
- Ajoute deux boutons Retour/Avancer et le raccourci Alt + flèches avec état désactivé si aucun historique.

## Sidebar
- Remplace l'ancien logo de l'en-tête de navigation par une icône maison.
- Supprime la double sélection visuelle : parent ouvert neutre, seul lien enfant actif mis en valeur.
- Ajoute Développement → Git / GH, avec page préparatoire clairement non connectée et sans exécution Git/GH.

## Notifications
- Cloche immédiatement à gauche de Discussion, avec indicateur de notifications non lues.
- Panneau flottant Mira, historique local, horodatage, marquer comme lu, tout marquer comme lu et effacer.
- Les vérifications de mises à jour réussies remontent de véritables événements dans le centre.
- Pas de notification fictive ni transmission distante de l'historique.

## Motion
- Animation d'apparition de l'interface frameless au premier chargement (~560 ms).
- Transitions adoucies entre pages, sidebar et menus, et prise en charge de prefers-reduced-motion.
- Pas de remplacement risqué de la fenêtre Tauri native : l'effet est appliqué à l'interface et sa titlebar custom.

## Validation
- TypeScript et ESLint.
- 19 tests Vitest (dont historique et notifications).
- Build Vite production.
- Build et packaging Windows par les runners GitHub avant publication de la release signée.

La version 0.4.10 est synchronisée dans package.json, Cargo.toml, Cargo.lock et tauri.conf.json.
