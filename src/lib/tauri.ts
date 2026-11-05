import { invoke as nativeInvoke } from "@tauri-apps/api/core";

/**
 * Instrument every typed Desktop command without serializing arguments, API
 * credentials, response bodies or exceptions into the diagnostic journal.
 */
async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const started = performance.now();
  const report = (outcome: "ok" | "error") => {
    const durationMs = Math.min(60000, Math.max(0, Math.round(performance.now() - started)));
    void nativeInvoke("record_command_event", { operation: command, outcome, durationMs }).catch(() => undefined);
  };
  try {
    const result = await nativeInvoke<T>(command, args);
    report("ok");
    return result;
  } catch (reason) {
    report("error");
    throw reason;
  }
}

export interface SshKeySummary {
  id: string;
  name: string;
  public_key_file?: string | null;
  private_key_file?: string | null;
  key_type?: string | null;
  fingerprint?: string | null;
  comment?: string | null;
  has_private: boolean;
  encrypted: boolean;
  permissions_warning: boolean;
}

export interface PublicKeyContent {
  public_key: string;
  fingerprint: string;
  key_type: string;
  comment: string;
}

export interface AgentIdentity {
  id: string;
  comment?: string | null;
  fingerprint?: string | null;
  source: string;
}

export interface AgentStatus {
  running: boolean;
  source: string;
}

export interface SshConfigEntry {
  host: string;
  port?: number | null;
  user?: string | null;
  identity_file?: string | null;
}

export interface SshConfigSnapshot {
  path: string;
  entries: SshConfigEntry[];
}

export interface SshConnectionResult {
  state: string;
  message: string;
}

export interface HostKeyEntry {
  host: string;
  port: number;
  key_type: string;
  key: string;
  comment: string;
  fingerprint: string;
}

export interface PanelConfig {
  id: string;
  name: string;
  provider: string;
  base_url: string;
  pterodactyl_version: string;
  allow_local: boolean;
  status?: string | null;
  account_label?: string | null;
  last_checked_at?: string | null;
}

export interface PanelCheckResult {
  panel_id: string;
  status: string;
  message: string;
  provider: string;
  account_label?: string | null;
  api_keys_supported: boolean;
  ssh_keys_supported: boolean;
}

export interface PanelSubuser {
  uuid: string;
  identifier?: string | null;
  username?: string | null;
  email?: string | null;
  two_factor_enabled?: boolean | null;
  created_at?: string | null;
  permissions: string[];
}

export interface PanelCapability<T> {
  supported: boolean;
  value?: T | null;
  message?: string | null;
  help_url?: string | null;
  verified: boolean;
}

export interface PanelServer {
  id: string;
  identifier: string;
  name: string;
  description?: string | null;
  status?: string | null;
  node?: string | null;
  connect_address?: string | null;
  suspended: boolean;
  installing: boolean;
  egg?: string | null;
  thumbnail_url?: string | null;
  limits: {
    memory?: number | null;
    swap?: number | null;
    disk?: number | null;
    cpu?: number | null;
    databases?: number | null;
    allocations?: number | null;
    backups?: number | null;
  };
}

export interface PanelServerResources {
  state?: string | null;
  suspended: boolean;
  memory_used_bytes?: number | null;
  memory_limit_bytes?: number | null;
  cpu_percent?: number | null;
  cpu_limit_percent?: number | null;
  disk_used_bytes?: number | null;
  disk_limit_bytes?: number | null;
  network_rx_bytes?: number | null;
  network_tx_bytes?: number | null;
  uptime_ms?: number | null;
  players?: number | null;
  max_players?: number | null;
  connect_address?: string | null;
}

export interface PanelFileEntry { name: string; path: string; kind: string; size?: number | null; modified_at?: string | null; }
export interface PanelDatabase { id: string; name: string; username?: string | null; password?: string | null; host?: string | null; connections_from?: string | null; jdbc_connection_string?: string | null; phpmyadmin_url?: string | null; }

