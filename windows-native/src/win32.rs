#![allow(dead_code)] // Win32 ABI fields are read by the operating system, not Rust.

use std::ffi::c_void;
use std::mem::zeroed;
use std::ptr::{null, null_mut};
use std::sync::{Mutex, OnceLock};
use std::thread;

use crate::supabase_auth::{AuthOutcome, SupabaseAuthClient};

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
const ES_AUTOHSCROLL: u32 = 0x0080;
const ES_PASSWORD: u32 = 0x0020;
const CW_USEDEFAULT: i32 = 0x8000_0000u32 as i32;
const SW_SHOW: i32 = 5;
const SW_HIDE: i32 = 0;
const WM_DESTROY: u32 = 0x0002;
const WM_COMMAND: u32 = 0x0111;
const WM_CREATE: u32 = 0x0001;
const WM_CLOSE: u32 = 0x0010;
const WM_APP_AUTH_COMPLETE: u32 = 0x8001;

const ID_EMAIL: usize = 101;
const ID_PASSWORD: usize = 102;
const ID_SIGN_IN: usize = 103;
const ID_SIGN_UP: usize = 104;
const ID_SIGN_OUT: usize = 105;
const ID_STATUS: usize = 106;

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
    fn PostMessageW(hwnd: Hwnd, message: u32, w_param: Wparam, l_param: Lparam) -> i32;
    fn MessageBoxW(hwnd: Hwnd, text: *const u16, caption: *const u16, kind: u32) -> i32;
    fn GetDlgItem(parent: Hwnd, id: i32) -> Hwnd;
    fn GetWindowTextLengthW(hwnd: Hwnd) -> i32;
    fn GetWindowTextW(hwnd: Hwnd, text: *mut u16, max_count: i32) -> i32;
    fn SetWindowTextW(hwnd: Hwnd, text: *const u16) -> i32;
    fn EnableWindow(hwnd: Hwnd, enable: i32) -> i32;
}

#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetModuleHandleW(module_name: *const u16) -> Hinstance;
}

struct AppState {
    client: Option<SupabaseAuthClient>,
    busy: bool,
    authenticated: bool,
}
static APP_STATE: OnceLock<Mutex<AppState>> = OnceLock::new();

enum AuthTask {
    Restore,
    SignIn { email: String, password: String },
    SignUp { email: String, password: String },
    SignOut,
}
enum AuthUiOutcome {
    NoSession,
    Restored { user_id: String, email: Option<String> },
    Authenticated { user_id: String, email: Option<String> },
    ConfirmationRequired { email: String },
    SignedOut,
}
struct WorkerCompletion {
    client: Option<SupabaseAuthClient>,
    result: Result<AuthUiOutcome, String>,
}

fn app_state() -> &'static Mutex<AppState> {
    APP_STATE.get_or_init(|| {
        Mutex::new(AppState {
            client: None,
            busy: false,
            authenticated: false,
        })
    })
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

