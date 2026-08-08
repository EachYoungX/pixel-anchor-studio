mod app_mode;
mod data_directory;
mod file_commands;
mod native_dialog;
mod startup;
mod webview2;
mod window_state;

use app_mode::AppMode;
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashSet;
use std::path::PathBuf;
use tauri::{Emitter, Manager, WebviewEvent};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppEnvironment {
    platform: &'static str,
    mode: AppMode,
    data_directory: String,
    version: String,
    webview2_version: String,
}

pub struct DesktopState {
    environment: AppEnvironment,
    approved_drop_paths: Mutex<HashSet<PathBuf>>,
    pending_authorized_drop: Mutex<Option<Vec<DroppedPathPayload>>>,
    pending_project_paths: Mutex<HashSet<PathBuf>>,
    current_project_path: Mutex<Option<PathBuf>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DroppedPathPayload {
    name: String,
    path: String,
    is_directory: bool,
}

#[derive(Clone, Serialize)]
struct DroppedFilesPayload {
    files: Vec<DroppedPathPayload>,
}

impl DesktopState {
    fn approve_drop_paths(&self, paths: &[PathBuf]) -> Vec<DroppedPathPayload> {
        let mut approved = self.approved_drop_paths.lock();
        approved.clear();
        let mut payloads = Vec::new();
        for path in paths {
            if let Ok(canonical) = path.canonicalize() {
                payloads.push(DroppedPathPayload {
                    name: canonical
                        .file_name()
                        .and_then(|value| value.to_str())
                        .unwrap_or("file")
                        .to_string(),
                    path: canonical.to_string_lossy().into_owned(),
                    is_directory: canonical.is_dir(),
                });
                approved.insert(canonical);
            }
        }
        *self.pending_authorized_drop.lock() = Some(payloads.clone());
        payloads
    }

    fn take_authorized_drop(&self) -> Option<Vec<DroppedPathPayload>> {
        self.pending_authorized_drop.lock().take()
    }
}

#[tauri::command]
fn get_app_environment(state: tauri::State<'_, DesktopState>) -> AppEnvironment {
    state.environment.clone()
}

#[tauri::command]
fn claim_authorized_drop(state: tauri::State<'_, DesktopState>) -> Option<DroppedFilesPayload> {
    state
        .take_authorized_drop()
        .map(|files| DroppedFilesPayload { files })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup = match startup::prepare() {
        Ok(context) => context,
        Err(error) => {
            eprintln!("Pixel Anchor Studio startup stopped: {error}");
            return;
        }
    };
    let environment = AppEnvironment {
        platform: "desktop",
        mode: startup.paths.location.mode,
        data_directory: startup.paths.data_dir.to_string_lossy().into_owned(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        webview2_version: startup.webview2_version,
    };
    let window_state = window_state::WindowStateWriter::new(&startup.paths.config_dir);
    let setup_window_state = window_state.clone();
    let event_window_state = window_state.clone();
    let state = DesktopState {
        environment,
        approved_drop_paths: Mutex::new(HashSet::new()),
        pending_authorized_drop: Mutex::new(None),
        pending_project_paths: Mutex::new(HashSet::new()),
        current_project_path: Mutex::new(None),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window_state::focus_main_window(app);
        }))
        .manage(state)
        .setup(move |app| {
            if let Some(window) = app.get_webview_window("main") {
                setup_window_state.restore(&window);
                window.show()?;
                window.set_focus()?;
            }
            Ok(())
        })
        .on_window_event(move |window, event| event_window_state.handle(window, event))
        .on_webview_event(|webview, event| {
            if let WebviewEvent::DragDrop(drop_event) = event {
                match drop_event {
                    tauri::DragDropEvent::Drop { paths, .. } => {
                        let files = webview.state::<DesktopState>().approve_drop_paths(paths);
                        if let Err(error) =
                            webview.emit("pas://files-dropped", DroppedFilesPayload { files })
                        {
                            eprintln!("failed to emit authorized dropped files: {error}");
                        }
                    }
                    _ => {}
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_environment,
            claim_authorized_drop,
            file_commands::pick_image,
            file_commands::open_project,
            file_commands::read_dropped_file,
            file_commands::save_binary,
            file_commands::adopt_project_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Pixel Anchor Studio");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_state() -> DesktopState {
        DesktopState {
            environment: AppEnvironment {
                platform: "desktop",
                mode: AppMode::Installed,
                data_directory: String::new(),
                version: String::new(),
                webview2_version: String::new(),
            },
            approved_drop_paths: Mutex::new(HashSet::new()),
            pending_authorized_drop: Mutex::new(None),
            pending_project_paths: Mutex::new(HashSet::new()),
            current_project_path: Mutex::new(None),
        }
    }

    #[test]
    fn authorized_drop_batch_can_only_be_claimed_once() {
        let directory = tempfile::tempdir().unwrap();
        let dropped = directory.path().join("drop.png");
        std::fs::write(&dropped, b"drop").unwrap();
        let canonical = dropped.canonicalize().unwrap();
        let state = test_state();

        state.approve_drop_paths(std::slice::from_ref(&dropped));

        let claimed = state.take_authorized_drop().unwrap();
        assert_eq!(claimed.len(), 1);
        assert_eq!(claimed[0].path, canonical.to_string_lossy());
        assert!(state.approved_drop_paths.lock().contains(&canonical));
        assert!(state.take_authorized_drop().is_none());
    }
}
