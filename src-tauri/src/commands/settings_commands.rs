use tauri::State;

use crate::errors::CommandError;
use crate::guards::{require_owner, require_session};
use crate::models::{SettingsMap, UpdateSettingsPayload};
use crate::services::settings_service;
use crate::state::AppState;

/// Returns all settings as a typed SettingsMap.
/// Requires a valid session (H-1 fix: prevents unauthenticated access to owner PII).
#[tauri::command]
pub fn get_settings(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<SettingsMap, CommandError> {
    let _session = require_session(&state, &session_token)?;
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
