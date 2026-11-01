import { invoke } from "@tauri-apps/api/core";

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
  account_label?: string | null;
  api_keys_supported: boolean;
  ssh_keys_supported: boolean;
}

export interface WispLoginResult {
  panel_id: string;
  display_name: string;
  email: string;
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

export const commands = {
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
