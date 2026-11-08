const previewCsp = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

/**
 * Only HTML and CSS can be rendered. Returned HTML is suitable for an
 * iframe with sandbox="" (no scripts, no same-origin, no Tauri IPC).
 */
export function buildSafeMonacoPreview(path: string, source: string): string | null {
  const filename = path.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  const isHtml = /\.(html?|xhtml)$/.test(filename);
  const isCss = filename.endsWith(".css");
  if (!isHtml && !isCss) return null;
  // Do not render very large untrusted server files into an embedded document.
  if (source.length > 150_000) return null;

  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${previewCsp}"><meta name="referrer" content="no-referrer">`;
  // Even though scripts are blocked by the iframe and CSP, escape style closing
  // tags to preserve the CSS-only preview document structure.
  const content = isCss
    ? `<style>${source.replace(/<\/style/gi, "<\\/style")}</style><main class="preview-sample"><h1>Prévisualisation CSS</h1><p>Texte d'exemple pour visualiser vos styles.</p><button type="button">Bouton d'exemple</button></main>`
    : source;
  return `<!doctype html><html lang="fr"><head>${head}</head><body>${content}</body></html>`;
}
