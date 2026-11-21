#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

#[cfg(not(target_os = "windows"))]
compile_error!("Appointment Native is a Windows-only application.");

pub mod database;
pub mod domain;
mod win32;

fn main() {
    let _database = match initialize_local_database() {
        Ok(database) => database,
        Err(error) => {
            eprintln!("Appointment Native database startup failed: {error}");
            std::process::exit(1);
        }
    };
    if let Err(error) = win32::run() {
        eprintln!("Appointment Native startup failed: {error}");
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
