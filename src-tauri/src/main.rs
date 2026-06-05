// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;

use rusqlite::Connection;
use tauri::Manager;

mod state;
mod commands;
mod services;
mod repository;
mod models;
mod errors;
mod guards;
mod migrations;

use state::AppState;
use models::StoredSession;

fn main() {
    let migration_defs = migrations::get_migrations();

    tauri::Builder::default()
        .setup(move |app| {
            // 1. Resolve the OS-specific app data directory
            //    Windows: %APPDATA%/com.pharmacare.app/
            //    Linux:   ~/.local/share/com.pharmacare.app/
            let app_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("pharmacare.db");

            // 2. Open SQLite connection
            let mut conn = Connection::open(&db_path)?;

            // 3. Set PRAGMAs BEFORE running migrations (Pitfall 5)
            //    - WAL mode for concurrent read performance
            //    - Foreign keys enforced (must be set per-connection)
            //    - Busy timeout for lock contention
            conn.execute_batch(
                "PRAGMA journal_mode=WAL;
                 PRAGMA foreign_keys=ON;
                 PRAGMA busy_timeout=5000;",
            )?;

            // 4. Run schema migrations via rusqlite_migration
            migration_defs.to_latest(&mut conn)?;

            // 5. Load existing sessions from SQLite for crash recovery (D-04)
            let sessions = load_sessions(&conn)?;

            // 6. Register AppState in Tauri's state management
            app.manage(AppState {
                db: std::sync::Mutex::new(conn),
                sessions: std::sync::Mutex::new(sessions),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Phase 1 commands
            commands::auth_commands::auth_login,
            commands::auth_commands::auth_logout,
            commands::auth_commands::check_session,
            commands::user_commands::create_user,
            commands::user_commands::deactivate_user,
            commands::user_commands::list_users,
            commands::setup_commands::check_setup_status,
            commands::setup_commands::create_initial_owner,
            commands::audit_commands::get_login_attempts,
            // Phase 2 commands
            commands::medicine_commands::create_medicine,
            commands::medicine_commands::update_medicine,
            commands::medicine_commands::deactivate_medicine,
            commands::medicine_commands::list_medicines,
            commands::medicine_commands::search_medicines,
            commands::medicine_commands::search_medicines_pharmacist,
            commands::medicine_commands::get_medicine,
            commands::supplier_commands::create_supplier,
            commands::supplier_commands::update_supplier,
            commands::supplier_commands::deactivate_supplier,
            commands::supplier_commands::list_suppliers,
            commands::supplier_commands::search_suppliers,
            commands::settings_commands::get_settings,
            commands::batch_commands::get_expiry_report,
            commands::batch_commands::get_current_stock,
            // Phase 2 commands (from Plan 02)
            commands::purchase_commands::record_purchase,
            commands::purchase_commands::list_purchases,
            commands::purchase_commands::get_purchase_detail,
            // Phase 3 commands
            commands::sale_commands::confirm_sale,
            commands::sale_commands::search_medicines_pos,
            commands::sale_commands::get_owner_dashboard,
            commands::sale_commands::get_pharmacist_dashboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PharmaCare");
}

/// Loads all sessions from the SQLite sessions table into an in-memory HashMap.
///
/// This enables crash recovery: if the app restarts, existing sessions
/// are available so the user doesn't need to re-login immediately.
/// Sessions are keyed by their UUID v4 token string.
fn load_sessions(conn: &Connection) -> Result<HashMap<String, StoredSession>, Box<dyn std::error::Error>> {
    let mut stmt = conn.prepare(
        "SELECT token, user_id, username, role, full_name, created_at FROM sessions",
    )?;

    let session_iter = stmt.query_map([], |row| {
        Ok(StoredSession {
            token: row.get(0)?,
            user_id: row.get(1)?,
            username: row.get(2)?,
            role: row.get(3)?,
            full_name: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;

    let mut map = HashMap::new();
    for session in session_iter {
        if let Ok(s) = session {
            map.insert(s.token.clone(), s);
        }
    }
    Ok(map)
}
