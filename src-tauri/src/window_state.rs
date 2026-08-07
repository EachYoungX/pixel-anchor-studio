use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewWindow, Window, WindowEvent};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StoredWindowState {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub maximized: bool,
}

#[derive(Clone)]
pub struct WindowStateWriter {
    path: PathBuf,
    generation: Arc<AtomicU64>,
}

impl WindowStateWriter {
    pub fn new(config_dir: &Path) -> Self {
        Self {
            path: config_dir.join("window.json"),
            generation: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn restore(&self, window: &WebviewWindow) {
        let Ok(bytes) = fs::read(&self.path) else {
            return;
        };
        let Ok(state) = serde_json::from_slice::<StoredWindowState>(&bytes) else {
            return;
        };
        if !(1180..=7680).contains(&state.width) || !(720..=4320).contains(&state.height) {
            return;
        }
        let mut x = state.x;
        let mut y = state.y;
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let area = monitor.size();
            let origin = monitor.position();
            x = x.clamp(origin.x, origin.x + area.width as i32 - 120);
            y = y.clamp(origin.y, origin.y + area.height as i32 - 80);
        }
        let _ = window.set_size(PhysicalSize::new(state.width, state.height));
        let _ = window.set_position(PhysicalPosition::new(x, y));
        if state.maximized {
            let _ = window.maximize();
        }
    }

    pub fn handle(&self, window: &Window, event: &WindowEvent) {
        if !matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_)) {
            return;
        }
        let Ok(position) = window.outer_position() else {
            return;
        };
        let Ok(size) = window.outer_size() else {
            return;
        };
        let maximized = window.is_maximized().unwrap_or(false);
        let state = StoredWindowState {
            width: size.width,
            height: size.height,
            x: position.x,
            y: position.y,
            maximized,
        };
        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        let tracker = self.generation.clone();
        let path = self.path.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(400));
            if tracker.load(Ordering::SeqCst) != generation {
                return;
            }
            if let Ok(document) = serde_json::to_vec_pretty(&state) {
                let _ = fs::write(path, document);
            }
        });
    }
}

pub fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
