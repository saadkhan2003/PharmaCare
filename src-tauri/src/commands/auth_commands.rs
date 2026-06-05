use serde::Deserialize;
use tauri::State;

use crate::errors::CommandError;
use crate::guards::SessionInfo;
use crate::models::SessionDto;
use crate::services::auth_service;
use crate::state::AppState;

/// Payload for the login command.
/// Received from the React frontend via Tauri IPC.
#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

/// Authenticates a user and creates a session.
///
/// Lock ordering: acquires db lock first, then sessions lock.
/// Returns SessionDto with token on success.
/// Returns generic "Invalid credentials" for both wrong username and wrong password (T-01-06).
/// Logs attempt before returning (T-01-10).
#[tauri::command]
pub fn auth_login(
    state: State<'_, AppState>,
    payload: LoginPayload,
) -> Result<SessionDto, CommandError> {
    let db = state.db.lock()?;
    let mut sessions = state.sessions.lock()?;

    auth_service::login(&db, &mut sessions, &payload.username, &payload.password)
        .map_err(CommandError::from)
}

/// Logs out the current user by removing their session.
#[tauri::command]
pub fn auth_logout(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<(), CommandError> {
    let db = state.db.lock()?;
    let mut sessions = state.sessions.lock()?;

    auth_service::logout(&db, &mut sessions, &session_token)
}

/// Checks if a session token is still valid.
/// Returns the session info (user_id, username, role, full_name) if valid.
/// This is a fast path with no DB hit.
#[tauri::command]
pub fn check_session(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<SessionInfo, CommandError> {
    let sessions = state.sessions.lock()?;

    auth_service::check_session(&sessions, &session_token)
}
