use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AppMode {
    Portable,
    Installed,
}

#[derive(Clone, Debug)]
pub struct AppLocation {
    pub executable_dir: PathBuf,
    pub mode: AppMode,
}

pub fn detect() -> Result<AppLocation, String> {
    let executable =
        std::env::current_exe().map_err(|error| format!("无法确定程序位置：{error}"))?;
    let executable_dir = executable
        .parent()
        .ok_or_else(|| "无法确定程序所在目录".to_string())?
        .to_path_buf();
    let mode = if portable_flag_exists(&executable_dir) {
        AppMode::Portable
    } else {
        AppMode::Installed
    };
    Ok(AppLocation {
        executable_dir,
        mode,
    })
}

fn portable_flag_exists(executable_dir: &Path) -> bool {
    executable_dir.join("portable.flag").is_file()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn portable_mode_only_uses_the_executable_directory() {
        let directory = tempfile::tempdir().unwrap();
        assert!(!portable_flag_exists(directory.path()));
        std::fs::write(directory.path().join("portable.flag"), []).unwrap();
        assert!(portable_flag_exists(directory.path()));
    }
}
