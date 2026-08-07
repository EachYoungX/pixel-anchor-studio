use crate::DesktopState;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, FilePath};
use uuid::Uuid;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformFilePayload {
    name: String,
    mime: String,
    data: Vec<u8>,
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBinaryRequest {
    data: Vec<u8>,
    suggested_name: String,
    extensions: Vec<String>,
    description: String,
    current_path: Option<String>,
    force_dialog: bool,
    project_file: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBinaryResponse {
    status: &'static str,
    path: Option<String>,
}

#[tauri::command]
pub fn pick_image(app: AppHandle) -> Result<Option<PlatformFilePayload>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter(
            "图片",
            &["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp", "svg"],
        )
        .blocking_pick_file();
    picked.map(read_file_path).transpose()
}

#[tauri::command]
pub fn open_project(
    app: AppHandle,
    state: tauri::State<'_, DesktopState>,
) -> Result<Option<PlatformFilePayload>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Pixel Anchor 项目", &["json"])
        .blocking_pick_file();
    let payload = picked.map(read_file_path).transpose()?;
    if let Some(file) = payload.as_ref() {
        let mut pending = state.pending_project_paths.lock();
        pending.clear();
        pending.insert(PathBuf::from(&file.path));
    }
    Ok(payload)
}

#[tauri::command]
pub fn read_dropped_file(
    path: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<PlatformFilePayload, String> {
    let requested = PathBuf::from(path);
    let canonical = requested
        .canonicalize()
        .map_err(|error| format!("无法读取拖入文件：{error}"))?;
    if !state.approved_drop_paths.lock().remove(&canonical) {
        return Err("该文件不是当前拖放操作授权的文件".to_string());
    }
    let payload = read_path(&canonical)?;
    if canonical
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("json"))
    {
        let mut pending = state.pending_project_paths.lock();
        pending.clear();
        pending.insert(canonical);
    }
    Ok(payload)
}

#[tauri::command]
pub fn save_binary(
    app: AppHandle,
    request: SaveBinaryRequest,
    state: tauri::State<'_, DesktopState>,
) -> Result<SaveBinaryResponse, String> {
    let trusted_current = request.current_path.as_ref().and_then(|path| {
        let candidate = PathBuf::from(path);
        let current = state.current_project_path.lock();
        (current.as_ref() == Some(&candidate)).then_some(candidate)
    });
    let target = if !request.force_dialog {
        trusted_current
    } else {
        None
    };
    let target = match target {
        Some(path) => Some(path),
        None => {
            let extensions = request
                .extensions
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>();
            app.dialog()
                .file()
                .set_file_name(&request.suggested_name)
                .add_filter(&request.description, &extensions)
                .blocking_save_file()
                .map(file_path_to_path)
                .transpose()?
        }
    };
    let Some(target) = target else {
        return Ok(SaveBinaryResponse {
            status: "cancelled",
            path: None,
        });
    };
    write_atomic(&target, &request.data)?;
    if request.project_file {
        *state.current_project_path.lock() = Some(target.clone());
    }
    Ok(SaveBinaryResponse {
        status: "saved",
        path: Some(target.to_string_lossy().into_owned()),
    })
}

#[tauri::command]
pub fn adopt_project_path(
    path: Option<String>,
    state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
    let Some(path) = path else {
        *state.current_project_path.lock() = None;
        state.pending_project_paths.lock().clear();
        return Ok(());
    };
    let candidate = PathBuf::from(path);
    if !state.pending_project_paths.lock().remove(&candidate) {
        return Err("项目路径未经过当前打开或拖放操作授权".to_string());
    }
    *state.current_project_path.lock() = Some(candidate);
    Ok(())
}

fn read_file_path(path: FilePath) -> Result<PlatformFilePayload, String> {
    read_path(&file_path_to_path(path)?)
}

fn file_path_to_path(path: FilePath) -> Result<PathBuf, String> {
    path.into_path()
        .map_err(|error| format!("不支持该文件路径：{error}"))
}

fn read_path(path: &Path) -> Result<PlatformFilePayload, String> {
    if !path.is_file() {
        return Err(format!("不是可读取文件：{}", path.display()));
    }
    let data = fs::read(path).map_err(|error| format!("无法读取 {}：{error}", path.display()))?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("file")
        .to_string();
    let mime = mime_guess::from_path(path)
        .first_or_octet_stream()
        .essence_str()
        .to_string();
    Ok(PlatformFilePayload {
        name,
        mime,
        data,
        path: path.to_string_lossy().into_owned(),
    })
}

fn write_atomic(target: &Path, data: &[u8]) -> Result<(), String> {
    let parent = target
        .parent()
        .ok_or_else(|| "保存路径缺少父目录".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("无法创建保存目录：{error}"))?;
    let temp = parent.join(format!(".pixel-anchor-{}.tmp", Uuid::new_v4()));
    let write_result = (|| -> Result<(), String> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp)
            .map_err(|error| format!("无法创建临时文件：{error}"))?;
        file.write_all(data)
            .map_err(|error| format!("无法写入临时文件：{error}"))?;
        file.sync_all()
            .map_err(|error| format!("无法同步临时文件：{error}"))?;
        drop(file);
        replace_file(&temp, target)
    })();
    if write_result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    write_result
}

#[cfg(windows)]
fn replace_file(temp: &Path, target: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let source = temp
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let destination = target
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(format!(
            "无法原子替换目标文件：{}",
            std::io::Error::last_os_error()
        ))
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file(temp: &Path, target: &Path) -> Result<(), String> {
    fs::rename(temp, target).map_err(|error| format!("无法替换目标文件：{error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_replaces_existing_content() {
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("project.json");
        fs::write(&target, b"old").unwrap();
        write_atomic(&target, b"new").unwrap();
        assert_eq!(fs::read(target).unwrap(), b"new");
    }
}
