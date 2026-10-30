# Sécurité

## Principes

- Aucun secret (jeton API, phrase de passe) n'est stocké en clair dans les fichiers de l'application ni dans le localStorage.
- Les jetons sont conservés dans le Windows Credential Manager via la crate `keyring`.
- Les clés privées SSH ne quittent jamais la machine et ne sont jamais envoyées aux panels.
- Toutes les communications HTTP vers les panels sont en HTTPS uniquement, sans redirection.
- La vérification des clés d'hôte SSH utilise `StrictHostKeyChecking=yes` (jamais désactivé).

## Protections

- Validation des URL de panels : schéma HTTPS, pas d'identifiants, pas de requête/fragment, pas d'hôte loopback/privé sauf autorisation explicite.
- Résolution DNS vérifiée pour rejeter les adresses privées (protection SSRF).
- Taille maximale des réponses HTTP (2 Mo).
- Timeouts de connexion (10 s) et de requête (20 s).
- Capacités Tauri limitées (`core:default`, `opener:default`).

## Journalisation

- Aucun secret n'est écrit dans les logs.
- Les erreurs sont renvoyées avec un code et un message générique côté client.

## Permissions fichier

- Les clés SSH sont lues/écrites dans `~/.ssh` (répertoire personnel de l'utilisateur).
- Les données applicatives sont stockées dans le répertoire de données de l'application.

## Signalement

Les vulnérabilités doivent être signalées de manière responsable à l'équipe HébergTonServ.
