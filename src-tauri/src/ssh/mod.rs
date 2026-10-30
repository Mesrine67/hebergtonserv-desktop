pub mod agent;
pub mod config;
pub mod connection;
pub mod keys;
pub mod known_hosts;
pub mod models;
pub mod paths;

pub use agent::{
    AgentStatus, agent_add_identity, agent_identities, agent_remove_identity, agent_service_status,
};
pub use config::{
    delete_ssh_config_entry, import_ssh_config_profiles, read_ssh_config, upsert_ssh_config,
};
pub use connection::{TestConnectionInput, open_ssh_connection, ssh_binary, test_ssh_connection};
pub use keys::{
    GenerateKeyInput, delete_ssh_key, generate_ssh_key, import_public_key_text, is_valid_key_name,
    is_valid_public_key_content, list_ssh_trash, read_public_key, scan_ssh_dir,
};
pub use known_hosts::{
    HostKeyEntry, append_host_key, public_key_content_from_scan, scan_host_key, trusted_hosts_path,
};
pub use models::{
    AgentIdentity, PublicKeyContent, SshConfigEntry, SshConfigSnapshot, SshConnectionResult,
    SshKeySummary, TrashEntry,
};

pub fn ssh_dir_path() -> Option<std::path::PathBuf> {
    crate::ssh::paths::ssh_dir()
}

pub fn home_path() -> Option<std::path::PathBuf> {
    crate::ssh::paths::home_dir()
}

pub fn open_ssh_config_path() -> Option<std::path::PathBuf> {
    crate::ssh::paths::open_ssh_config_path()
}
