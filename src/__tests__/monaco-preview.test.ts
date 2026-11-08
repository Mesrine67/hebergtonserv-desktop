import { describe, expect, it } from "vitest";
import { buildSafeMonacoPreview } from "../lib/monaco-preview";

describe("Monaco isolated HTML/CSS preview", () => {
  it("supports HTML and CSS but not arbitrary server-side or binary files", () => {
    expect(buildSafeMonacoPreview("/website/index.html", "<h1>Test</h1>")).toContain("<h1>Test</h1>");
    expect(buildSafeMonacoPreview("/website/style.CSS", "h1 { color: red }")).toContain("h1 { color: red }");
    expect(buildSafeMonacoPreview("/server/config.lua", "print('test')")).toBeNull();
    expect(buildSafeMonacoPreview("/website/large.html", "a".repeat(150_001))).toBeNull();
  });

  it("adds a restrictive CSP that blocks scripts, network and forms", () => {
    const srcDoc = buildSafeMonacoPreview("page.html", "<script>alert('x')</script>")!;
    expect(srcDoc).toContain("script-src 'none'");
    expect(srcDoc).toContain("default-src 'none'");
    expect(srcDoc).toContain("connect-src 'none'");
    expect(srcDoc).toContain("form-action 'none'");
    expect(srcDoc).toContain("base-uri 'none'");
  });

  it("keeps CSS-only closing tags from escaping the stylesheet element", () => {
    const srcDoc = buildSafeMonacoPreview("style.css", "p{} </style><script>alert(1)</script>")!;
    expect(srcDoc).not.toContain("</style><script>");
    expect(srcDoc).toContain("preview-sample");
  });
});
