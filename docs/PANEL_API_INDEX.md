# HébergTonServ Desktop — Index des API de panels

Mise à jour : 2026-11-02. Cet index distingue **la version du logiciel Panel** de **la version du contrat HTTP/API**. Il ne prétend pas que tous les endpoints répertoriés sont implémentés.

## Contrats et en-têtes utilisés

| Fournisseur | Sélection dans l'app | `Accept` | Niveau de preuve |
| --- | --- | --- | --- |
| WISP | « API v1 » (par défaut) | `application/vnd.wisp.v1+json` | Documenté dans WISP Client API |
| WISP | « API v2 » (option manuelle) | `application/vnd.wisp.v2+json` | **Expérimental / non confirmé par la documentation fournie** |
| Pterodactyl | « Auto / 1.x » (historique) | `application/vnd.pterodactyl.v1+json` | Compatibilité héritée de l'app |
| Pterodactyl | « 2.x » (option explicite) | `application/json` | Documenté dans Pterodactyl API 2.0 |

Les requêtes du client Rust ont les en-têtes `Authorization: Bearer <jeton>`, `User-Agent: HebergTonServ-Desktop/<version>`, `Content-Type: application/json` et `Accept` selon le contrat choisi. Le cookie d'exemple WISP des documentations **n'est pas un mécanisme d'authentification de l'application** : seuls les jetons Client API sont employés, et ils restent dans Windows Credential Manager.

La présence de **WISP Panel v2.10.x** dans un changelog ne prouve **pas** qu'un contrat `vnd.wisp.v2+json` existe. Ne pas activer cette option automatiquement. Elle doit être testée sur une instance dont la compatibilité est confirmée, sans exposer de jetons ni de cookies. Pterodactyl API 2.0 conserve le préfixe `/api/client` : **v2 n'est pas un segment de route**.

## Couverture actuelle dans le code

| Fonction | WISP | Pterodactyl 1.x / 2.x | Code |
| --- | --- | --- | --- |
| Connexion par jeton, compte | Présent via `/api/client/auth/@me` | Présent via `/api/client/account` | `providers/http.rs`, `commands/panels.rs` |
| Liste des serveurs avec pagination | Présent | Présent | `providers/http.rs` |
| Statistiques des serveurs | Présent | Présent | `providers/http.rs` |
| Liste des clés API | Présent si endpoint exposé | Présent | `providers/wisp.rs`, `providers/pterodactyl.rs` |
| Créer / révoquer clé API | Non activé (contrat non vérifié) | Présent | `providers/*.rs` |
| Liste des clés SSH | Selon prise en charge du panel | Présent si endpoint exposé | `providers/*.rs` |
| Créer / supprimer clés SSH | Non activé (contrat non vérifié) | Présent si endpoint exposé | `providers/*.rs` |
| Console interactive, commandes, websocket | Pas dans la couche API partagée auditée | Pas dans la couche API partagée auditée | À implémenter séparément |
| Fichiers, sauvegardes, bases, tâches, subusers, allocations | Non implémenté dans `PanelProvider` | Non implémenté dans `PanelProvider` | À traiter par capacités incrémentales |
| Opérations Admin / Application | Non implémenté | Non implémenté | Ne pas mélanger les droits Client / Admin |

Les méthodes de test réseau appellent les endpoints réels **uniquement** quand l'utilisateur vérifie un panel configuré ; les tests unitaires utilisent des valeurs fictives et n'utilisent pas d'identifiants.

## Documentation WISP — index des domaines