export interface PanelResourceBatchItem { key: string; resources: PanelServerResources | null; error_code: string | null; }

export interface PanelAccountSummary {
  panel_id: string;
  provider: string;
  base_url: string;
  account: {
    id: number;
    username: string;
    email: string;
    display_name: string;
    admin: boolean;
  };
}

export interface WispLoginResult {
  panel_id: string;
  display_name: string;
  email: string;
  provider: string;
}

export interface SshProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: string;
  key_name?: string | null;
  group: string;
  created_at?: string | null;
  updated_at?: string | null;
  last_connected_at?: string | null;
}

export interface SettingsDocument {
  version: number;
  data: {
    close_to_tray: boolean;
    start_with_windows: boolean;
  };
}

export interface SecurityState {
  keyring_available: boolean;
  https_only: boolean;
}

export interface GitTools { git: string | null; gh: string | null; }
export interface GitCommit { hash: string; subject: string; }
export interface GitSnapshot {
  root: string;
  branch: string;
  changes: string[];
  changes_truncated: boolean;
  commits: GitCommit[];
}
export interface GitMutationResult { action: "fetch" | "pull" | "push"; branch: string; message: string; }
export interface GitHubEntry {
  number: number;
  title: string;
  state: string;
  url: string;
  updated_at: string | null;
  labels: string[];
  head_branch: string | null;
  base_branch: string | null;
}
export interface GitHubActivity {
  repository: string;
  authenticated: boolean;
  pull_requests: GitHubEntry[];
  issues: GitHubEntry[];
  issues_available: boolean;
}

