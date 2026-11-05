# Serveurs : vrais thumbnails WISP et cartes compactes

## Pourquoi v0.4.28 ne ressemble pas à WISP

- La première version créait un pictogramme agrandi et un header trop haut, sans récupérer la bannière de l'egg.
- Les badges et le menu se partageaient une colonne trop étroite et les quatre métriques occupaient des cadres redondants.
- WISP stocke un thumbnail par egg : Admin Panel / Service Management / Nests / Egg / Thumbnail.
  Source : https://gamepanel.notion.site/Thumbnails-132923894b2542f3a162f073f9428b04

## Correctif

- Header compact, texte à gauche, statut et egg à droite, un seul menu Actions.
- Métriques CPU, mémoire, disque, joueurs et réseau toujours accessibles, sans énormes cases.
- Bandeau de fond si l'API renvoie un lien de thumbnail explicite ; sinon fond neutre et petite icône.
- Extraction dans le modèle Rust des propriétés thumbnail_url, thumbnail, banner et de leurs relations. Les propriétés image et docker_image ne servent jamais de bannière.
- La liste des serveurs WISP inclut déjà allocations,node,egg dans la branche principale et conserve une requête de repli lorsqu'une option est refusée.
- Commande Rust dédiée : téléchargements HTTPS uniquement, DNS/IP validés, pas de redirections, taille limitée à 768 Kio, MIME image vérifié ; le token ne peut pas être transmis à un domaine externe.
- React Query mutualise les requêtes par panel et URL, et les images sont décoratives.

## Limites

La documentation WISP confirme le thumbnail dans son interface mais ne documente pas exhaustivement les champs du thumbnail dans chaque version de son API. Si l'API n'envoie pas de lien explicite, une card reste neutre : aucun endpoint administrateur n'est deviné et aucun token admin n'est partagé.

Autres références :
- https://gamepanel.notion.site/Servers-2ec8bc84533d44db86d7cdae037c7d7a
- https://github.com/pterodactyl/panel
- https://github.com/pterodactyl/yolks
