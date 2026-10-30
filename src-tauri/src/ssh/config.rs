use crate::errors::Result;
use crate::ssh::models::{SshConfigEntry, SshConfigSnapshot};
use crate::storage::Storage;
use crate::storage::models::SshProfile;
use std::path::Path;

fn content_lines(path: &Path) -> Result<Vec<String>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(path)?;
    Ok(content
        .split('\n')
        .map(|line| line.trim_end_matches('\r').trim_end().to_string())
        .collect())
}

fn host_of(line: &str) -> Option<String> {
    let trimmed = line.trim();
    let rest = trimmed.strip_prefix("Host")?.trim_start();
    let first = rest.split_whitespace().next().unwrap_or_default();
    if first.is_empty() || first.starts_with('#') {
        return None;
    }
    Some(first.to_string())
}

struct Block {
    host: String,
    start: usize,
    end: usize,
}

fn find_blocks(lines: &[String]) -> Vec<Block> {
    let mut blocks = Vec::new();
    let mut start: Option<usize> = None;
    let mut host: Option<String> = None;
    for (index, line) in lines.iter().enumerate() {
        if let Some(current_host) = host_of(line) {
            if let Some(start_index) = start.take() {
                if let Some(host_value) = host.take() {
                    blocks.push(Block {
                        host: host_value,
                        start: start_index,
                        end: index,
                    });
                }
            }
            start = Some(index);
            host = Some(current_host);
        }
    }
    if let Some(start_index) = start.take() {
        if let Some(host_value) = host.take() {
            blocks.push(Block {
                host: host_value,
                start: start_index,
                end: lines.len(),
            });
        }
    }
    blocks
}

fn render(lines: Vec<String>) -> String {
    let content = lines.join("\n");
    if content.is_empty() {
        String::new()
    } else {
        format!("{content}\n")
    }
}

pub fn read_ssh_config(path: &Path) -> SshConfigSnapshot {
    let entries = content_lines(path)
        .map(|lines| {
            let mut entries = Vec::new();
            let mut current: Option<SshConfigEntry> = None;
            for line in lines {
                if let Some(host) = host_of(&line) {
                    if let Some(existing) = current.take() {
                        entries.push(existing);
                    }
                    current = Some(SshConfigEntry {
                        host,
                        port: None,
                        user: None,
                        identity_file: None,
                    });
                    continue;
                }
                let Some(entry) = current.as_mut() else {
                    continue;
                };
                if let Some(rest) = line.strip_prefix("Port") {
                    if let Ok(port) = rest.trim().parse::<u16>() {
                        entry.port = Some(port);
                    }
                } else if let Some(rest) = line.strip_prefix("User") {
                    let rest = rest.trim();
                    if !rest.is_empty() && !rest.starts_with("User") {
                        entry.user = Some(rest.to_string());
                    }
                } else if let Some(rest) = line.strip_prefix("IdentityFile") {
                    entry.identity_file = Some(rest.trim().to_string());
                }
            }
            if let Some(entry) = current {
                entries.push(entry);
            }
            entries
        })
        .unwrap_or_else(|_| Vec::new());
    SshConfigSnapshot {
        path: path.to_string_lossy().to_string(),
        entries,
    }
}

pub fn upsert_ssh_config(path: &Path, entry: &SshConfigEntry) -> Result<SshConfigSnapshot> {
    let mut lines = content_lines(path)?;
    let blocks = find_blocks(&lines);
    let block: Vec<String> = {
        let mut block = vec![format!("Host {}", entry.host)];
        if let Some(port) = entry.port {
            block.push(format!("Port {}", port));
        }
        if let Some(user) = &entry.user {
            block.push(format!("User {}", user));
        }
        if let Some(identity) = &entry.identity_file {
            block.push(format!("IdentityFile {}", identity));
        }
        block
    };
    let matched = blocks
        .iter()
        .position(|candidate| candidate.host.eq_ignore_ascii_case(&entry.host));
    if let Some(position) = matched {
        let block_value = &blocks[position];
        let start = block_value.start;
        let end = block_value.end;
        let new_lines: Vec<String> = lines[..start]
            .iter()
            .cloned()
            .chain(block.iter().cloned())
            .chain(lines[end..].iter().cloned())
            .collect();
        lines = new_lines;
    } else {
        lines.push(format!("Host {}", entry.host));
        lines.extend(block.into_iter().skip(1));
    }
    let content = render(lines);
    if path.exists() {
        let backup = path.with_file_name("config.bak");
        let _ = std::fs::copy(path, &backup);
    }
    Storage::atomic_write(path, &content)?;
    Ok(read_ssh_config(path))
}

pub fn delete_ssh_config_entry(path: &Path, host: &str) -> Result<bool> {
    let mut lines = content_lines(path)?;
    let blocks = find_blocks(&lines);
    let mut ranges: Vec<(usize, usize)> = Vec::new();
    let mut removed = false;
    for block in &blocks {
        if block.host.eq_ignore_ascii_case(host) {
            ranges.push((block.start, block.end));
            removed = true;
        }
    }
    for (start, end) in ranges.into_iter().rev() {
        lines.drain(start..end);
    }
    if removed {
        let content = render(lines);
        if path.exists() {
            let backup = path.with_file_name("config.bak");
            let _ = std::fs::copy(path, &backup);
        }
        Storage::atomic_write(path, &content)?;
    }
    Ok(removed)
}

pub fn import_ssh_config_profiles(path: &Path) -> Result<Vec<SshProfile>> {
    let snapshot = read_ssh_config(path);
    let mut profiles = Vec::new();
    for entry in snapshot.entries {
        let username = entry.user.clone().unwrap_or_else(|| "user".to_string());
        profiles.push(SshProfile {
            id: uuid::Uuid::new_v4().to_string(),
            name: format!("{}-{}", username, entry.host),
            host: entry.host.clone(),
            port: entry.port.unwrap_or(22),
            username,
            auth_method: if entry.identity_file.is_some() {
                "key".to_string()
            } else {
                "password".to_string()
            },
            key_name: entry.identity_file,
            group: "Imported".to_string(),
            created_at: None,
            updated_at: None,
            last_connected_at: None,
        });
    }
    Ok(profiles)
}
