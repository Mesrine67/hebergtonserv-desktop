# Server cards: service artwork and actions

## Interface (v0.4.27+)

The server list uses a single accessible ellipsis menu per card, containing the existing navigation actions: **Console**, **Files**, **Databases**, and **Subusers**. The menu keeps the existing permission/error handling. The original inline Console/Gérer action row is removed; the service badge now sits immediately below the state badge.

## Where the artwork comes from

The existing `PanelServer.egg` label is already normalized by the Rust provider. It is the only input to the visual mapping in `src/lib/server-service-visuals.ts`. Known types (FiveM/RedM, Minecraft, Node.js, Discord bot, Java, Python, database and common games) render with a bundled Lucide service icon and a CSS-only themed background. Unknown or missing types use a generic server icon.

**No external images are fetched.** This avoids exposing tokens in URLs, arbitrary third-party tracking, broken images, startup latency, and use of unverified content. The artwork is decorative (`aria-hidden`) and the type/status remain available as readable text. A service's display name is never inferred from the server's arbitrary name.

Pterodactyl's **Egg** is a recipe for a service (name, startup and Docker images). A Docker `image` is an executable container image, **not a card background image**. Wings runs those containers; it is not a media API. Yolks provide runtime images, and game-eggs catalogs recipes. Neither should be queried for each card render. Pterodactyl 2.0 has application-side egg metadata, but fetching it with an administrator token solely to decorate client cards would be an unnecessary security and performance regression. WISP installations may add their own game art; that should be supported only with an explicit trusted, documented field and validation.

## Future support for optional real image art

If a panel provider later exposes an authorized thumbnail URL, add a distinct optional `thumbnail_url` field to the server model (never reuse `docker_image`). Validate the source and scheme on the Rust side; allow only trusted HTTPS hosts or a safe proxy and avoid cross-origin authorization headers. Prefer locally bundled, appropriately licensed artwork as the default. Always keep the decorative icon fallback for missing, blocked, offline or invalid images.

## References

- https://docs.pterodactyl.io/v2/project/how-it-works
- https://docs.pterodactyl.io/v2/guides/egg-creation/creating-custom-egg
- https://docs.pterodactyl.io/v2/guides/egg-creation/egg-docker-images
- https://docs.pterodactyl.io/v2/api/application-api/applicationListEggs
- https://github.com/pterodactyl/panel
- https://github.com/pterodactyl/wings
- https://github.com/pterodactyl/yolks
- https://github.com/pterodactyl/game-eggs
