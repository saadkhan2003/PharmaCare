use tauri::State;

use crate::errors::CommandError;
use crate::guards::require_owner;
use crate::models::LoginAttemptDto;
use crate::services::audit_service;
use crate::state::AppState;

/// Returns the 100 most recent login attempts.
/// Owner-only command per D-09 (T-01-08 mitigation).
#[tauri::command]
pub fn get_login_attempts(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<LoginAttemptDto>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    audit_service::get_login_attempts(&db)
}
