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
    let database = match initialize_local_database() {
        Ok(database) => database,
        Err(error) => {
            win32::show_error(&format!("Local database initialization failed:\n{error}"));
            std::process::exit(1);
        }
    };
    if let Err(error) = win32::run(database) {
        win32::show_error(&error);
        std::process::exit(1);
    }
}

fn initialize_local_database() -> Result<database::PmsDatabase, String> {
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .ok_or_else(|| "Windows LOCALAPPDATA environment variable is unavailable".to_string())?;
    let data_dir = std::path::PathBuf::from(local_app_data)
        .join("Connacri")
        .join("Appointment");
    std::fs::create_dir_all(&data_dir)
        .map_err(|error| format!("Cannot create local data directory: {error}"))?;
    let database_path = data_dir.join("appointment.sqlite3");
    database::PmsDatabase::open(&database_path)
        .map_err(|error| format!("Cannot initialize SQLite database: {error}"))
}
