// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  DISCUSSION_MAX_MESSAGES,
  DISCUSSION_STORAGE_KEY,
  helpReply,
  persistDiscussion,
  readDiscussion,
  type DiscussionMessage,
} from "../lib/discussion";

function message(id: string): DiscussionMessage {
  return { id, role: "user", content: `Message ${id}`, createdAt: "2026-11-02T08:00:00.000Z" };
}

describe("Local HébergTonServ discussion", () => {
  it("starts empty and stores the conversation locally", () => {
    localStorage.clear();
    expect(readDiscussion(localStorage)).toEqual([]);
    const transcript = [message("first")];
    expect(persistDiscussion(localStorage, transcript)).toBe(true);
    expect(readDiscussion(localStorage)).toEqual(transcript);
    expect(localStorage.getItem(DISCUSSION_STORAGE_KEY)).toContain("Message first");
    expect(persistDiscussion(localStorage, [])).toBe(true);
    expect(localStorage.getItem(DISCUSSION_STORAGE_KEY)).toBeNull();
  });

  it("ignores malformed and oversized saved messages", () => {
    localStorage.setItem(DISCUSSION_STORAGE_KEY, JSON.stringify([
      { id: "invalid", role: "other", content: "incorrect", createdAt: "" },
      { id: "long", role: "help", content: "x".repeat(4000), createdAt: "2026-11-02" },
      message("valid"),
    ]));
    expect(readDiscussion(localStorage)).toEqual([message("valid")]);
    localStorage.setItem(DISCUSSION_STORAGE_KEY, "{broken json");
    expect(readDiscussion(localStorage)).toEqual([]);
  });

  it("bounds the local message history", () => {
    localStorage.clear();
    const transcript = Array.from({ length: DISCUSSION_MAX_MESSAGES + 20 }, (_, index) => message(String(index)));
    persistDiscussion(localStorage, transcript);
    const restored = readDiscussion(localStorage);
    expect(restored).toHaveLength(DISCUSSION_MAX_MESSAGES);
    expect(restored[0]?.id).toBe("20");
  });

  it("handles unavailable storage without crashing", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(readDiscussion(broken)).toEqual([]);
    expect(persistDiscussion(broken, [message("x")])).toBe(false);
  });

  it("explains supported topics without claiming an AI connection", () => {
    expect(helpReply("Comment mettre à jour l'app ?")).toContain("Vérifier maintenant");
    expect(helpReply("Vérifier les mises à jour")).toContain("Vérifier maintenant");
    expect(helpReply("Configurer une clé SSH")).toContain("Clés SSH");
    expect(helpReply("Où sont les serveurs Pterodactyl ?")).toContain("Panels");
    expect(helpReply("Changer le thème sombre")).toContain("Style & thèmes");
    expect(helpReply("Est-ce une IA ?")).toContain("pas un modèle d'IA");
    expect(helpReply("Question non reconnue")).toContain("pas encore connectées");
  });
});
