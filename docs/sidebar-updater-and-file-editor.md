# HébergTonServ Desktop — navigation, mises à jour automatiques et fichiers

## Barre de titre

Les boutons de navigation se présentent dans l'ordre **Retour → Avancer → Afficher/masquer le sidebar → Fichier → Modifier → Affichage → Aide**. Le bouton sidebar reste fonctionnel en mode déployé et réduit. La commande « Affichage → Afficher / masquer la sidebar » reste disponible.

## Sidebar

Le logo statique en haut a été remplacé par un sélecteur d'espace de travail inspiré du bloc sidebar-07 : **HébergTonServ (Infrastructure)**, **SSH**, **Développement**. Les entrées naviguent réellement vers les sections correspondantes. La navigation principale conserve les sous-pages des trois sections ; le groupe redondant Application est supprimé. Paramètres et Sécurité restent accessibles depuis le menu utilisateur en bas du sidebar. Documentation y est également disponible.

## Mises à jour

Le plugin officiel Tauri Updater signe/vérifie les packages via le manifeste déjà configuré. Un état partagé entre le bouton de la barre de titre et la section Paramètres vérifie les mises à jour automatiquement :

- première vérification **12 secondes** après le montage de l'interface ;
- nouvelle vérification toutes les **60 minutes** pendant une session ouverte ;
- au retour au premier plan après une absence, uniquement si la dernière vérification date de plus de **15 minutes** ;
- aucun appel automatique lorsque la fenêtre est cachée ou que le navigateur indique qu'il est hors ligne ;
- le badge animé s'affiche uniquement lorsqu'une mise à jour plus récente est disponible ;
- le centre de notifications reçoit un événement par version disponible durant une session ;
- le téléchargement et l'installation exigent un clic explicite sur Installer.

Le badge inclut un anneau de notification discret, avec respect du mode « Réduire les animations ». Les erreurs silencieuses de vérification ne bloquent pas l'application. Les contrôles manuels conservent des messages de retour.

## Fichiers du serveur

L'arborescence utilisait un hook React après des retours conditionnels. Le hook s'exécute désormais à chaque rendu, y compris pendant l'état de chargement : le passage « chargement → liste » ne modifie plus l'ordre des hooks.

L'affichage de fichiers est remplacé par un éditeur compact inspiré de shadcn Code Editor : titre, langage, coloration légère, lignes, retour à la ligne configurable, copie et indentation Tab. Les modifications ne sont pas envoyées automatiquement.

Le bouton **Enregistrer** écrit sur le serveur via le provider Rust et la clé API utilisateur déjà configurée :

- **WISP** : POST JSON /api/client/servers/{identifier}/files/write avec `path` et `content`.
- **Pterodactyl** : POST text/plain /api/client/servers/{identifier}/files/write?file=..., avec lecture GET /files/contents retournant du texte brut.

Les chemins du serveur sont validés en Rust, les requêtes suivent les contrôles de résolution DNS/IP et n'envoient pas de secrets dans le WebView. Limite d'édition : **1 Mio** en UTF-8. Avant d'écraser un fichier, l'éditeur vérifie que son contenu distant est toujours égal au contenu initial ; sinon, il avertit l'utilisateur et n'écrase pas les changements externes.

## Sources

- https://v2.tauri.app/plugin/updater/
- https://www.shadcn.io/ui/code-editor
- https://gamepanel.notion.site/File-manager-7ee5543e2e1943b39550093fcc0022b3
- https://docs.pterodactyl.io/v2/api/client-api/clientWriteFileContents

## Points de validation

La CI doit passer Frontend/TypeScript/ESLint/Vitest/Vite, Rustfmt/Clippy/tests Rust. Un essai manuel du dropdown Fichiers et d'une sauvegarde sur un **serveur de test** est recommandé avant utilisation sur les configurations de production, car les permissions des panels peuvent varier.
