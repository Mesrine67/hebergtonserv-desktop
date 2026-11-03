# HébergTonServ Desktop v0.4.21

## Journal API détaillé
- Le journal volatile affiche la méthode, le statut HTTP, le type de contenu, la durée et la structure JSON des réponses API.
- Masque les secrets, identifiants, noms, chemins, adresses et chaînes libres avant conservation/export ; limite la réponse enregistrée à 12 Kio.
- Inclut ces détails expurgés dans la copie et l’export pour diagnostic.

## Git / GitHub
- Ajoute les opérations fetch, pull rapide et push sur le dépôt explicitement sélectionné, après confirmation.
- Refuse le pull sur un dépôt modifié ou l’envoi quand origin contient des commits absents ; aucun force push.
- Teste fetch, fast-forward pull et push avec un dépôt distant temporaire.

## État des issues
- #69 : l’index décrit avec précision la lecture des fichiers et bases intégrée ; sauvegardes, tâches et allocations restent à faire.
- #71 : ajoute les mutations Git sûres ; OAuth, annulation interactive et contrôles plus avancés restent hors de cette tranche.
- #88 : aucun faux formulaire de mot de passe ajouté ; la session panel reste non implémentée tant que les flux API et WebSocket ne sont pas validés.

La publication publique reste conditionnée à la CI Windows, à la signature et à la vérification des huit assets attendus.
