use tauri::State;

use crate::errors::CommandError;
use crate::guards::require_owner;
use crate::models::{LoginAttemptDto, LoginAttemptFilters};
use crate::services::audit_service;
use crate::state::AppState;

#[tauri::command]
pub fn get_login_attempts(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<LoginAttemptDto>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    audit_service::get_login_attempts(&db)
}

#[tauri::command]
pub fn get_login_attempts_filtered(
    state: State<'_, AppState>,
    session_token: String,
    filters: LoginAttemptFilters,
) -> Result<Vec<LoginAttemptDto>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    audit_service::get_login_attempts_filtered(&db, &filters)
}
