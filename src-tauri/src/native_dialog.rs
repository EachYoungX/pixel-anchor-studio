#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[cfg_attr(not(windows), allow(dead_code))]
pub enum DependencyChoice {
    Install,
    Download,
    Exit,
}

pub fn show_portable_not_writable(path: &std::path::Path, detail: &str) -> bool {
    let message = format!(
        "当前目录不可写。请先完整解压程序，并将文件夹移动到普通可写目录，例如 D:\\Apps 或个人文件夹。请勿直接从压缩包内运行，也不要放入 Program Files 等受保护目录。\n\n目录：{}\n{}\n\n选择“是”打开当前文件夹；选择“否”退出。",
        path.display(), detail
    );
    question(&message, "锚点像素工作台", true)
}

pub fn show_missing_webview2(detail: Option<&str>) -> DependencyChoice {
    let suffix = detail
        .map(|value| format!("\n\n检测详情：{value}"))
        .unwrap_or_default();
    let message = format!(
        "锚点像素工作台需要 Microsoft Edge WebView2 Runtime 显示应用界面。该组件由微软提供，并被许多 Windows 应用共同使用。当前系统未检测到可用组件。\n\n安装过程需要连接微软服务器；安装完成后，本工具本身可以离线使用。\n\n选择“是”安装 WebView2；选择“否”打开微软下载页面；选择“取消”退出。{suffix}"
    );
    three_way_question(&message, "需要 Microsoft Edge WebView2 Runtime")
}

pub fn show_error(message: &str) {
    message_box(message, "锚点像素工作台");
}

pub fn open_path(path: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("无法打开路径：{error}"))
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Ok(())
    }
}

pub fn open_url(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("无法打开网页：{error}"))
    }
    #[cfg(not(windows))]
    {
        let _ = url;
        Ok(())
    }
}

fn question(message: &str, title: &str, default_yes: bool) -> bool {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONWARNING, MB_YESNO,
        };
        let flags = MB_YESNO | MB_ICONWARNING | if default_yes { 0 } else { MB_DEFBUTTON2 };
        unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                wide(message).as_ptr(),
                wide(title).as_ptr(),
                flags,
            ) == IDYES
        }
    }
    #[cfg(not(windows))]
    {
        eprintln!("{title}: {message}");
        default_yes
    }
}

fn three_way_question(message: &str, title: &str) -> DependencyChoice {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            MessageBoxW, IDCANCEL, IDNO, IDYES, MB_ICONWARNING, MB_YESNOCANCEL,
        };
        match unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                wide(message).as_ptr(),
                wide(title).as_ptr(),
                MB_YESNOCANCEL | MB_ICONWARNING,
            )
        } {
            IDYES => DependencyChoice::Install,
            IDNO => DependencyChoice::Download,
            IDCANCEL | _ => DependencyChoice::Exit,
        }
    }
    #[cfg(not(windows))]
    {
        eprintln!("{title}: {message}");
        DependencyChoice::Exit
    }
}

fn message_box(message: &str, title: &str) {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
        unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                wide(message).as_ptr(),
                wide(title).as_ptr(),
                MB_OK | MB_ICONERROR,
            );
        }
    }
    #[cfg(not(windows))]
    {
        eprintln!("{title}: {message}");
    }
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}
