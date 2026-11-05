# HébergTonServ Desktop v0.4.27

## Démarrage et interface

- L'animation manuscrite « HébergTonServ » commence **500 ms après la confirmation de l'affichage de la fenêtre Tauri**, au lieu de démarrer alors que WebView2 peut encore être masqué.
- Le contenu de l'écran de bienvenue reste centré lorsque le bouton **Démarrer** et son texte d'aide apparaissent : leur espace est réservé dès le premier rendu.
- Le contour décoratif encadrant l'écran de bienvenue a été supprimé pour une présentation plus épurée.

## Fiabilité et compatibilité

- L'animation reste en pause jusqu'au signal d'ouverture ; un repli empêche qu'une erreur de confirmation native bloque indéfiniment l'accueil.
- Le comportement d'accessibilité **Réduire les animations** est conservé.
- Correctif livré par la PR #103, validé par huit tests de l'introduction, TypeScript, ESLint et le build web.

## Installation et mises à jour

- Version corrective destinée à Windows x64.
- Installateurs **NSIS (.exe)** et **MSI**, plus les fichiers signés de mise à jour Tauri, générés et publiés par le workflow Release après vérification.
- Une fois la release publiée, la mise à jour intégrée peut utiliser le manifeste **latest.json** de GitHub Releases.

**Comparaison :** https://github.com/Mesrine67/hebergtonserv-desktop/compare/v0.4.26...v0.4.27
