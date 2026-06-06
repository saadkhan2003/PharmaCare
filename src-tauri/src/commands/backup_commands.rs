use std::path::PathBuf;

use tauri::{Manager, State};

use crate::errors::CommandError;
use crate::guards::require_owner;
use crate::models::{BackupFileInfo, BackupResult, BackupStatus};
use crate::repository::settings_repo;
use crate::services::backup_service;
use crate::state::AppState;

/// Triggers a manual backup. Owner only (T-05-02 mitigation).
/// Orchestrates VACUUM INTO -> gzip -> Drive upload (if configured) -> local copy (if configured).
#[tauri::command]
pub fn trigger_backup(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<BackupResult, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    // Read settings for backup configuration
    let drive_token = settings_repo::get_string(&db, "google_drive_token")?;
    let local_path_str = settings_repo::get_string(&db, "local_backup_path")?;

    let upload_to_drive = drive_token.is_some() && drive_token.as_deref().unwrap_or("").len() > 0;
    let local_path = local_path_str
        .filter(|p| !p.is_empty())
        .map(|p| PathBuf::from(p));

    backup_service::run_backup(
        &db,
        &db,
        upload_to_drive,
        local_path.as_deref(),
    )
}

/// Restores the database from a backup. Owner only (T-05-02 mitigation).
/// Creates pre-restore backup first (D-68, BAKP-08).
/// Uses VACUUM INTO on the restored database to atomically replace the live database.
#[tauri::command]
pub fn restore_backup(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    session_token: String,
    file_name: String,
    source: String, // "drive" or "local"
) -> Result<BackupResult, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::internal(&format!("Cannot get app data dir: {}", e)))?;

    let live_db_path = app_dir.join("pharmacare.db");

    if source == "drive" {
        let token = settings_repo::get_string(&db, "google_drive_token")?
            .ok_or_else(|| CommandError::validation("Google Drive not connected"))?;

        let token_value: serde_json::Value = serde_json::from_str(&token)
            .map_err(|e| CommandError::internal(&format!("Failed to parse Drive token: {}", e)))?;

        let access_token = token_value["access_token"]
            .as_str()
            .ok_or_else(|| CommandError::internal("Drive token missing access_token"))?
            .to_string();

        // Look up file ID by name
        let backups = backup_service::list_drive_backups(&access_token)?;
        let file = backups
            .iter()
            .find(|b| b.name == file_name)
            .ok_or_else(|| CommandError::not_found(&format!("Backup file: {}", file_name)))?;

        backup_service::restore_from_drive(&db, &file.id, &access_token, &live_db_path, &app_dir)?;
    } else {
        let path = PathBuf::from(&file_name);
        backup_service::restore_from_local(&db, &path, &live_db_path, &app_dir)?;
    }

    Ok(BackupResult {
        success: true,
        message: "Backup restored successfully. Please restart the application.".to_string(),
        path: live_db_path.to_string_lossy().to_string(),
    })
}

/// Initiates Google Drive OAuth connection. Owner only.
/// Runs the full auto-redirect flow: opens the browser to Google's consent
/// screen, listens on `http://localhost:57432/callback` for the redirect,
/// exchanges the auth code for tokens, and stores them.
/// Returns when the user has finished (or timed out / errored).
#[tauri::command]
pub fn start_drive_oauth(
    state: State<'_, AppState>,
    _app: tauri::AppHandle,
    session_token: String,
) -> Result<(), CommandError> {
    let _session = require_owner(&state, &session_token)?;

    let (client_id, client_secret) = backup_service::read_oauth_client()?;

    let auth_code = backup_service::run_drive_oauth_flow(&client_id, |url| {
        // Open the OAuth URL in the user's default browser. Best-effort:
        // a failure here will surface as a flow timeout.
        if let Err(e) = tauri_plugin_opener::open_url(url, None::<&str>) {
            eprintln!("[oauth] failed to open browser: {}", e);
        }
    })?;

    let db = state.db.lock()?;
    backup_service::complete_and_store_drive_token(
        &db,
        &client_id,
        &client_secret,
        &auth_code,
    )?;
    drop(db);

    Ok(())
}

/// Disconnects Google Drive by clearing the stored token. Owner only.
#[tauri::command]
pub fn disconnect_drive(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<(), CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    settings_repo::set_value(&db, "google_drive_token", "")?;
    settings_repo::set_value(&db, "drive_oauth_client_id", "")?;
    settings_repo::set_value(&db, "drive_oauth_client_secret", "")?;
    Ok(())
}

/// (The legacy `complete_drive_connect` command was replaced by `start_drive_oauth`.)
/// Lists backup files in Google Drive. Owner only.
#[tauri::command]
pub fn list_drive_backups(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<BackupFileInfo>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    let token = settings_repo::get_string(&db, "google_drive_token")?
        .ok_or_else(|| CommandError::validation("Google Drive not connected"))?;

    let token_value: serde_json::Value = serde_json::from_str(&token)
        .map_err(|e| CommandError::internal(&format!("Failed to parse Drive token: {}", e)))?;

    let access_token = token_value["access_token"]
        .as_str()
        .ok_or_else(|| CommandError::internal("Drive token missing access_token"))?
        .to_string();

    backup_service::list_drive_backups(&access_token)
}

/// Returns backup connection status. Owner only.
/// Reads last_backup_time, last_backup_status, and google_drive_connected from settings.
#[tauri::command]
pub fn get_backup_status(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<BackupStatus, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    let last_backup_time = settings_repo::get_string(&db, "last_backup_time")?;
    let last_backup_status = settings_repo::get_string(&db, "last_backup_status")?;
    let token = settings_repo::get_string(&db, "google_drive_token")?;
    let google_drive_connected = token.is_some() && token.as_deref().unwrap_or("").len() > 0;

    Ok(BackupStatus {
        last_backup_time,
        last_backup_status,
        google_drive_connected,
    })
}