Racine : [API Client WISP](https://gamepanel.notion.site/Client-API-b76f787c2cbb4970b8dcca7f20104a15). La documentation Client indique la pagination `page`, `per_page` (maximum annoncé : 25), le Bearer, les types JSON et le User-Agent.

| Domaine | Référence | Statut d'intégration |
| --- | --- | --- |
| Compte / clés API | [Account](https://gamepanel.notion.site/Account-79d8bd9c92884be4ab6faeff86660881) | Partiel |
| Liste serveurs / ressources / alimentation | [Servers](https://gamepanel.notion.site/Servers-2ec8bc84533d44db86d7cdae037c7d7a) | Liste et ressources |
| Monitoring / mise à jour / réinstallation | [Advanced](https://gamepanel.notion.site/Advanced-4db1ce99142e47b2bcafdaf19365c6f9) | À faire |
| Connexion | [Authentication](https://gamepanel.notion.site/Authentication-6a851a0788294a64b336164f3ac25054) | Bearer sans cookies |
| Admin | [Admin API](https://gamepanel.notion.site/Admin-API-8485ff969253496592ee0f289e9f525c) | À faire ; la page publique est un stub |
| Allocations / Audit Logs | [WISP Client API](https://gamepanel.notion.site/Client-API-b76f787c2cbb4970b8dcca7f20104a15) | À faire |
| Backups / Databases / Database Host | [WISP Client API](https://gamepanel.notion.site/Client-API-b76f787c2cbb4970b8dcca7f20104a15) | À faire |
| FastDL / File manager | [WISP Client API](https://gamepanel.notion.site/Client-API-b76f787c2cbb4970b8dcca7f20104a15) | À faire |
| Modpacks / Mods | [WISP Client API](https://gamepanel.notion.site/Client-API-b76f787c2cbb4970b8dcca7f20104a15) | À faire |
| Schedules / Scheduled tasks / Startup | [WISP Client API](https://gamepanel.notion.site/Client-API-b76f787c2cbb4970b8dcca7f20104a15) | À faire |
| Subusers / Error codes | [WISP Client API](https://gamepanel.notion.site/Client-API-b76f787c2cbb4970b8dcca7f20104a15) | À faire |
| Évolutions produit | [WISP Changelog](https://gamepanel.notion.site/WISP-Changelog-201ec094c23d8019a02bef6a5ba872a2) | Version du produit, pas version MIME |
| IP WISP / infra | [WISP IP's](https://gamepanel.notion.site/WISP-IP-s-0ad3628fb72d43029639d8caad7dea8d), [ips.txt](https://wisp.gg/ips.txt) | Référence réseau ; ne pas en déduire automatiquement une allowlist |

Ne pas réutiliser l'exemple `wisp_session` figurant dans certaines anciennes pages : il ne constitue pas un credential pour l'application.

## Documentation Pterodactyl — index

- [Version 2 / API Overview](https://docs.pterodactyl.io/v2/api), [liste Client API](https://docs.pterodactyl.io/v2/api/client-api/clientListClientServers), [compte](https://docs.pterodactyl.io/v2/api/client-api/clientGetAccount), [ressources](https://docs.pterodactyl.io/v2/api/client-api/clientGetServerResources), [websocket](https://docs.pterodactyl.io/v2/api/client-api/clientGetWebsocketCredentials).
- [API v1](https://docs.pterodactyl.io/v1/api) pour les panels 1.x et compatibilité historique.
- [Authentification v2](https://docs.pterodactyl.io/v2/api/authentication/authLogin) : flux de session **distinct** de la clé Bearer Client ; pas utilisé par l'app.
- [Clés API Client](https://docs.pterodactyl.io/v2/api/client-api/clientListAccountAPIKeys), [création](https://docs.pterodactyl.io/v2/api/client-api/clientCreateAccountAPIKey), [permissions](https://docs.pterodactyl.io/v2/api/client-api/clientListServerPermissions).
- [Source de la documentation](https://github.com/pterodactyl/documentation) et [LLMS](https://docs.pterodactyl.io/llms.txt), [LLMS complet](https://docs.pterodactyl.io/llms-full.txt).

Pterodactyl 2.x possède des API Client, Application et Admin avec **des permissions différentes**. La configuration actuelle n'emploie qu'un jeton **Client**. Ne pas tester des opérations administratives avec des secrets Client, ni réutiliser des cookies de session.

## Étapes d'implémentation suivantes

1. Établir un tableau **endpoint / méthode / schéma / permission / fournisseur / version** pour chaque domaine avant de coder (aucun copier-coller aveugle entre WISP et Pterodactyl).
2. Ajouter une détection **non destructive** des capacités après validation d'un jeton, sans tenter automatiquement de mutations ni rejouer les échecs 401/403.
3. Introduire des services spécialisés par domaine pour les fichiers, sauvegardes, bases, tâches et power, chacun avec tests de réponses HTTP v1/v2 fictives.
4. Vérifier l'interface WISP v2 sur une vraie instance autorisée **seulement après confirmation de son contrat officiel** ; conserver WISP API v1 par défaut.
5. Mettre à jour le répertoire de docs à chaque évolution, et conserver les secrets hors des logs, des rapports et des tests.
