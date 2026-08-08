use crate::app_mode::{AppLocation, AppMode};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub const APP_ID: &str = "com.eachyoung.pixel-anchor-studio";
const DATA_VERSION: u32 = 1;
#[cfg(windows)]
const REGISTRY_KEY: &str = r"Software\EachYoung\PixelAnchorStudio";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerMarker {
    pub app_id: String,
    pub install_id: String,
    pub data_version: u32,
}

#[derive(Clone, Debug)]
pub struct AppPaths {
    pub location: AppLocation,
    pub data_dir: PathBuf,
    pub webview_dir: PathBuf,
    pub config_dir: PathBuf,
    pub install_id: String,
}

pub fn resolve(location: AppLocation) -> Result<AppPaths, String> {
    let (data_dir, configured_install_id) = match location.mode {
        AppMode::Portable => (location.executable_dir.join("data"), None),
        AppMode::Installed => installed_data_directory(),
    };
    let existing = read_owner_marker(&data_dir);
    if let Some(marker) = existing.as_ref() {
        if marker.app_id != APP_ID {
            return Err(format!("数据目录不属于本应用：{}", data_dir.display()));
        }
    }
    let install_id = configured_install_id
        .or_else(|| existing.map(|marker| marker.install_id))
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    Ok(AppPaths {
        location,
        webview_dir: data_dir.join("webview"),
        config_dir: data_dir.join("config"),
        data_dir,
        install_id,
    })
}

pub fn prepare(paths: &AppPaths) -> Result<(), String> {
    ensure_writable(&paths.data_dir)?;
    for directory in ["webview", "config", "cache", "logs", "temp", "recovery"] {
        fs::create_dir_all(paths.data_dir.join(directory)).map_err(|error| {
            format!(
                "无法创建数据目录 {}：{error}",
                paths.data_dir.join(directory).display()
            )
        })?;
    }
    let marker = OwnerMarker {
        app_id: APP_ID.to_string(),
        install_id: paths.install_id.clone(),
        data_version: DATA_VERSION,
    };
    let marker_path = paths.data_dir.join("app-owner.json");
    let document = serde_json::to_vec_pretty(&marker).map_err(|error| error.to_string())?;
    fs::write(&marker_path, document)
        .map_err(|error| format!("无法写入 {}：{error}", marker_path.display()))?;
    Ok(())
}

pub fn ensure_writable(directory: &Path) -> Result<(), String> {
    fs::create_dir_all(directory)
        .map_err(|error| format!("无法创建目录 {}：{error}", directory.display()))?;
    let test_path = directory.join(format!(".write-test-{}", Uuid::new_v4()));
    let result = (|| -> std::io::Result<()> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&test_path)?;
        file.write_all(b"pixel-anchor-studio")?;
        file.sync_all()?;
        drop(file);
        fs::remove_file(&test_path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&test_path);
    }
    result.map_err(|error| format!("目录不可写 {}：{error}", directory.display()))
}

fn read_owner_marker(data_dir: &Path) -> Option<OwnerMarker> {
    let bytes = fs::read(data_dir.join("app-owner.json")).ok()?;
    serde_json::from_slice(&bytes).ok()
}

#[cfg(windows)]
fn installed_data_directory() -> (PathBuf, Option<String>) {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let registry = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(REGISTRY_KEY)
        .ok();
    let install_id: Option<String> = registry
        .as_ref()
        .and_then(|key| key.get_value("InstallId").ok());
    let fallback = dirs::data_local_dir()
        .unwrap_or_else(|| std::env::temp_dir())
        .join("PixelAnchorStudio")
        .join("data");
    (fallback, install_id)
}

#[cfg(not(windows))]
fn installed_data_directory() -> (PathBuf, Option<String>) {
    let fallback = dirs::data_local_dir()
        .unwrap_or_else(|| std::env::temp_dir())
        .join("PixelAnchorStudio")
        .join("data");
    (fallback, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_probe_leaves_no_file_behind() {
        let directory = tempfile::tempdir().unwrap();
        ensure_writable(directory.path()).unwrap();
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 0);
    }
}
