# HÃ©bergTonServ Desktop v0.1.7

## Ã‰cran dâ€™accueil
- Ã‰criture dâ€™introduction lÃ©gÃ¨rement ralentie pour Ãªtre lisible et fluide.
- Fin de lâ€™animation : lâ€™application ne bascule plus automatiquement au tableau de bord.
- Nouveau bouton **DÃ©marrer** : le passage Ã  lâ€™application exige une action explicite.
- Â« Passer lâ€™introduction Â» et la touche Ã‰chap rÃ©vÃ¨lent uniquement le bouton DÃ©marrer.
- Indicateur discret de progression de lâ€™introduction et message de disponibilitÃ©.
- AccessibilitÃ© : focus du bouton DÃ©marrer aprÃ¨s lâ€™animation et prise en charge des prÃ©fÃ©rences de rÃ©duction des animations.

## GitHub
- Ancien brouillon v0.1.3 supprimÃ© de GitHub Releases, tag Git v0.1.3 conservÃ©.
- Mise Ã  jour signÃ©e de v0.1.7 : NSIS, MSI, signatures et latest.json, sous rÃ©serve des vÃ©rifications de release.

## VÃ©rifications
- Tests React pour absence de navigation automatique, saut dâ€™animation, touche Ã‰chap et animations rÃ©duites.
- TypeScript, lint, tests, build Vite, tests runner et vÃ©rifications Rust/GitHub avant publication.
## Integrite et provenance
- Standalone Windows experimental : executable non installe, avec runtime Microsoft WebView2 requis.
- SHA256SUMS.txt verifie les sept fichiers primaires.
- Attestation GitHub des fichiers binaires, en plus des signatures Tauri updater.
