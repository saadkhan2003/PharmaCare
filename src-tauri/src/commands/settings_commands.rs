use tauri::State;

use crate::errors::CommandError;
use crate::guards::require_owner;
use crate::models::{SettingsMap, UpdateSettingsPayload};
use crate::services::settings_service;
use crate::state::AppState;

/// Returns all settings as a typed SettingsMap.
/// No auth guard needed — settings contain no sensitive data (T-02-07).
#[tauri::command]
pub fn get_settings(
    state: State<'_, AppState>,
) -> Result<SettingsMap, CommandError> {
    let db = state.db.lock()?;
    settings_service::get_settings(&db)
}

/// Updates settings from a typed payload. Owner only (T-05-03 mitigation).
/// Only non-None fields from the payload are written.
#[tauri::command]
pub fn update_settings(
    state: State<'_, AppState>,
    session_token: String,
    payload: UpdateSettingsPayload,
) -> Result<(), CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    settings_service::update_settings(&db, &payload)
}
