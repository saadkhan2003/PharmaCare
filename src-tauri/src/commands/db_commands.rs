use serde::Serialize;
use tauri::State;

use crate::errors::CommandError;
use crate::guards::require_owner;
use crate::migrations::total_migrations;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct DbStatus {
    pub db_path: String,
    pub db_size_bytes: i64,
    pub migration_version: i64,
    pub total_migrations: i64,
    pub wal_mode: bool,
    pub foreign_keys: bool,
}

#[tauri::command]
pub fn get_db_status(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<DbStatus, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    let migration_version: i64 = db
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| CommandError::internal(&format!("Failed to query user_version: {}", e)))?;

    let journal_mode: String = db
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .map_err(|e| CommandError::internal(&format!("Failed to query journal_mode: {}", e)))?;

    let foreign_keys: bool = db
        .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
        .map_err(|e| CommandError::internal(&format!("Failed to query foreign_keys: {}", e)))?;

    let total = total_migrations();

    let db_path_str: String = db
        .query_row("PRAGMA database_list", [], |row| row.get::<_, String>(2))
        .unwrap_or_else(|_| "unknown".into());

    let db_size_bytes = std::fs::metadata(&db_path_str)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    Ok(DbStatus {
        db_path: db_path_str,
        db_size_bytes,
        migration_version,
        total_migrations: total,
        wal_mode: journal_mode == "wal",
        foreign_keys,
    })
}
