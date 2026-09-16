// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(dead_code)]

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

#[cfg(test)]
#[path = "test_helpers.rs"]
mod test_helpers;

use state::AppState;

fn main() {
    dotenvy::dotenv().ok();

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
                 PRAGMA busy_timeout=5000;
                 PRAGMA cache_size=-64000;
                 PRAGMA mmap_size=268435456;
                 PRAGMA temp_store=MEMORY;
                 PRAGMA synchronous=NORMAL;",
            )?;

            // 4. Run schema migrations via rusqlite_migration
            migration_defs.to_latest(&mut conn)?;
            conn.execute("PRAGMA optimize;", [])?;

            // 5. Clear stale sessions on startup (H-3 fix: sessions should not survive restarts)
            //    Old sessions from crashed processes are cleared to prevent token reuse.
            conn.execute("DELETE FROM sessions", [])?;
            let sessions = HashMap::new();

            // 6. Register AppState in Tauri's state management
            app.manage(AppState {
                db: std::sync::Mutex::new(conn),
                sessions: std::sync::Mutex::new(sessions),
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Phase 1 commands
            commands::auth_commands::auth_login,
            commands::auth_commands::auth_logout,
            commands::auth_commands::check_session,
            commands::user_commands::create_user,
            commands::user_commands::deactivate_user,
            commands::user_commands::delete_user,
            commands::user_commands::list_users,
            commands::setup_commands::check_setup_status,
            commands::setup_commands::create_initial_owner,
            commands::setup_commands::request_recovery_code,
            commands::setup_commands::verify_recovery_code,
            commands::setup_commands::reset_with_recovery_code,
            commands::audit_commands::get_login_attempts,
            commands::audit_commands::get_login_attempts_filtered,
            // Phase 2 commands
            commands::medicine_commands::create_medicine,
            commands::medicine_commands::update_medicine,
            commands::medicine_commands::deactivate_medicine,
            commands::medicine_commands::delete_medicine,
            commands::medicine_commands::list_medicines,
            commands::medicine_commands::search_medicines,
            commands::medicine_commands::search_medicines_pharmacist,
            commands::medicine_commands::get_medicine,
            commands::medicine_commands::import_medicines_csv,
            commands::supplier_commands::create_supplier,
            commands::supplier_commands::update_supplier,
            commands::supplier_commands::deactivate_supplier,
            commands::supplier_commands::delete_supplier,
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
            commands::sale_commands::list_sales,
            commands::sale_commands::get_sale_detail,
            commands::sale_commands::get_owner_dashboard,
            commands::sale_commands::get_pharmacist_dashboard,
            // Phase 4 commands
            commands::return_commands::process_customer_return,
            commands::return_commands::process_supplier_return,
            commands::return_commands::process_write_off,
            commands::return_commands::search_sale_for_return,
            commands::return_commands::search_purchase_for_return,
            commands::return_commands::list_returns,
            // Phase 5 report commands
            commands::report_commands::get_daily_sales_report,
            commands::report_commands::get_monthly_pnl,
            commands::report_commands::get_top_sellers,
            commands::report_commands::get_slow_moving,
            commands::report_commands::get_low_stock,
            commands::report_commands::get_expiry_report_phase5,
            commands::report_commands::get_supplier_purchases,
            commands::report_commands::get_sales_by_user,
            commands::report_commands::get_profit_margin,
            // Phase 5 backup commands
            commands::backup_commands::trigger_backup,
            commands::backup_commands::restore_backup,
            commands::backup_commands::start_drive_oauth,
            commands::backup_commands::disconnect_drive,
            commands::backup_commands::list_drive_backups,
            commands::backup_commands::list_local_backups,
            commands::backup_commands::get_backup_status,
            // Phase 5 settings commands
            commands::settings_commands::update_settings,
            // Phase 5 user commands
            commands::user_commands::change_password,
            commands::user_commands::reset_password,
            
            commands::debt_commands::create_debt,
            commands::debt_commands::list_debts,
            commands::debt_commands::get_debt,
            commands::debt_commands::record_payment,
            commands::debt_commands::get_overdue_count,
            commands::debt_commands::get_due_soon_count,
            commands::supplier_debt_commands::create_supplier_debt,
            commands::supplier_debt_commands::list_supplier_debts,
            commands::supplier_debt_commands::get_supplier_debt,
            commands::supplier_debt_commands::record_supplier_payment,
            commands::supplier_debt_commands::get_supplier_overdue_count,
            commands::supplier_debt_commands::create_supplier_debt_from_purchase,
            commands::batch_commands::list_batches,
            commands::batch_commands::update_batch,
            commands::pdf_commands::save_pdf,
            commands::db_commands::get_db_status,
            commands::db_commands::optimize_database,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PharmaCare");
}
