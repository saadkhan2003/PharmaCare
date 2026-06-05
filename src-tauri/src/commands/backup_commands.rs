use std::path::PathBuf;

use tauri::{State, Manager};

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
/// Returns the OAuth URL for the frontend to open in a browser.
#[tauri::command]
pub fn connect_drive(
    state: State<'_, AppState>,
    session_token: String,
    client_id: String,
    client_secret: String,
) -> Result<String, CommandError> {
    let _session = require_owner(&state, &session_token)?;

    // Store client_id and client_secret temporarily for the OAuth flow
    let db = state.db.lock()?;
    settings_repo::set_value(&db, "drive_oauth_client_id", &client_id)?;
    settings_repo::set_value(&db, "drive_oauth_client_secret", &client_secret)?;
    drop(db);

    let redirect_port = 57432u16;
    backup_service::start_oauth_flow(&client_id, redirect_port)
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

/// Completes the Google Drive OAuth flow by exchanging the authorization code for tokens.
#[tauri::command]
pub fn complete_drive_connect(
    state: State<'_, AppState>,
    session_token: String,
    auth_code: String,
    client_id: String,
    client_secret: String,
) -> Result<(), CommandError> {
    let _session = require_owner(&state, &session_token)?;

    let redirect_uri = "http://localhost:57432/callback";
    let token_json = backup_service::exchange_code_for_token(
        &client_id,
        &client_secret,
        &auth_code,
        redirect_uri,
    )?;

    // Merge client credentials into the stored token for future refresh
    let mut token_value: serde_json::Value = serde_json::from_str(&token_json)
        .map_err(|e| CommandError::internal(&format!("Failed to parse token: {}", e)))?;

    if let Some(obj) = token_value.as_object_mut() {
        obj.insert("client_id".to_string(), serde_json::json!(client_id));
        obj.insert("client_secret".to_string(), serde_json::json!(client_secret));
    }

    let merged_json = serde_json::to_string(&token_value)
        .map_err(|e| CommandError::internal(&format!("Failed to serialize token: {}", e)))?;

    let db = state.db.lock()?;
    settings_repo::set_value(&db, "google_drive_token", &merged_json)?;

    Ok(())
}

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
