#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

#[cfg(not(target_os = "windows"))]
compile_error!("Appointment Native is a Windows-only application.");

pub mod booking_mapper;
pub mod credential_vault;
pub mod database;
pub mod domain;
pub mod p2p;
pub mod p2p_discovery;
pub mod supabase_auth;
pub mod supabase_sync;
mod win32;
mod winhttp;

fn main() {
    let data_dir = match application_data_dir() {
        Ok(path) => path,
        Err(error) => {
            win32::show_error(&format!("Local data directory initialization failed:\n{error}"));
            std::process::exit(1);
        }
    };
    let database = match initialize_local_database(&data_dir) {
        Ok(database) => database,
        Err(error) => {
            win32::show_error(&format!("Local database initialization failed:\n{error}"));
            std::process::exit(1);
        }
    };
    let node_id = match initialize_node_identity(&data_dir) {
        Ok(node_id) => node_id,
        Err(error) => {
            win32::show_error(&format!("LAN node identity initialization failed:\n{error}"));
            std::process::exit(1);
        }
    };
    if let Err(error) = win32::run(database, node_id) {
        win32::show_error(&error);
        std::process::exit(1);
    }
}

fn application_data_dir() -> Result<std::path::PathBuf, String> {
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .ok_or_else(|| "Windows LOCALAPPDATA environment variable is unavailable".to_string())?;
    let data_dir = std::path::PathBuf::from(local_app_data)
        .join("Connacri")
        .join("Appointment");
    std::fs::create_dir_all(&data_dir)
        .map_err(|error| format!("Cannot create local data directory: {error}"))?;
    Ok(data_dir)
}

fn initialize_local_database(
    data_dir: &std::path::Path,
) -> Result<database::PmsDatabase, String> {
    let database_path = data_dir.join("appointment.sqlite3");
    database::PmsDatabase::open(&database_path)
        .map_err(|error| format!("Cannot initialize SQLite database: {error}"))
}

/// Persist an installation identity; it is public discovery metadata, not a credential.
fn initialize_node_identity(data_dir: &std::path::Path) -> Result<String, String> {
    use std::io::Write as _;

    let identity_path = data_dir.join("p2p-node-id");
    match std::fs::read_to_string(&identity_path) {
        Ok(value) => {
            let normalized = uuid::Uuid::parse_str(value.trim())
                .map_err(|_| "Stored P2P node identity is not a valid UUID.".to_string())?;
            return Ok(normalized.hyphenated().to_string());
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Cannot read P2P node identity: {error}")),
    }

    let identity = uuid::Uuid::new_v4().hyphenated().to_string();
    match std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&identity_path)
    {
        Ok(mut file) => {
            file.write_all(identity.as_bytes())
                .map_err(|error| format!("Cannot persist P2P node identity: {error}"))?;
            file.sync_all()
                .map_err(|error| format!("Cannot flush P2P node identity: {error}"))?;
            Ok(identity)
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            let value = std::fs::read_to_string(&identity_path)
                .map_err(|read_error| format!("Cannot read concurrently created P2P identity: {read_error}"))?;
            let normalized = uuid::Uuid::parse_str(value.trim())
                .map_err(|_| "Concurrently created P2P node identity is invalid.".to_string())?;
            Ok(normalized.hyphenated().to_string())
        }
        Err(error) => Err(format!("Cannot create P2P node identity: {error}")),
    }
}
