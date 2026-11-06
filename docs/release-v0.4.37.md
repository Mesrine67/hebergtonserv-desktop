# HébergTonServ Desktop v0.4.37

## Éditeur de fichiers

- Le panneau de l’éditeur remplit toute la hauteur disponible de l’explorateur de fichiers.
- Monaco et sa zone de code s’étendent avec le panneau redimensionnable, y compris quand la fenêtre est maximisée.
- L’arborescence conserve son propre défilement et son séparateur reste redimensionnable.

## Vérification et livraison

- TypeScript et 68 tests Vitest passent après le correctif.
- Le workflow GitHub Actions est chargé de produire et publier les installateurs Windows signés NSIS/MSI après le tag `v0.4.37`.
