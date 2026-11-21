#![allow(dead_code)] // Win32 ABI fields are read by the operating system, not Rust.

use std::ffi::c_void;
use std::mem::zeroed;
use std::ptr::{null, null_mut};

type Hwnd = *mut c_void;
type Hinstance = *mut c_void;
type Hmenu = *mut c_void;
type Hbrush = *mut c_void;
type Hicon = *mut c_void;
type Hcursor = *mut c_void;
type Wparam = usize;
type Lparam = isize;
type Lresult = isize;

const WS_OVERLAPPEDWINDOW: u32 = 0x00CF_0000;
const WS_VISIBLE: u32 = 0x1000_0000;
const WS_CHILD: u32 = 0x4000_0000;
const WS_TABSTOP: u32 = 0x0001_0000;
const WS_BORDER: u32 = 0x0080_0000;
const WS_EX_CLIENTEDGE: u32 = 0x0000_0200;
const CW_USEDEFAULT: i32 = 0x8000_0000u32 as i32;
const SW_SHOW: i32 = 5;
const WM_DESTROY: u32 = 0x0002;
const WM_COMMAND: u32 = 0x0111;
const WM_CREATE: u32 = 0x0001;
const WM_CLOSE: u32 = 0x0010;
const ID_DASHBOARD: usize = 101;
const ID_PLANNING: usize = 102;
const ID_RESERVATIONS: usize = 103;
const ID_SETTINGS: usize = 104;

#[repr(C)]
struct Point {
    x: i32,
    y: i32,
}

#[repr(C)]
struct WndClassW {
    style: u32,
    lpfn_wnd_proc: Option<unsafe extern "system" fn(Hwnd, u32, Wparam, Lparam) -> Lresult>,
    cb_cls_extra: i32,
    cb_wnd_extra: i32,
    h_instance: Hinstance,
    h_icon: Hicon,
    h_cursor: Hcursor,
    hbr_background: Hbrush,
    lpsz_menu_name: *const u16,
    lpsz_class_name: *const u16,
}

#[repr(C)]
struct Msg {
    hwnd: Hwnd,
    message: u32,
    w_param: Wparam,
    l_param: Lparam,
    time: u32,
    pt: Point,
    private: u32,
}

#[link(name = "user32")]
unsafe extern "system" {
    fn RegisterClassW(class: *const WndClassW) -> u16;
    fn CreateWindowExW(
        ex_style: u32,
        class_name: *const u16,
        window_name: *const u16,
        style: u32,
        x: i32,
        y: i32,
        width: i32,
        height: i32,
        parent: Hwnd,
        menu: Hmenu,
        instance: Hinstance,
        param: *mut c_void,
    ) -> Hwnd;
    fn DefWindowProcW(hwnd: Hwnd, message: u32, w_param: Wparam, l_param: Lparam) -> Lresult;
    fn ShowWindow(hwnd: Hwnd, command: i32) -> i32;
    fn UpdateWindow(hwnd: Hwnd) -> i32;
    fn GetMessageW(message: *mut Msg, hwnd: Hwnd, min: u32, max: u32) -> i32;
    fn TranslateMessage(message: *const Msg) -> i32;
    fn DispatchMessageW(message: *const Msg) -> Lresult;
    fn PostQuitMessage(exit_code: i32);
    fn MessageBoxW(hwnd: Hwnd, text: *const u16, caption: *const u16, kind: u32) -> i32;
}

#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetModuleHandleW(module_name: *const u16) -> Hinstance;
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

