import EditorWorker from "../../node_modules/monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "../../node_modules/monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "../../node_modules/monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "../../node_modules/monaco-editor/esm/vs/language/html/html.worker?worker";
import TypeScriptWorker from "../../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker?worker";

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker: (_moduleId: string, label: string) => Worker;
    };
  }
}

window.MonacoEnvironment = {
  getWorker: (_moduleId, label) => {
    switch (label) {
      case "json": return new JsonWorker();
      case "css":
      case "scss":
      case "less": return new CssWorker();
      case "html":
      case "handlebars":
      case "razor": return new HtmlWorker();
      case "typescript":
      case "javascript": return new TypeScriptWorker();
      default: return new EditorWorker();
    }
  },
};
