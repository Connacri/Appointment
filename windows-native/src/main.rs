#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

#[cfg(not(target_os = "windows"))]
compile_error!("Appointment Native is a Windows-only application.");

mod database;
mod domain;
mod win32;

fn main() {
    if let Err(error) = win32::run() {
        eprintln!("Appointment Native startup failed: {error}");
        std::process::exit(1);
    }
}
