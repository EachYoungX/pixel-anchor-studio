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
use tauri::{Manager, WebviewEvent};

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
    pending_project_paths: Mutex<HashSet<PathBuf>>,
    current_project_path: Mutex<Option<PathBuf>>,
}

impl DesktopState {
    fn approve_drop_paths(&self, paths: &[PathBuf]) {
        let mut approved = self.approved_drop_paths.lock();
        for path in paths {
            if let Ok(canonical) = path.canonicalize() {
                approved.insert(canonical);
            }
        }
    }
}

#[tauri::command]
fn get_app_environment(state: tauri::State<'_, DesktopState>) -> AppEnvironment {
    state.environment.clone()
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
            if let WebviewEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                webview.state::<DesktopState>().approve_drop_paths(paths);
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_environment,
            file_commands::pick_image,
            file_commands::open_project,
            file_commands::read_dropped_file,
            file_commands::save_binary,
            file_commands::adopt_project_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Pixel Anchor Studio");
}
