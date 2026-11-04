#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::{fs, path::{Path, PathBuf}, time::{Duration, UNIX_EPOCH}};
use sqlx::postgres::PgPoolOptions;
use tauri::Emitter;

const KEYRING_SERVICE: &str = "com.connacri.appointment";
const MAX_MDB_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CardLockCandidate {
    path: String,
    modified_unix_ms: Option<u128>,
    size_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CardLockFileData {
    content_base64: String,
    modified_unix_ms: Option<u128>,
    size_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopRuntimeInfo {
    native: bool,
    filesystem: bool,
    windows_credential_manager: bool,
    runtime: &'static str,
}

fn candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    paths.push(PathBuf::from(r"C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb"));
    paths.push(PathBuf::from(r"C:\Program Files\proUSB lock system\CardLock.mdb"));

    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        paths.push(PathBuf::from(local_app_data).join(r"VirtualStore\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb"));
        paths.push(PathBuf::from(local_app_data).join(r"VirtualStore\Program Files\proUSB lock system\CardLock.mdb"));
    }
    paths
}

#[tauri::command]
fn desktop_runtime_info() -> DesktopRuntimeInfo {
    DesktopRuntimeInfo {
        native: true,
        filesystem: true,
        windows_credential_manager: cfg!(target_os = "windows"),
        runtime: "tauri-windows-native",
    }
}

#[tauri::command]
fn discover_cardlock_candidates() -> Vec<CardLockCandidate> {
    candidate_paths()
        .into_iter()
        .filter_map(|path| {
            let metadata = fs::metadata(&path).ok()?;
            if !metadata.is_file() { return None; }
            let modified_unix_ms = metadata.modified().ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis());
            Some(CardLockCandidate {
                path: path.to_string_lossy().into_owned(),
                modified_unix_ms,
                size_bytes: metadata.len(),
            })
        })
        .collect()
}

#[tauri::command]
fn read_cardlock_file(path: String) -> Result<CardLockFileData, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err("Le fichier CardLock sélectionné est introuvable.".into());
    }
    if !file_path.extension().and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("mdb"))
        .unwrap_or(false)
    {
        return Err("Sélectionnez un fichier de base Microsoft Access .mdb.".into());
    }
    let metadata = fs::metadata(file_path).map_err(|error| error.to_string())?;
    if metadata.len() == 0 || metadata.len() > MAX_MDB_BYTES {
        return Err("Taille CardLock.mdb invalide (maximum 512 Mo).".into());
    }
    let modified_unix_ms = metadata.modified().ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis());
    let bytes = fs::read(file_path).map_err(|error| format!("Lecture CardLock impossible : {error}"))?;
    Ok(CardLockFileData { content_base64: STANDARD.encode(bytes), modified_unix_ms, size_bytes: metadata.len() })
}

fn validate_secret_key(key: &str) -> Result<(), String> {
    match key {
        "supabase.publishable_key" | "supabase.anon_key" | "neon.connection_string" | "google.refresh_token" => Ok(()),
        _ => Err("Identifiant de credential non autorisé.".into()),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NeonConnectionStatus {
    connected: bool,
    server_version: String,
}

#[tauri::command]
async fn neon_test_connection(connection_string: String) -> Result<NeonConnectionStatus, String> {
    let normalized = connection_string.trim();
    if !(normalized.starts_with("postgresql://") || normalized.starts_with("postgres://")) {
        return Err("Format de chaîne PostgreSQL invalide.".into());
    }
    let lower = normalized.to_ascii_lowercase();
    let tls_required = lower.contains("sslmode=require")
        || lower.contains("sslmode=verify-ca")
        || lower.contains("sslmode=verify-full");
    if !tls_required {
        return Err("Connexion refusée : ajoutez sslmode=require ou un mode TLS avec vérification de certificat.".into());
    }

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(12))
        .connect(normalized)
        .await
        .map_err(|_| "Connexion Neon impossible. Vérifiez l'hôte, les identifiants, TLS et l'accès réseau.".to_string())?;

    let health_check = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&pool)
        .await
        .map_err(|_| "Connexion établie, mais le test SQL SELECT 1 a échoué.".to_string())?;
    if health_check != 1 { pool.close().await; return Err("Le test SQL de santé a retourné une valeur inattendue.".into()); }

    let server_version = sqlx::query_scalar::<_, String>("SHOW server_version")
        .fetch_one(&pool)
        .await
        .map_err(|_| "Connexion établie, mais lecture de la version PostgreSQL impossible.".to_string())?;
    pool.close().await;

    Ok(NeonConnectionStatus { connected: true, server_version })
}

#[tauri::command]
fn secure_secret_set(key: String, value: String) -> Result<(), String> {
    validate_secret_key(&key)?;
    if value.trim().is_empty() { return Err("Une valeur non vide est requise.".into()); }
    #[cfg(target_os = "windows")]
    {
        let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| format!("Windows Credential Manager indisponible : {e}"))?;
        entry.set_password(&value).map_err(|e| format!("Écriture Credential Manager impossible : {e}"))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = value; Err("Le stockage sécurisé natif est disponible dans le runtime Windows uniquement.".into()) }
}

#[tauri::command]
fn secure_secret_exists(key: String) -> Result<bool, String> {
    validate_secret_key(&key)?;
    #[cfg(target_os = "windows")]
    {
        let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| format!("Windows Credential Manager indisponible : {e}"))?;
        match entry.get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(error) => Err(format!("Vérification Credential Manager impossible : {error}")),
        }
    }
    #[cfg(not(target_os = "windows"))]
    { Err("Le stockage sécurisé natif est disponible dans le runtime Windows uniquement.".into()) }
}

#[tauri::command]
fn secure_secret_delete(key: String) -> Result<(), String> {
    validate_secret_key(&key)?;
    #[cfg(target_os = "windows")]
    {
        let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| format!("Windows Credential Manager indisponible : {e}"))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!("Suppression Credential Manager impossible : {error}")),
        }
    }
    #[cfg(not(target_os = "windows"))]
    { Err("Le stockage sécurisé natif est disponible dans le runtime Windows uniquement.".into()) }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            desktop_runtime_info,
            discover_cardlock_candidates,
            read_cardlock_file,
            neon_test_connection,
            secure_secret_set,
            secure_secret_exists,
            secure_secret_delete
        ])
        .setup(|app| {
            let _ = app.emit("appointment://desktop-ready", true);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Appointment native runtime failed");
}
