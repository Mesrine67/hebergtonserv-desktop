# HébergTonServ Desktop v0.4.5

## Fenêtre et navigation

- Ancre le titre de la fenêtre à une position constante, indépendante de l'ouverture ou du repli de la barre latérale. Seule la colonne de navigation change de largeur.
- Conserve les contrôles de fenêtre, le bouton de mise à jour et le basculement clair/sombre dans la barre native Tauri.

## Style shadcn/ui Mira

- Conserve le préréglage radix-mira du dépôt et harmonise les menus de navigation réduite avec le menu utilisateur.
- Partage une surface de popover compacte, les espacements, rayons, séparateurs, ombres et états actifs du thème.
- Utilise les variables sémantiques popover, accent, border et muted-foreground, pour que les menus suivent automatiquement les palettes sombre et claire.
- Harmonise l'arrondi de base pour les contrôles, cartes et menus sans réinitialiser les composants personnalisés shadcn.
- Désactive les animations de menu lorsque l'utilisateur demande une réduction des mouvements.

## Validation

- Vérifications frontend TypeScript, ESLint, tests et build Vite sur GitHub Actions.
- Vérifications Rust/Windows sur le runner auto-hébergé.
- Publication des installateurs Windows signés et du manifeste de mise à jour après réussite des contrôles.
