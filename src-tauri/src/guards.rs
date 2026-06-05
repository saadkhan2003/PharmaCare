use serde::Serialize;

use crate::errors::CommandError;
use crate::state::AppState;

/// Session context returned to command handlers after guard validation.
#[derive(Debug, Clone, Serialize)]
pub struct SessionInfo {
    pub user_id: i64,
    pub username: String,
    pub role: String,
    pub full_name: String,
}

/// Validates that the session token exists in the in-memory session map.
///
/// Lock ordering: sessions lock is acquired AFTER db lock in callers.
/// This guard only touches the sessions HashMap, never the db Connection,
/// maintaining consistent lock ordering to prevent deadlocks (Pitfall 3).
pub fn require_session(state: &AppState, token: &str) -> Result<SessionInfo, CommandError> {
    let sessions = state.sessions.lock().map_err(|e| CommandError {
        code: "INTERNAL".into(),
        message: format!("Failed to acquire session lock: {}", e),
    })?;

    sessions
        .get(token)
        .map(|s| SessionInfo {
            user_id: s.user_id,
            username: s.username.clone(),
            role: s.role.clone(),
            full_name: s.full_name.clone(),
        })
        .ok_or_else(CommandError::unauthorized)
}

/// Validates the session token AND checks that the user has the "owner" role.
///
/// Every privileged command MUST call `require_owner` on every invocation —
/// not just hide buttons in the UI. Returns FORBIDDEN if the session exists
/// but belongs to a pharmacist (T-01-03 mitigation).
pub fn require_owner(state: &AppState, token: &str) -> Result<SessionInfo, CommandError> {
    let session = require_session(state, token)?;

    if session.role != "owner" {
        return Err(CommandError::forbidden());
    }

    Ok(session)
}
