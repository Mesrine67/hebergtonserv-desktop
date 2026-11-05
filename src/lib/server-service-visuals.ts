import { Bot, Braces, Coffee, Database, Gamepad2, Pickaxe, Server, Terminal, type LucideIcon } from "lucide-react";

/**
 * Client-visible WISP/Pterodactyl server lists expose an egg name, not a
 * trustworthy artwork URL. Match only that value; do not infer from private
 * server names or fetch image URLs from untrusted panels.
 */
export type ServerServiceKind =
  | "fivem" | "minecraft" | "node" | "discord" | "java"
  | "python" | "database" | "game" | "generic";

export const serviceIcons: Record<ServerServiceKind, LucideIcon> = {
  fivem: Gamepad2,
  minecraft: Pickaxe,
  node: Braces,
  discord: Bot,
  java: Coffee,
  python: Terminal,
  database: Database,
  game: Gamepad2,
  generic: Server,
};

export function getServiceKind(egg?: string | null): ServerServiceKind {
  if (!egg?.trim()) return "generic";
  const name = egg.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(five\s?m|red\s?m|fxserver|cfx|gta\s?v|gta5)\b/.test(name)) return "fivem";
  if (/\b(minecraft|bedrock|paper|purpur|spigot|bukkit|bungeecord|velocity|forge|fabric)\b/.test(name)) return "minecraft";
  if (/\b(discord|telegram|bot)\b/.test(name)) return "discord";
  if (/\b(node[.\s-]?js|node\.js|javascript|typescript|bun|deno)\b/.test(name)) return "node";
  if (/\b(java|jre|jvm)\b/.test(name)) return "java";
  if (/\b(python|py\d|uvicorn)\b/.test(name)) return "python";
  if (/\b(mariadb|mysql|postgres|redis|mongo|database)\b/.test(name)) return "database";
  if (/\b(rust|valheim|terraria|counter.?strike|cs2|ark|palworld|7\s?days|factorio|satisfactory|gmod|garry|steamcmd)\b/.test(name)) return "game";
  return "generic";
}
