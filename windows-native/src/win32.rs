#![allow(dead_code)] // Win32 ABI fields are read by the operating system, not Rust.

use std::collections::HashMap;
use std::ffi::c_void;
use std::mem::zeroed;
use std::ptr::{null, null_mut};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;

use crate::database::PmsDatabase;
use crate::p2p_discovery::{DiscoveredPeer, DiscoveryEvent, LanDiscovery};
use crate::supabase_auth::{AuthOutcome, SupabaseAuthClient};
use crate::supabase_sync::{sync_bookings, BookingSyncSummary};

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
const WM_TIMER: u32 = 0x0113;
const DISCOVERY_TIMER_ID: usize = 1;

const ID_EMAIL: usize = 101;
const ID_PASSWORD: usize = 102;
const ID_SIGN_IN: usize = 103;
const ID_SIGN_UP: usize = 104;
const ID_SIGN_OUT: usize = 105;
const ID_STATUS: usize = 106;
const ID_PUSH_SYNC: usize = 107;
const ID_DISCOVERY_STATUS: usize = 108;

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
    fn SetTimer(hwnd: Hwnd, timer_id: usize, elapse: u32, callback: *mut c_void) -> usize;
    fn KillTimer(hwnd: Hwnd, timer_id: usize) -> i32;
}

#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetModuleHandleW(module_name: *const u16) -> Hinstance;
}

struct AppState {
    client: Option<SupabaseAuthClient>,
    database: Option<Arc<Mutex<PmsDatabase>>>,
    workspace_id: Option<String>,
    busy: bool,
    authenticated: bool,
    discovery: Option<LanDiscovery>,
    discovery_error: Option<String>,
    discovered_peers: HashMap<String, DiscoveredPeer>,
}
static APP_STATE: OnceLock<Mutex<AppState>> = OnceLock::new();

enum AuthTask {
    Restore,
    SignIn { email: String, password: String },
    SignUp { email: String, password: String },
    SignOut,
    SyncBookings { workspace_id: String, limit: u32 },
}
enum AuthUiOutcome {
    NoSession,
    Authenticated {
        user_id: String,
        email: Option<String>,
        workspace_id: String,
        workspace_name: String,
        role: String,
    },
    WorkspaceUnavailable {
        user_id: String,
        email: Option<String>,
        error: String,
    },
    ConfirmationRequired {
        email: String,
    },
    SignedOut,
    SyncCompleted(BookingSyncSummary),
    SyncFailed {
        error: String,
    },
}
struct WorkerCompletion {
    client: Option<SupabaseAuthClient>,
    result: Result<AuthUiOutcome, String>,
}

