use std::path::Path;

const WEBVIEW2_DOWNLOAD_URL: &str = "https://developer.microsoft.com/microsoft-edge/webview2/";

#[derive(Clone, Debug)]
#[cfg_attr(not(windows), allow(dead_code))]
pub enum RuntimeStatus {
    Available(String),
    Missing,
    DetectionFailed(String),
}

pub fn download_url() -> &'static str {
    WEBVIEW2_DOWNLOAD_URL
}

#[cfg(windows)]
pub fn detect_runtime() -> RuntimeStatus {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY};
    use winreg::RegKey;

    const CLIENT_KEY: &str =
        r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    let candidates = [
        (HKEY_CURRENT_USER, KEY_READ),
        (HKEY_LOCAL_MACHINE, KEY_READ),
        (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_32KEY),
    ];
    let mut errors = Vec::new();
    for (hive, flags) in candidates {
        match RegKey::predef(hive).open_subkey_with_flags(CLIENT_KEY, flags) {
            Ok(key) => match key.get_value::<String, _>("pv") {
                Ok(version) if !version.trim().is_empty() && version != "0.0.0.0" => {
                    return RuntimeStatus::Available(version)
                }
                Ok(_) => {}
                Err(error) => errors.push(error.to_string()),
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => errors.push(error.to_string()),
        }
    }
    if errors.is_empty() {
        RuntimeStatus::Missing
    } else {
        RuntimeStatus::DetectionFailed(errors.join("；"))
    }
}

#[cfg(not(windows))]
pub fn detect_runtime() -> RuntimeStatus {
    RuntimeStatus::Available("non-windows-development".to_string())
}

pub fn install_bootstrapper(executable_dir: &Path) -> Result<(), String> {
    let installer = executable_dir
        .join("runtime")
        .join("MicrosoftEdgeWebView2Setup.exe");
    if !installer.is_file() {
        return Err(format!(
            "未找到微软 WebView2 安装程序：{}",
            installer.display()
        ));
    }
    let status = std::process::Command::new(&installer)
        .status()
        .map_err(|error| format!("无法启动 WebView2 安装程序：{error}"))?;
    if !status.success() {
        return Err(format!(
            "WebView2 安装程序返回错误代码：{}",
            status.code().unwrap_or(-1)
        ));
    }
    match detect_runtime() {
        RuntimeStatus::Available(_) => Ok(()),
        RuntimeStatus::Missing => Err("安装程序已结束，但仍未检测到 WebView2 Runtime".to_string()),
        RuntimeStatus::DetectionFailed(error) => {
            Err(format!("安装后无法确认 WebView2 Runtime：{error}"))
        }
    }
}
