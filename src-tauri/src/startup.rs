use crate::app_mode::{self, AppMode};
use crate::data_directory::{self, AppPaths};
use crate::native_dialog::{self, DependencyChoice};
use crate::webview2::{self, RuntimeStatus};

pub struct StartupContext {
    pub paths: AppPaths,
    pub webview2_version: String,
}

pub fn prepare() -> Result<StartupContext, String> {
    let location = app_mode::detect()?;
    let paths = data_directory::resolve(location)?;
    if let Err(error) = data_directory::prepare(&paths) {
        if paths.location.mode == AppMode::Portable {
            if native_dialog::show_portable_not_writable(&paths.location.executable_dir, &error) {
                let _ = native_dialog::open_path(&paths.location.executable_dir.to_string_lossy());
            }
            return Err(error);
        }
        native_dialog::show_error(&error);
        return Err(error);
    }

    let webview2_version = ensure_webview2(&paths)?;
    std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &paths.webview_dir);
    Ok(StartupContext {
        paths,
        webview2_version,
    })
}

fn ensure_webview2(paths: &AppPaths) -> Result<String, String> {
    loop {
        let detail = match webview2::detect_runtime() {
            RuntimeStatus::Available(version) => return Ok(version),
            RuntimeStatus::Missing => None,
            RuntimeStatus::DetectionFailed(error) => Some(error),
        };
        match native_dialog::show_missing_webview2(detail.as_deref()) {
            DependencyChoice::Install => {
                if let Err(error) =
                    webview2::install_bootstrapper(&paths.location.executable_dir)
                {
                    native_dialog::show_error(&error);
                }
            }
            DependencyChoice::Download => {
                native_dialog::open_url(webview2::download_url())?;
                return Err("WebView2 Runtime 尚未安装".to_string());
            }
            DependencyChoice::Exit => return Err("用户取消启动".to_string()),
        }
    }
}