fn app_state() -> &'static Mutex<AppState> {
    APP_STATE.get_or_init(|| {
        Mutex::new(AppState {
            client: None,
            database: None,
            workspace_id: None,
            busy: false,
            authenticated: false,
            discovery: None,
            discovery_error: None,
            discovered_peers: HashMap::new(),
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

pub fn run(database: PmsDatabase, node_id: String) -> Result<(), String> {
    {
        let mut state = app_state().lock().unwrap_or_else(|e| e.into_inner());
        state.database = Some(Arc::new(Mutex::new(database)));
    }
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

        {
            let mut state = app_state().lock().unwrap_or_else(|e| e.into_inner());
            match LanDiscovery::start(&node_id) {
                Ok(discovery) => state.discovery = Some(discovery),
                Err(error) => state.discovery_error = Some(error),
            }
        }
        SetTimer(hwnd, DISCOVERY_TIMER_ID, 1000, null_mut());
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
            create_button(
                hwnd,
                "Synchroniser les réservations",
                ID_PUSH_SYNC,
                238,
                318,
                240,
                42,
            );
            create_status_label(hwnd, 44, 382, 800, 78);
            create_discovery_label(hwnd, 44, 510, 800, 28);
            show_control(hwnd, ID_SIGN_OUT, false);
            show_control(hwnd, ID_PUSH_SYNC, false);
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
                    let empty = wide("");
                    SetWindowTextW(GetDlgItem(hwnd, ID_PASSWORD as i32), empty.as_ptr());
                    let task = if control_id == ID_SIGN_IN {
                        AuthTask::SignIn { email, password }
                    } else {
                        AuthTask::SignUp { email, password }
                    };
                    start_auth_task_from_state(hwnd, task);
                }
                ID_SIGN_OUT => start_auth_task_from_state(hwnd, AuthTask::SignOut),
                ID_PUSH_SYNC => {
                    let workspace_id = app_state()
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .workspace_id
                        .clone();
                    if let Some(workspace_id) = workspace_id {
                        start_auth_task_from_state(
                            hwnd,
                            AuthTask::SyncBookings {
                                workspace_id,
                                limit: 50,
                            },
                        );
                    }
                }
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
                match &completion.result {
                    Ok(AuthUiOutcome::Authenticated { workspace_id, .. }) => {
                        state.workspace_id = Some(workspace_id.clone());
                        state.authenticated = true;
                    }
                    Ok(AuthUiOutcome::WorkspaceUnavailable { .. }) => {
                        state.workspace_id = None;
                        state.authenticated = true;
                    }
                    Ok(AuthUiOutcome::SyncCompleted(_) | AuthUiOutcome::SyncFailed { .. }) => {
                        state.authenticated = true;
                    }
                    _ => {
                        state.workspace_id = None;
                        state.authenticated = false;
                    }
                }
            }
            set_busy(hwnd, false);
            match completion.result {
                Ok(AuthUiOutcome::NoSession) => {
                    show_login(hwnd, true);
                    set_status(
                        hwnd,
                        "Aucune session enregistrée. Connectez-vous pour continuer.",
                    );
                }
                Ok(AuthUiOutcome::Authenticated {
                    user_id,
                    email,
                    workspace_id,
                    workspace_name,
                    role,
                }) => {
                    show_login(hwnd, false);
                    show_control(hwnd, ID_SIGN_OUT, true);
                    show_control(hwnd, ID_PUSH_SYNC, true);
                    let identity = email.unwrap_or(user_id);
                    set_status(
                        hwnd,
                        &format!(
                            "Authentifié : {identity}\nWorkspace vérifié par RLS : {workspace_name} ({workspace_id}) — rôle {role}."
                        ),
                    );
                }
                Ok(AuthUiOutcome::WorkspaceUnavailable {
                    user_id,
                    email,
                    error,
                }) => {
                    show_login(hwnd, false);
                    show_control(hwnd, ID_SIGN_OUT, true);
                    show_control(hwnd, ID_PUSH_SYNC, false);
                    let identity = email.unwrap_or(user_id);
                    set_status(
                        hwnd,
                        &format!(
                            "Compte authentifié : {identity}\nWorkspace non vérifié : {error}\nDonnées locales uniquement."
                        ),
                    );
                }
                Ok(AuthUiOutcome::ConfirmationRequired { email }) => {
                    show_login(hwnd, true);
                    set_status(
                        hwnd,
                        &format!(
                            "Compte créé pour {email}. Vérifiez votre e-mail avant la connexion."
                        ),
                    );
                }
                Ok(AuthUiOutcome::SignedOut) => {
                    show_login(hwnd, true);
                    set_status(
                        hwnd,
                        "Session fermée. Les données locales restent sur cet appareil.",
                    );
                }
                Ok(AuthUiOutcome::SyncCompleted(summary)) => {
                    show_login(hwnd, false);
                    show_control(hwnd, ID_SIGN_OUT, true);
                    show_control(hwnd, ID_PUSH_SYNC, true);
                    let pull_status = match summary.pull_error.as_deref() {
                        Some(error) => format!("Pull en erreur : {error}"),
                        None => format!(
                            "Pull : {} reçues, {} appliquées, {} protégées par Outbox, {} tombstones conservés, {} déjà à jour.",
                            summary.pull.received,
                            summary.pull.applied,
                            summary.pull.skipped_pending,
                            summary.pull.skipped_tombstone,
                            summary.pull.stale
                        ),
                    };
                    if summary.push.acknowledged == 0
                        && summary.push.retry_scheduled == 0
                        && summary.push.conflicts == 0
                        && summary.pull.received == 0
                        && summary.pull_error.is_none()
                    {
                        set_status(
                            hwnd,
                            "Réservations : aucun changement à envoyer ni nouvelle ligne distante à importer.",
                        );
                    } else {
                        set_status(
                            hwnd,
                            &format!(
                                "Réservations — Push ACK : {}, réessais : {}, conflits : {}. {}",
                                summary.push.acknowledged,
                                summary.push.retry_scheduled,
                                summary.push.conflicts,
                                pull_status
                            ),
                        );
                    }
                }
                Ok(AuthUiOutcome::SyncFailed { error }) => {
                    show_login(hwnd, false);
                    show_control(hwnd, ID_SIGN_OUT, true);
                    show_control(hwnd, ID_PUSH_SYNC, true);
                    set_status(
                        hwnd,
                        &format!(
                            "Synchronisation des réservations interrompue : {error}\nSession conservée. Les autres domaines PMS ne sont pas synchronisés."
                        ),
                    );
                }
                Err(error) => {
                    show_login(hwnd, true);
                    set_status(hwnd, &format!("Erreur d’authentification : {error}"));
                }
            }
            0
        }
        WM_TIMER if w_param == DISCOVERY_TIMER_ID => {
            update_discovery_status(hwnd);
            0
        }
        WM_CLOSE | WM_DESTROY => {
            KillTimer(hwnd, DISCOVERY_TIMER_ID);
            if let Ok(mut state) = app_state().lock() {
                state.discovery = None;
                state.discovered_peers.clear();
            }
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
    let database = app_state()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .database
        .clone();
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
                    Ok(Some(session)) => {
                        let user_id = session.user_id.clone();
                        let email = session.email.clone();
                        Ok(resolve_authenticated_outcome(
                            &mut client,
                            &database,
                            user_id,
                            email,
                        ))
                    }
                    Ok(None) => Ok(AuthUiOutcome::NoSession),
                    Err(error) => Err(error),
                },
                AuthTask::SignIn { email, password } => {
                    let result = client.sign_in(&email, &password);
                    map_auth_outcome(&mut client, &database, result, &email)
                }
                AuthTask::SignUp { email, password } => {
                    let result = client.sign_up(&email, &password);
                    map_auth_outcome(&mut client, &database, result, &email)
                }
                AuthTask::SignOut => client.sign_out().map(|_| AuthUiOutcome::SignedOut),
                AuthTask::SyncBookings {
                    workspace_id,
                    limit,
                } => match database.as_ref() {
                    Some(database) => match sync_bookings(
                        &mut client,
                        database.as_ref(),
                        &workspace_id,
                        limit,
                        200,
                    ) {
                        Ok(summary) => Ok(AuthUiOutcome::SyncCompleted(summary)),
                        Err(error) => Ok(AuthUiOutcome::SyncFailed { error }),
                    },
                    None => Ok(AuthUiOutcome::SyncFailed {
                        error: "La base SQLite locale n’est pas disponible.".into(),
                    }),
                },
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
        set_status(
            hwnd,
            "Impossible de démarrer le processus d’authentification.",
        );
    }
}

