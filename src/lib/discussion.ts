export type DiscussionMessage = {
  id: string;
  role: "user" | "help";
  content: string;
  createdAt: string;
};

export const DISCUSSION_STORAGE_KEY = "hts-discussion-v1";
export const DISCUSSION_MAX_MESSAGES = 80;
export const DISCUSSION_MAX_LENGTH = 2000;

export function readDiscussion(storage: Pick<Storage, "getItem">): DiscussionMessage[] {
  try {
    const json = storage.getItem(DISCUSSION_STORAGE_KEY);
    if (!json) return [];
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value
      .filter((message): message is DiscussionMessage =>
        typeof message === "object" && message !== null &&
        typeof message.id === "string" && message.id.length <= 100 &&
        (message.role === "user" || message.role === "help") &&
        typeof message.content === "string" &&
        message.content.length > 0 && message.content.length <= DISCUSSION_MAX_LENGTH &&
        typeof message.createdAt === "string" && message.createdAt.length <= 40)
      .slice(-DISCUSSION_MAX_MESSAGES);
  } catch {
    return [];
  }
}

export function persistDiscussion(storage: Pick<Storage, "setItem" | "removeItem">, messages: DiscussionMessage[]): boolean {
  try {
    if (messages.length === 0) storage.removeItem(DISCUSSION_STORAGE_KEY);
    else storage.setItem(DISCUSSION_STORAGE_KEY, JSON.stringify(messages.slice(-DISCUSSION_MAX_MESSAGES)));
    return true;
  } catch {
    // Private browsing or unavailable storage: keep the conversation in memory.
    return false;
  }
}

export function helpReply(question: string): string {
  const query = question.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/(?:mise|mises|mettre).{0,16}jour|updat|version|release/.test(query)) {
    return "Pour vérifier une mise à jour, utilisez l'icône de téléchargement dans la barre du haut, puis « Vérifier maintenant ». Vous pourrez choisir d'installer la version proposée.";
  }
  if (/ssh|cle|config|connexion/.test(query)) {
    return "Ouvrez « Clés SSH » pour gérer vos clés, « Configuration SSH » pour vos hôtes, ou « Profils SSH » pour vos connexions.";
  }
  if (/wisp|pterodactyl|panel|serveur/.test(query)) {
    return "Dans la barre latérale, ouvrez « Panels » pour ajouter votre panel Wisp ou Pterodactyl. Les pages « Compte du panel » et « Serveurs » affichent ensuite les informations disponibles.";
  }
  if (/theme|style|couleur|sombre|clair|mira|preset/.test(query)) {
    return "Dans « Paramètres », ouvrez « Style & thèmes » pour choisir le mode d'affichage, les palettes Mira et l'animation d'ouverture.";
  }
  if (/discussion|assistant|intelligence.artificielle|\bia\b|historique/.test(query)) {
    return "Cette discussion utilise pour l'instant une aide locale, pas un modèle d'IA ni une messagerie entre utilisateurs. Les messages restent dans le stockage local de l'application. N'y saisissez pas de mots de passe ou de clés privées.";
  }
  return "Je peux actuellement vous guider sur les mises à jour, les clés SSH, les panels et les thèmes. L'assistance par IA et les conversations partagées ne sont pas encore connectées.";
}
