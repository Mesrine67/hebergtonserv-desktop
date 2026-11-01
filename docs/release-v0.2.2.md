# HébergTonServ Desktop v0.2.2

- Corrige l'identification du compte avec les formats WISP et Pterodactyl Client API v2.
- Essaie automatiquement `GET /api/client/account` si l'API WISP ne fournit pas un compte exploitable ou si sa route est absente/indisponible.
- Enregistre le fournisseur détecté pour router les prochaines opérations vers la bonne API.
- Ne masque pas les erreurs d'authentification 401/403 ni les limites 429 par un fallback.