fn resolve_authenticated_outcome(
    client: &mut SupabaseAuthClient,
    database: &Option<Arc<Mutex<PmsDatabase>>>,
    user_id: String,
    email: Option<String>,
) -> AuthUiOutcome {
    match client.resolve_personal_workspace() {
        Ok(workspace) => {
            let local_result = (|| -> Result<(), String> {
                let database = database
                    .as_ref()
                    .ok_or_else(|| "La base SQLite locale n’est pas disponible.".to_string())?;
                let local = database
                    .lock()
                    .map_err(|_| "Le verrou SQLite local est indisponible.".to_string())?;
                local
                    .ensure_workspace(&workspace.id, &user_id, &workspace.name)
                    .map_err(|error| {
                        format!("Impossible d’initialiser le workspace local : {error}")
                    })?;
                let owner_matches = local
                    .workspace_is_owned_by(&workspace.id, &user_id)
                    .map_err(|error| {
                        format!("Impossible de vérifier le propriétaire local : {error}")
                    })?;
                if !owner_matches {
                    return Err("Le workspace SQLite local appartient à un autre compte.".into());
                }
                Ok(())
            })();
            match local_result {
                Ok(()) => AuthUiOutcome::Authenticated {
                    user_id,
                    email,
                    workspace_id: workspace.id,
                    workspace_name: workspace.name,
                    role: workspace.role,
                },
                Err(error) => AuthUiOutcome::WorkspaceUnavailable {
                    user_id,
                    email,
                    error,
                },
            }
        }
        Err(error) => AuthUiOutcome::WorkspaceUnavailable {
            user_id,
            email,
            error,
        },
    }
}

