# HébergTonServ Desktop v0.4.4

## Serveurs Wisp et Pterodactyl

- Normalise les données de ressources des deux fournisseurs : les formats status/proc/query de Wisp et attributes.current_state/resources de Pterodactyl restent distincts.
- Lit les états, CPU, RAM, stockage, trafic réseau et compteurs de joueurs lorsqu'ils sont fournis par la Client API.
- Prend en charge plusieurs variantes de statistiques de joueurs, y compris les champs imbriqués de jeux.
- Utilise GET /api/client pour la liste Pterodactyl 1.x et GET /api/client/servers pour Wisp, avec pagination et inclusions propres au fournisseur.
- Pour Pterodactyl 2.0, privilégie l'UUID complet pour interroger les ressources des serveurs.
- Ne transforme plus les réponses JSON non reconnues en faux états sans erreur, et distingue les états réellement observés des métriques inaccessibles.
- Affiche les mesures réseau et améliore la disposition sur les écrans larges.

## Interface

- Retire la dernière bordure verticale appliquée par la sidebar intégrée shadcn.
- Supprime l'interstice gauche inutile du panneau de travail et conserve son arrondi.

## Vérifications

- Contrats Rust de réponse Wisp et Pterodactyl avec données de test sans secrets.
- Vérifications GitHub Actions TypeScript, ESLint, tests, compilation Vite et Rust/Windows.

Les statistiques en direct nécessitent que la clé Client API ait réellement accès aux ressources des serveurs ; aucune donnée n'est inventée lorsqu'une requête est refusée.
