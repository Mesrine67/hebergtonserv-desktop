# HébergTonServ Desktop v0.4.3

## Finitions du cadre Windows et de la navigation

- Retire les séparateurs entre l’en-tête, la navigation et le pied de la sidebar plutôt que de les masquer dans la feuille de style.
- Élimine le contour et l’ombre superflus du panneau principal pour un ensemble plus homogène.
- Masque les barres de défilement dans toutes les pages et les menus tout en conservant le défilement à la souris, au pavé tactile et au clavier.
- Décale légèrement le bouton du profil local et son menu déroulant vers la droite, sans perturber le mode navigation réduite.
- Déplace la commande de mise à jour à gauche du changement de thème dans la barre supérieure, tout en conservant la recherche et l’installation signée avec confirmation.
- Retire le séparateur avant les commandes de fenêtre et harmonise l’en-tête avec le cadre.

## Compatibilité

- Pas de migration des fichiers de données ni des clés de connexion.
- Compatibilité Tauri 2, thèmes sombre et clair, Windows Snap, écrans de connexion et pages d’administration.
- Version alignée dans Tauri, Rust et le package frontend.

## Installation

Utiliser en priorité l’installateur NSIS signé (`x64-setup.exe`) ou le système de mise à jour intégré.
Le MSI, les signatures, `latest.json`, le gestionnaire du runner et les sommes SHA-256 figurent dans la release.
