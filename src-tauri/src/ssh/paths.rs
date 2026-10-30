use std::path::{Path, PathBuf};

pub fn home_dir() -> Option<PathBuf> {
    dirs::home_dir()
}

pub fn ssh_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".ssh"))
}

pub fn open_ssh_config_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".ssh").join("config"))
}

pub fn private_key_path(private_key_file: &Path) -> Option<PathBuf> {
    let file_name = private_key_file.file_name()?.to_str()?.to_string();
    let public_name = format!("{}.pub", file_stem(&file_name));
    Some(private_key_file.parent()?.join(public_name))
}

fn file_stem(file_name: &str) -> String {
    file_name
        .strip_suffix(".pub")
        .unwrap_or(file_name)
        .to_string()
}

#[allow(dead_code)]
pub fn is_public_key_file(file_name: &str) -> bool {
    file_name.ends_with(".pub")
}
