pub mod state;
pub mod models;
pub mod errors;
pub mod guards;
pub mod commands;
pub mod services;
pub mod repository;
pub mod migrations;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running PharmaCare");
}
