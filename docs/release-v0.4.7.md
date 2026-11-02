# HébergTonServ Desktop v0.4.7

## Accueil et animation

- Bouton Démarrer revisité dans l'identité shadcn Mira : piste élargie, flèche qui se glisse ou se clique, micro-animation de validation et léger effet de recul (« sling »).
- Le bouton reste utilisable au clavier, au clic et au pointeur ; aucun glissement obligatoire.
- La transition prépare l'écran de connexion ou le dashboard en arrière-plan avant de retirer la totalité de l'accueil, y compris sa titlebar.
- Trois transitions au choix : **Flottement**, **Rideau** et **Halo**, avec réduction des mouvements respectée.
- Couleur de la titlebar harmonisée avec la surface de bienvenue ; conservation de l'écriture manuscrite HébergTonServ et du bouton Passer l'introduction.

## Style et thèmes

- Nouvelle section **Style & thèmes** dans Paramètres.
- Cinq palettes : **Mira original**, **Océan**, **Jade**, **Prune** et **Sable**.
- Mode **Système / Clair / Sombre** dans les paramètres ; les presets utilisent les variables CSS sémantiques shadcn et s'appliquent à l'ensemble des écrans.
- Préférences de palette et de transition sauvegardées localement, avec retour au preset Mira en cas de valeur invalide.

## Tests et livraison

- Tests frontend de l'introduction et de la persistance des thèmes, analyse TypeScript, ESLint et build Vite.
- Vérification Rust/Windows et installateurs signés assurés par GitHub Actions avant la publication automatique.
- Numérotation synchronisée dans package.json, Tauri et Cargo ; aucune dépendance d'animation supplémentaire.
