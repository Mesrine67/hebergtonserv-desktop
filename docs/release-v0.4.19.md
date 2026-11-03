# HébergTonServ Desktop v0.4.19

## Panels WISP et Pterodactyl
- Liste les sous-utilisateurs des serveurs avec les permissions, pagination WISP et identifiants compatibles Pterodactyl v1/v2.
- Garde l’affichage des sous-utilisateurs replié par serveur pour préserver la lisibilité.

## Git et GitHub
- Consulte explicitement les pull requests et issues du dépôt GitHub choisi, via la session `gh` existante.
- Cible le dépôt GitHub.com et le compte `gh` actif sans lire ni afficher les jetons.
- Ignore les réponses obsolètes après un changement de dépôt et affiche les pull requests même si les issues sont désactivées.

## Compatibilité
- Améliore le retour d’erreur des dépôts sans Issues activées.
- N’ajoute pas d’opérations Git distantes ni de connexion par mot de passe panel; ces fonctions restent suivies dans leurs issues dédiées.