pub fn run() -> Result<(), String> {
    unsafe {
        let instance = GetModuleHandleW(null());
        if instance.is_null() {
            return Err("GetModuleHandleW returned NULL".into());
        }

        let class_name = wide("AppointmentNativeWindow");
        let title = wide("Appointment PMS — Native Windows");
        let class = WndClassW {
            style: 0,
            lpfn_wnd_proc: Some(window_proc),
            cb_cls_extra: 0,
            cb_wnd_extra: 0,
            h_instance: instance,
            h_icon: null_mut(),
            h_cursor: null_mut(),
            hbr_background: 6usize as Hbrush,
            lpsz_menu_name: null(),
            lpsz_class_name: class_name.as_ptr(),
        };
        if RegisterClassW(&class) == 0 {
            return Err("RegisterClassW failed".into());
        }

        let hwnd = CreateWindowExW(
            0,
            class_name.as_ptr(),
            title.as_ptr(),
            WS_OVERLAPPEDWINDOW | WS_VISIBLE,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            1180,
            760,
            null_mut(),
            null_mut(),
            instance,
            null_mut(),
        );
        if hwnd.is_null() {
            return Err("CreateWindowExW failed".into());
        }

        ShowWindow(hwnd, SW_SHOW);
        UpdateWindow(hwnd);
        let mut message: Msg = zeroed();
        loop {
            let result = GetMessageW(&mut message, null_mut(), 0, 0);
            if result == -1 {
                return Err("GetMessageW failed".into());
            }
            if result == 0 {
                break;
            }
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }
    Ok(())
}

unsafe extern "system" fn window_proc(
    hwnd: Hwnd,
    message: u32,
    w_param: Wparam,
    l_param: Lparam,
) -> Lresult {
    match message {
        WM_CREATE => {
            create_label(hwnd, "Appointment PMS", 34, 24, 420, 42);
            create_label(
                hwnd,
                "Application Windows native — Rust / Win32",
                36,
                72,
                600,
                26,
            );
            create_label(hwnd, "Modules", 36, 142, 240, 28);
            create_button(hwnd, "Dashboard", ID_DASHBOARD, 36, 184, 190, 42);
            create_button(hwnd, "Planning", ID_PLANNING, 36, 236, 190, 42);
            create_button(hwnd, "Reservations", ID_RESERVATIONS, 36, 288, 190, 42);
            create_button(hwnd, "Settings", ID_SETTINGS, 36, 340, 190, 42);
            create_label(hwnd, "Native foundation initialized. PMS modules are migrated incrementally; this build is not yet feature-parity.", 270, 190, 820, 54);
            create_label(
                hwnd,
                "Runtime: Win32 | Browser: none | WebView: none",
                270,
                250,
                820,
                30,
            );
            create_label(
                hwnd,
                "SQLite local database is initialized; PMS screens and remote sync are not connected yet.",
                270,
                292,
                820,
                42,
            );
            create_label(hwnd, "Status: native shell", 36, 660, 360, 28);
            0
        }
        WM_COMMAND => {
            let control_id = w_param & 0xffff;
            let message_text = match control_id {
                ID_DASHBOARD => "Dashboard module is scheduled for native migration.",
                ID_PLANNING => "Planning module is scheduled for native migration.",
                ID_RESERVATIONS => "Reservations module is scheduled for native migration.",
                ID_SETTINGS => "Native settings module is scheduled for native migration.",
                _ => "",
            };
            if !message_text.is_empty() {
                let body = wide(message_text);
                let caption = wide("Appointment PMS");
                MessageBoxW(hwnd, body.as_ptr(), caption.as_ptr(), 0x40);
            }
            0
        }
        WM_CLOSE | WM_DESTROY => {
            PostQuitMessage(0);
            0
        }
        _ => DefWindowProcW(hwnd, message, w_param, l_param),
    }
}

unsafe fn create_label(parent: Hwnd, text: &str, x: i32, y: i32, width: i32, height: i32) {
    let class = wide("STATIC");
    let text = wide(text);
    CreateWindowExW(
        0,
        class.as_ptr(),
        text.as_ptr(),
        WS_CHILD | WS_VISIBLE,
        x,
        y,
        width,
        height,
        parent,
        null_mut(),
        GetModuleHandleW(null()),
        null_mut(),
    );
}

unsafe fn create_button(
    parent: Hwnd,
    text: &str,
    id: usize,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) {
    let class = wide("BUTTON");
    let text = wide(text);
    CreateWindowExW(
        WS_EX_CLIENTEDGE,
        class.as_ptr(),
        text.as_ptr(),
        WS_CHILD | WS_VISIBLE | WS_TABSTOP | WS_BORDER,
        x,
        y,
        width,
        height,
        parent,
        id as Hmenu,
        GetModuleHandleW(null()),
        null_mut(),
    );
}

#[cfg(test)]
mod tests {
    #[test]
    fn application_identity_is_stable() {
        assert_eq!(env!("CARGO_PKG_NAME"), "appointment-pms-native");
        assert_eq!(env!("CARGO_PKG_VERSION"), "1.2.0");
    }
}
