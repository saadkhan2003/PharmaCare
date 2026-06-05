use tauri::State;

use crate::errors::CommandError;
use crate::guards::require_owner;
use crate::models::{CreateUserDto, UserDto};
use crate::services::user_service;
use crate::state::AppState;

/// Creates a new user account.
/// Owner-only command (T-01-07 mitigation).
///
/// Validates password length >= 6 on Rust side (frontend validation is UX-only).
#[tauri::command]
pub fn create_user(
    state: State<'_, AppState>,
    session_token: String,
    payload: CreateUserDto,
) -> Result<UserDto, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    user_service::create_user(&db, &payload)
}

/// Deactivates a user by setting is_active = 0.
/// Owner-only command.
///
/// Enforces:
/// - Cannot deactivate your own account (USER-03)
/// - Cannot deactivate if it would leave 0 active owners (USER-04)
#[tauri::command]
pub fn deactivate_user(
    state: State<'_, AppState>,
    session_token: String,
    target_user_id: i64,
) -> Result<(), CommandError> {
    let session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    user_service::deactivate_user(&db, target_user_id, session.user_id)
}

/// Lists all users (active and deactivated).
/// Owner-only command.
#[tauri::command]
pub fn list_users(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<UserDto>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    user_service::list_users(&db)
}