fn map_auth_outcome(
    client: &mut SupabaseAuthClient,
    database: &Option<Arc<Mutex<PmsDatabase>>>,
    result: Result<AuthOutcome, String>,
    submitted_email: &str,
) -> Result<AuthUiOutcome, String> {
    match result? {
        AuthOutcome::Authenticated { user_id, email } => Ok(resolve_authenticated_outcome(
            client, database, user_id, email,
        )),
        AuthOutcome::EmailConfirmationRequired { .. } => Ok(AuthUiOutcome::ConfirmationRequired {
            email: submitted_email.to_string(),
        }),
    }
}

fn post_completion(hwnd_value: usize, completion: WorkerCompletion) {
    let raw = Box::into_raw(Box::new(completion));
    let posted = unsafe { PostMessageW(hwnd_value as Hwnd, WM_APP_AUTH_COMPLETE, raw as usize, 0) };
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

unsafe fn create_discovery_label(parent: Hwnd, x: i32, y: i32, width: i32, height: i32) {
    let class = wide("STATIC");
    let text = wide("Réseau local : démarrage de la découverte P2P…");
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
        ID_DISCOVERY_STATUS as Hmenu,
        GetModuleHandleW(null()),
        null_mut(),
    );
}

fn update_discovery_status(hwnd: Hwnd) {
    let (peers, error) = {
        let mut state = app_state().lock().unwrap_or_else(|e| e.into_inner());
        let mut events = Vec::new();
        if let Some(discovery) = state.discovery.as_ref() {
            while let Ok(event) = discovery.try_recv() {
                events.push(event);
            }
        }
        for event in events {
            match event {
                DiscoveryEvent::PeerFound(peer) => {
                    state.discovered_peers.insert(peer.peer_id.clone(), peer);
                }
                DiscoveryEvent::PeerExpired { peer_id } => {
                    state.discovered_peers.remove(&peer_id);
                }
                DiscoveryEvent::Failed { message } => {
                    state.discovery_error = Some(message);
                    state.discovered_peers.clear();
                }
            }
        }
        (
            state.discovered_peers.values().cloned().collect::<Vec<_>>(),
            state.discovery_error.clone(),
        )
    };

    unsafe {
        let control = GetDlgItem(hwnd, ID_DISCOVERY_STATUS as i32);
        if !control.is_null() {
            let text = match error {
                Some(error) => format!("Réseau local : découverte indisponible — {error}"),
                None if peers.is_empty() => {
                    "Réseau local : aucun pair Appointment détecté.".to_string()
                }
                None => {
                    let mut names = peers
                        .iter()
                        .take(5)
                        .map(|peer| format!("{} ({})", peer.peer_name, peer.address.ip()))
                        .collect::<Vec<_>>();
                    if peers.len() > 5 {
                        names.push(format!("+{} autre(s)", peers.len() - 5));
                    }
                    format!(
                        "Pairs LAN détectés : {}. Présence uniquement — transport métier P2P non activé, aucune synchronisation confirmée.",
                        names.join(" · ")
                    )
                }
            };
            let text = wide(&text);
            SetWindowTextW(control, text.as_ptr());
        }
    }
}

unsafe fn create_edit(
    parent: Hwnd,
    id: usize,
    password: bool,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) {
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
        show_control(hwnd, ID_PUSH_SYNC, false);
    }
}

fn set_busy(hwnd: Hwnd, busy: bool) {
    unsafe {
        for id in [
            ID_EMAIL,
            ID_PASSWORD,
            ID_SIGN_IN,
            ID_SIGN_UP,
            ID_SIGN_OUT,
            ID_PUSH_SYNC,
        ] {
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
        let version = env!("CARGO_PKG_VERSION");
        let components: Vec<_> = version.split('.').collect();
        assert_eq!(components.len(), 3, "release version must use MAJOR.MINOR.PATCH");
        assert!(
            components
                .iter()
                .all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit())),
            "release version must contain numeric components"
        );
    }
}
