# HébergTonServ Desktop v0.4.12 — Serveurs, diagnostics et styles shadcn

## Serveurs
- Suppression du grand en-tête vide en haut de l'écran Serveurs.
- Titre, panel, recherche, bouton Actualiser et entrée Journal API réunis dans la carte de gestion.
- Suppression du deuxième logo dans la titlebar. L'icône Maison de la sidebar reste disponible et liée à Accueil.
- Les métriques sont récupérées par lots de quatre requêtes maximum, sur les 12 serveurs de la page courante, au lieu d'une rafale simultanée.
- Un état API indisponible est distingué d'un état de serveur arrêté ou inconnu.
- Reconnaissance plus robuste des états WISP 0/1 sous forme texte et des états Pterodactyl.
- Sélection d'identifiant adaptée : WISP / Pterodactyl v1 utilisent l'identifiant court ; Pterodactyl 2.x utilise l'UUID complet. La documentation API confirme cette distinction.
- Les échecs partiels d'un lot ne masquent plus les métriques valides des autres serveurs.

## Journal API
- Journal en mémoire, borné à 300 entrées, sans écriture automatique sur disque.
- Historique des requêtes serveurs et de leurs erreurs codifiées, sans enregistrement de jetons, URL, adresses, noms de serveurs ni réponses brutes.
- Panneau flottant avec Actualiser, Copier, Enregistrer en .txt/.log et Vider.
- Export explicite via le sélecteur de fichiers Tauri, avec permissions de dialogue et presse-papiers limitées aux actions nécessaires.
- Ce journal est volontairement différent des logs exhaustifs de l'infrastructure ; il facilite le dépannage sans divulguer les accès privés.

## Styles
- Les variations à chaud de Vega, Nova, Maia, Lyra, Mira, Luma, Sera et Rhea couvrent désormais contrôles, champs, cartes, rayon, densité et typographie.
- Ajout de Gray aux couleurs de base, en accord avec la liste officielle du registre.
- Les composants existants restent installés en radix-mira : le changement de style à chaud est une adaptation de design tokens et recettes CSS, pas une régénération du code shadcn CLI, qui nécessiterait des variantes structurelles distinctes.
- Références : https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/styles et https://ui.shadcn.com/docs/installation

## Vérifications
- TypeScript, ESLint et build Vite.
- 24 tests frontend, dont les nouveaux tests d'états serveurs et de journal.
- 38 tests Rust et Clippy.
- CI Windows / publication signée requises avant la diffusion de cette version.

## Limites
- L'API du panel HébergTonServ privé n'a pas été interrogée pendant ces tests ; les résultats réels dépendent des droits de la clé Client API et de la version du panel.
- Une erreur 401, 403, 404, 429 ou réseau peut désormais être diagnostiquée dans le journal sans enregistrer de donnée sensible.
