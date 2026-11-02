# HébergTonServ Desktop v0.4.11 — Centre d'aide, thèmes et outils Windows

## Navigation et titlebar
- Boutons Windows Réduire / Agrandir / Fermer visuellement alignés sur les autres actions et sur les tokens shadcn.
- Icône Maison de la sidebar reliée à **/home**, une vraie page d'accueil avec accès rapide à SSH, Panels, Git/GH et paramètres.
- Menu Aide : documentation **interne** (/documentation), Nouveautés / Changelog sous forme de panneau flottant, raccourcis clavier (Ctrl + /), gestionnaire des tâches et vérification des mises à jour.
- Animation de fermeture douce sur le bouton Fermer et sur l'option du menu Fichier, compatible avec le réglage existant « fermer dans la zone de notification ». Le raccourci Alt+F4 reste géré nativement par Tauri.

## Documentation et releases
- Documentation locale consultable sans compte, avec filtre, sources officielles et consignes de sécurité SSH.
- Panneau Nouveautés listant les releases publiques via une commande Rust sur l'API GitHub avec User-Agent, contrôle de domaine, délai réseau et repli local hors ligne.
- Aucun cookie du panel Web n'a été lu ou récupéré pour réaliser la charte graphique.

## Gestionnaire des tâches
- Nouvelle fenêtre Tauri indépendante et frameless, liée aux mêmes thèmes.
- Liste des processus Windows, nom, PID, mémoire, recherche, rafraîchissement toutes les 8 secondes.
- **Lecture seule** : aucune commande d'arrêt de processus arbitraire, ni tentative de contrôle de processus système.

## Styles shadcn et branding
- Choix d'adaptations locales Vega, Nova, Maia, Lyra, Mira, Luma, Sera, Rhea et HébergTonServ.
- Couleurs de base Neutral, Stone, Zinc, Mauve, Olive, Mist et Taupe.
- Palette d'accent original + Neutral, Amber, Blue, Cyan, Emerald, Fuchsia, Green, Indigo, Lime, Orange, Pink, Purple, Red, Rose, Sky, Teal, Violet et Yellow.
- Palette HébergTonServ spécifique et conservation des palettes originales Mira/Océan/Jade/Prune/Sable.
- Les styles sont des variations dynamiques des composants Radix déjà installés. Ils ne remplacent pas à chaud les fichiers des registres shadcn officiels.
- Préférences persistantes, prise en charge clair/sombre et prefers-reduced-motion.

## Contrôles
- TypeScript, ESLint, 21 tests frontend et Vite build local.
- Vérifications Rust, packaging et signature Windows via GitHub Actions avant publication.
- Version synchronisée dans package.json, Cargo.toml, Cargo.lock et tauri.conf.json.

## Documents et suivi
- Documentation sources : https://ui.shadcn.com/docs/theming, https://ui.shadcn.com/create
- Notes Windows Tauri : https://v2.tauri.app/reference/javascript/api/namespacewindow/
- GitHub : https://github.com/Mesrine67/hebergtonserv-desktop