export const commands = {
  getGitTools: () => invoke<GitTools>("get_git_tools"),
  inspectGitRepository: (path: string) => invoke<GitSnapshot>("inspect_git_repository", { path }),
  getGitHubActivity: (path: string) => invoke<GitHubActivity>("get_github_activity", { path }),
  mutateGitRepository: (path: string, action: GitMutationResult["action"]) => invoke<GitMutationResult>("mutate_git_repository", { path, action }),
  toggleAppWindowMaximize: () => invoke<void>("toggle_app_window_maximize"),
  listSshKeys: () => invoke<SshKeySummary[]>("list_ssh_keys"),
  generateSshKey: (input: {
    name: string;
    directory?: string | null;
    key_type: string;
    bits?: number | null;
    passphrase?: string | null;
    comment: string;
  }) => invoke<SshKeySummary>("generate_ssh_key", { input }),
  importPublicKey: (name: string, publicKey: string) =>
    invoke<PublicKeyContent>("import_public_key", { name, publicKey }),
  readPublicKey: (id: string) =>
    invoke<PublicKeyContent>("read_ssh_public_key", { id }),
  deleteSshKey: (trashId: string) =>
    invoke<unknown>("delete_ssh_key", { trashId }),
  listSshTrash: () => invoke<unknown[]>("list_ssh_trash"),
  testSshConnection: (input: {
    host: string;
    port: number;
    username: string;
    authMethod: string;
    keyName?: string | null;
  }) => invoke<SshConnectionResult>("test_ssh_connection", { input: { host: input.host, port: input.port, username: input.username, auth_method: input.authMethod, key_name: input.keyName ?? null } }),
  openSshConnection: (input: {
    host: string;
    port: number;
    username: string;
    authMethod: string;
    keyName?: string | null;
  }) => invoke<void>("open_ssh_connection", { input: { host: input.host, port: input.port, username: input.username, auth_method: input.authMethod, key_name: input.keyName ?? null } }),
  scanHostKey: (host: string, port: number) =>
    invoke<HostKeyEntry>("scan_host_key", { host, port }),
  appendHostKey: (host: string, port: number, entry: HostKeyEntry) =>
    invoke<void>("append_host_key", { host, port, entry }),
  readSshConfig: () => invoke<SshConfigSnapshot>("read_ssh_config"),
  upsertSshConfig: (entry: SshConfigEntry) =>
    invoke<SshConfigSnapshot>("upsert_ssh_config", { entry }),
  deleteSshConfig: (host: string) =>
    invoke<boolean>("delete_ssh_config", { host }),
  importSshConfigProfiles: () => invoke<SshProfile[]>("import_ssh_config_profiles"),
  agentStatus: () => invoke<AgentStatus>("agent_status"),
  agentIdentities: () => invoke<AgentIdentity[]>("agent_identities"),
  agentAddIdentity: (keyName: string) =>
    invoke<void>("agent_add_identity", { keyName }),
  agentRemoveIdentity: (keyName: string) =>
    invoke<void>("agent_remove_identity", { keyName }),
  listPanels: () => invoke<PanelConfig[]>("list_panels"),
  loginWisp: (baseUrl: string, token: string) => invoke<WispLoginResult>("login_wisp", { baseUrl, token }),
  savePanel: (panel: PanelConfig) => invoke<void>("save_panel", { panel }),
  deletePanel: (id: string) => invoke<void>("delete_panel", { id }),
  checkPanel: (id: string) => invoke<PanelCheckResult>("check_panel", { id }),
  getPanelAccount: (id: string) => invoke<PanelAccountSummary>("get_panel_account", { id }),
  listPanelServers: (id: string) => invoke<PanelServer[]>("list_panel_servers", { id }),
  getPanelThumbnail: (id: string, thumbnailUrl: string) => invoke<string>("get_panel_thumbnail", { id, thumbnailUrl }),
  listPanelServerFiles: (id: string, identifier: string, path: string) => invoke<PanelFileEntry[]>("list_panel_server_files", { id, identifier, path }),
  readPanelServerFile: (id: string, identifier: string, path: string) => invoke<string>("read_panel_server_file", { id, identifier, path }),
  listPanelServerDatabases: (id: string, identifier: string) => invoke<PanelDatabase[]>("list_panel_server_databases", { id, identifier }),
  listPanelServerSubusers: (id: string, identifier: string) =>
    invoke<PanelCapability<PanelSubuser[]>>("list_panel_server_subusers", { id, identifier }),
  getPanelResourcesBatch: (id: string, requests: { key: string; identifier: string }[]) => invoke<PanelResourceBatchItem[]>("get_panel_resources_batch", { id, requests }),
  getPanelServerResources: (id: string, identifier: string) =>
    invoke<PanelServerResources>("get_panel_server_resources", { id, identifier }),
  setPanelToken: (id: string, token: string) => invoke<void>("set_panel_token", { id, token }),
  panelTokenConfigured: (id: string) => invoke<boolean>("panel_token_configured", { id }),
  createPanelApiKey: (panelId: string, description: string, allowedIps: string[]) =>
    invoke<unknown>("create_panel_api_key", { panelId, description, allowedIps }),
  createPanelSshKey: (panelId: string, name: string, publicKey: string) =>
    invoke<unknown>("create_panel_ssh_key", { panelId, name, publicKey }),
  revokePanelApiKey: (panelId: string, identifier: string) =>
    invoke<void>("revoke_panel_api_key", { panelId, identifier }),
  deletePanelSshKey: (panelId: string, fingerprint: string) =>
    invoke<void>("delete_panel_ssh_key", { panelId, fingerprint }),
  listProfiles: () => invoke<SshProfile[]>("list_ssh_profiles"),
  saveProfile: (profile: SshProfile) => invoke<void>("save_ssh_profile", { profile }),
  deleteProfile: (id: string) => invoke<void>("delete_ssh_profile", { id }),
  getSettings: () => invoke<SettingsDocument>("get_settings"),
  updateSettings: (closeToTray: boolean, startWithWindows: boolean) =>
    invoke<void>("update_settings", { closeToTray, startWithWindows }),
  enableAutostart: () => invoke<void>("enable_autostart"),
  disableAutostart: () => invoke<void>("disable_autostart"),
  getSecurityState: () => invoke<SecurityState>("get_security_state"),
};
