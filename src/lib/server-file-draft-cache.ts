type ExplorerState = { selected: string | null; path: string };

const drafts = new Map<string, string>();
const explorerStates = new Map<string, ExplorerState>();

function serverKey(panelId: string, serverIdentifier: string) {
  return JSON.stringify([panelId, serverIdentifier]);
}

function draftKey(panelId: string, serverIdentifier: string, filePath: string) {
  return JSON.stringify([panelId, serverIdentifier, filePath]);
}

export function getServerFileDraft(panelId: string, serverIdentifier: string, filePath: string) {
  return drafts.get(draftKey(panelId, serverIdentifier, filePath));
}

export function setServerFileDraft(panelId: string, serverIdentifier: string, filePath: string, value: string) {
  drafts.set(draftKey(panelId, serverIdentifier, filePath), value);
}

export function clearServerFileDraft(panelId: string, serverIdentifier: string, filePath: string) {
  drafts.delete(draftKey(panelId, serverIdentifier, filePath));
}

export function getServerExplorerState(panelId: string, serverIdentifier: string) {
  return explorerStates.get(serverKey(panelId, serverIdentifier));
}

export function setServerExplorerState(panelId: string, serverIdentifier: string, state: ExplorerState) {
  explorerStates.set(serverKey(panelId, serverIdentifier), state);
}
