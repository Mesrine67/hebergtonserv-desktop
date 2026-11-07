# HébergTonServ Desktop v0.4.39

## Correctif de sécurité de l'éditeur de fichiers

- L'éditeur Monaco utilise désormais DOMPurify 3.4.17 à la place de la version 3.4.15 signalée par les alertes de sécurité.
- Le correctif ne se limite pas au fichier de verrouillage PNPM : un patch reproductible remplace également la copie intégrée de DOMPurify dans le module ESM de Monaco.
- La mise à jour cible les cinq alertes Dependabot relatives à cette dépendance, dont une critique et une élevée.

## Qualité et tests

- Les tests des panneaux flottants et de l'arborescence des fichiers n'émettent plus les anciens avertissements React `act(...)`.
- Les 68 tests Vitest, le contrôle TypeScript, ESLint et le build Vite ont réussi avant la préparation de la release.

## Distribution

- Les installateurs Windows et les fichiers de mise à jour signés sont produits et vérifiés par le workflow de release existant.
- Cette version vise la sécurité et la stabilité. Les nouvelles fonctions de l'interface restent celles introduites dans v0.4.38.
