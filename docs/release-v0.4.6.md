# HébergTonServ Desktop v0.4.6

## Nouvel écran d'accueil — Hello Effect manuscrit

- Remplace l'ancien fondu du nom par 17 tracés SVG originaux pour écrire HébergTonServ, avec accent dédié pour le é.
- Anime les traits de gauche à droite selon une chronologie indépendante de la fréquence d'affichage, sur environ 3,25 secondes.
- Respecte le thème shadcn Mira grâce aux couleurs sémantiques et conserve les palettes claires et sombres.
- Affiche le bouton Démarrer après le dernier trait, sans lancer le tableau de bord automatiquement.
- Ajoute une transition de sortie douce de 240 ms et conserve Passer l'introduction.
- Rend le lettrage statique immédiatement lorsque le système demande une réduction des animations.
- Sécurise le cas d'absence de l'événement animationend dans WebView2 avec une fin de secours.
- Évite les dépendances d'animation et les fichiers de polices externes, le lettrage étant dessiné en SVG natif.

## Contrôles

- 7 tests frontend validés, incluant le SVG, la séquence temporelle, l'introduction et l'accessibilité.
- TypeScript, ESLint et build Vite validés localement.
- CI GitHub frontend et Rust/Windows requises avant fusion et release.
