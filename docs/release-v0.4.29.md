# HébergTonServ Desktop v0.4.29

## Correctif des cartes serveurs WISP/Pterodactyl

- Les cartes de la version précédente étaient trop hautes et utilisaient de gigantesques pictogrammes décoratifs : les watermarks surdimensionnés sont supprimés.
- Header et statistiques nettement plus compacts : le nom, l'adresse, l'identifiant et les métriques restent lisibles sans les anciens grands cadres.
- Statut (en ligne, arrêté, suspendu) et type d'egg regroupés à droite, avec un seul menu Actions : console, fichiers, bases de données et sous-utilisateurs.

## Thumbnails des eggs

- Quand le panel renvoie une URL de thumbnail ou de bannière d'egg dans ses métadonnées client, l'application affiche désormais cette image en arrière-plan de la carte.
- Prise en charge des enveloppes d'API WISP/Pterodactyl, notamment les relations d'egg imbriquées dans relationships.egg.data.attributes.
- Téléchargement des images en Rust avec vérifications HTTPS/DNS, limite de 768 Kio, formats images sûrs et aucune clé API transmise à un CDN tiers.
- En l'absence de thumbnail fourni par l'API, la carte conserve un fond neutre avec une petite icône de service. Les images Docker ne sont pas utilisées comme bannières.

**Important :** WISP documente les thumbnails des eggs dans son interface d'administration, mais la disponibilité de leurs URLs dans l'API client dépend de la version du panel. L'affichage réel de chaque bannière n'est pas garanti si cette métadonnée manque.

## Vérifications

- 19 tests Frontend ciblés, typage TypeScript, ESLint et build Vite réussis.
- 63 tests Rust locaux réussis ; CI Frontend et Rust/Tauri de la PR #107 verte.
- Signatures et configuration des mises à jour Tauri inchangées.

Correctif : https://github.com/Mesrine67/hebergtonserv-desktop/pull/107
Comparaison : https://github.com/Mesrine67/hebergtonserv-desktop/compare/v0.4.28...v0.4.29