pub fn show_error(message: &str) {
    unsafe {
        let body = wide(message);
        let caption = wide("Appointment PMS — Startup error");
        MessageBoxW(null_mut(), body.as_ptr(), caption.as_ptr(), 0x10);
    }
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
            900,
            620,
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
            create_label(hwnd, "Appointment PMS", 42, 34, 500, 42);
            create_label(
                hwnd,
                "Connexion native sécurisée — Rust / Win32 / Supabase Auth",
                44,
                82,
                700,
                28,
            );
            create_label(hwnd, "Adresse e-mail", 44, 154, 260, 24);
            create_edit(hwnd, ID_EMAIL, false, 44, 180, 390, 34);
            create_label(hwnd, "Mot de passe", 44, 232, 260, 24);
            create_edit(hwnd, ID_PASSWORD, true, 44, 258, 390, 34);
            create_button(hwnd, "Se connecter", ID_SIGN_IN, 44, 318, 180, 42);
            create_button(hwnd, "Créer un compte", ID_SIGN_UP, 238, 318, 196, 42);
            create_button(hwnd, "Se déconnecter", ID_SIGN_OUT, 44, 318, 180, 42);
            create_status_label(hwnd, 44, 394, 760, 58);
            show_control(hwnd, ID_SIGN_OUT, false);
            {
                let mut state = app_state().lock().unwrap_or_else(|e| e.into_inner());
                state.busy = true;
            }
            set_busy(hwnd, true);
            set_status(hwnd, "Restauration de session en cours…");
            start_auth_task(hwnd, AuthTask::Restore, None);
            0
        }
        WM_COMMAND => {
            let control_id = w_param & 0xffff;
            match control_id {
                ID_SIGN_IN | ID_SIGN_UP => {
                    let email = control_text(hwnd, ID_EMAIL);
                    let password = control_text(hwnd, ID_PASSWORD);
                    let task = if control_id == ID_SIGN_IN {
                        AuthTask::SignIn { email, password }
                    } else {
                        AuthTask::SignUp { email, password }
                    };
                    start_auth_task_from_state(hwnd, task);
                }
                ID_SIGN_OUT => start_auth_task_from_state(hwnd, AuthTask::SignOut),
                _ => {}
            }
            0
        }
        WM_APP_AUTH_COMPLETE => {
            let raw = w_param as *mut WorkerCompletion;
            if raw.is_null() {
                return 0;
            }
            let completion = *Box::from_raw(raw);
            {
                let mut state = app_state().lock().unwrap_or_else(|e| e.into_inner());
                state.client = completion.client;
                state.busy = false;
                state.authenticated = matches!(
                    &completion.result,
                    Ok(AuthUiOutcome::Restored { .. } | AuthUiOutcome::Authenticated { .. })
                );
            }
            set_busy(hwnd, false);
            match completion.result {
                Ok(AuthUiOutcome::NoSession) => {
                    show_login(hwnd, true);
                    set_status(hwnd, "Aucune session enregistrée. Connectez-vous pour continuer.");
                }
                Ok(AuthUiOutcome::Restored { user_id, email })
                | Ok(AuthUiOutcome::Authenticated { user_id, email }) => {
                    show_login(hwnd, false);
                    show_control(hwnd, ID_SIGN_OUT, true);
                    let identity = email.unwrap_or(user_id);
                    set_status(
                        hwnd,
                        &format!(
                            "Authentifié : {identity}\nAccès espace de travail non vérifié. Données locales uniquement."
                        ),
                    );
                }
                Ok(AuthUiOutcome::ConfirmationRequired { email }) => {
                    show_login(hwnd, true);
                    set_status(
                        hwnd,
                        &format!("Compte créé pour {email}. Vérifiez votre e-mail avant la connexion."),
                    );
                }
                Ok(AuthUiOutcome::SignedOut) => {
                    show_login(hwnd, true);
                    set_status(hwnd, "Session fermée. Les données locales restent sur cet appareil.");
                }
                Err(error) => {
                    show_login(hwnd, true);
                    set_status(hwnd, &format!("Erreur d’authentification : {error}"));
                }
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

fn start_auth_task_from_state(hwnd: Hwnd, task: AuthTask) {
    let client = {
        let mut state = app_state().lock().unwrap_or_else(|e| e.into_inner());
        if state.busy {
            return;
        }
        state.busy = true;
        state.client.take()
    };
    set_busy(hwnd, true);
    set_status(hwnd, "Communication avec Supabase…");
    start_auth_task(hwnd, task, client);
}

fn start_auth_task(hwnd: Hwnd, task: AuthTask, client: Option<SupabaseAuthClient>) {
    let hwnd_value = hwnd as usize;
    let spawn = thread::Builder::new()
        .name("appointment-auth".into())
        .spawn(move || {
            let mut client = match client {
                Some(client) => client,
                None => match SupabaseAuthClient::from_environment() {
                    Ok(client) => client,
                    Err(error) => {
                        post_completion(
                            hwnd_value,
                            WorkerCompletion {
                                client: None,
                                result: Err(error),
                            },
                        );
                        return;
                    }
                },
            };

            let result = match task {
                AuthTask::Restore => match client.restore_session() {
                    Ok(Some(session)) => Ok(AuthUiOutcome::Restored {
                        user_id: session.user_id.clone(),
                        email: session.email.clone(),
                    }),
                    Ok(None) => Ok(AuthUiOutcome::NoSession),
                    Err(error) => Err(error),
                },
                AuthTask::SignIn { email, password } => {
                    map_auth_outcome(client.sign_in(&email, &password), &email)
                }
                AuthTask::SignUp { email, password } => {
                    map_auth_outcome(client.sign_up(&email, &password), &email)
                }
                AuthTask::SignOut => client.sign_out().map(|_| AuthUiOutcome::SignedOut),
            };
            post_completion(
                hwnd_value,
                WorkerCompletion {
                    client: Some(client),
                    result,
                },
            );
        });

    if spawn.is_err() {
        {
            let mut state = app_state().lock().unwrap_or_else(|e| e.into_inner());
            state.busy = false;
            state.authenticated = false;
        }
        set_busy(hwnd, false);
        set_status(hwnd, "Impossible de démarrer le processus d’authentification.");
    }
}

fn map_auth_outcome(
    result: Result<AuthOutcome, String>,
    email: &str,
) -> Result<AuthUiOutcome, String> {
    match result? {
        AuthOutcome::Authenticated { user_id, email } => {
            Ok(AuthUiOutcome::Authenticated { user_id, email })
        }
        AuthOutcome::EmailConfirmationRequired { .. } => {
            Ok(AuthUiOutcome::ConfirmationRequired {
                email: email.to_string(),
            })
        }
    }
}

fn post_completion(hwnd_value: usize, completion: WorkerCompletion) {
    let raw = Box::into_raw(Box::new(completion));
    let posted = unsafe {
        PostMessageW(
            hwnd_value as Hwnd,
            WM_APP_AUTH_COMPLETE,
            raw as usize,
            0,
        )
    };
    if posted == 0 {
        unsafe { drop(Box::from_raw(raw)) };
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

unsafe fn create_status_label(parent: Hwnd, x: i32, y: i32, width: i32, height: i32) {
    let class = wide("STATIC");
    let text = wide("Initialisation…");
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
        ID_STATUS as Hmenu,
        GetModuleHandleW(null()),
        null_mut(),
    );
}

unsafe fn create_edit(parent: Hwnd, id: usize, password: bool, x: i32, y: i32, width: i32, height: i32) {
    let class = wide("EDIT");
    let mut style = WS_CHILD | WS_VISIBLE | WS_TABSTOP | WS_BORDER | ES_AUTOHSCROLL;
    if password {
        style |= ES_PASSWORD;
    }
    CreateWindowExW(
        WS_EX_CLIENTEDGE,
        class.as_ptr(),
        wide("").as_ptr(),
        style,
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

fn control_text(parent: Hwnd, id: usize) -> String {
    unsafe {
        let control = GetDlgItem(parent, id as i32);
        if control.is_null() {
            return String::new();
        }
        let length = GetWindowTextLengthW(control).max(0) as usize;
        let mut buffer = vec![0u16; length + 1];
        let copied = GetWindowTextW(control, buffer.as_mut_ptr(), buffer.len() as i32).max(0);
        String::from_utf16_lossy(&buffer[..copied as usize])
    }
}

fn set_status(hwnd: Hwnd, value: &str) {
    unsafe {
        let control = GetDlgItem(hwnd, ID_STATUS as i32);
        if !control.is_null() {
            let text = wide(value);
            SetWindowTextW(control, text.as_ptr());
        }
    }
}

fn show_control(hwnd: Hwnd, id: usize, visible: bool) {
    unsafe {
        let control = GetDlgItem(hwnd, id as i32);
        if !control.is_null() {
            ShowWindow(control, if visible { SW_SHOW } else { SW_HIDE });
        }
    }
}

fn show_login(hwnd: Hwnd, visible: bool) {
    for id in [ID_EMAIL, ID_PASSWORD, ID_SIGN_IN, ID_SIGN_UP] {
        show_control(hwnd, id, visible);
    }
    if visible {
        show_control(hwnd, ID_SIGN_OUT, false);
    }
}

fn set_busy(hwnd: Hwnd, busy: bool) {
    unsafe {
        for id in [ID_EMAIL, ID_PASSWORD, ID_SIGN_IN, ID_SIGN_UP, ID_SIGN_OUT] {
            let control = GetDlgItem(hwnd, id as i32);
            if !control.is_null() {
                EnableWindow(control, i32::from(!busy));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn application_identity_is_stable() {
        assert_eq!(env!("CARGO_PKG_NAME"), "appointment-pms-native");
        assert_eq!(env!("CARGO_PKG_VERSION"), "1.2.0");
    }
}
