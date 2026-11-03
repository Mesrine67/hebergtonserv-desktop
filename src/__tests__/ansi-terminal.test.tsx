import { describe, expect, it } from "vitest";
import { parseAnsiLine, plainTerminalLine } from "../lib/ansi-terminal";

describe("Wings ANSI terminal", () => {
  it("renders colors and keeps log text without visible escape codes", () => {
    const source = "\x1b[43m\x1b[30m[23:15:22]\x1b[39m\x1b[49m Hello";
    const spans = parseAnsiLine(source);
    expect(spans.map(s => s.text).join("")).toBe("[23:15:22] Hello");
    expect(spans[0].style.backgroundColor).toBe("#eab308");
    expect(spans[0].style.color).toBe("#171717");
  });
  it("supports 256-color and RGB foreground codes", () => {
    expect(parseAnsiLine("\x1b[38;5;196mAlert")[0].style.color).toBe("rgb(255,0,0)");
    expect(parseAnsiLine("\x1b[38;2;12;34;56mInfo")[0].style.color).toBe("rgb(12,34,56)");
  });
  it("strips non-SGR escape sequences and unsafe control characters", () => {
    expect(plainTerminalLine("\x1b[2J\x1b[Hok\x00\x07\x1b]0;title\x07")).toBe("ok");
  });
  it("keeps HTML literal, never interpreted as markup", () => {
    expect(plainTerminalLine("<script>alert(1)</script>")).toBe("<script>alert(1)</script>");
  });
});
