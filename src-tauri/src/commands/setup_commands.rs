use serde::{Deserialize, Serialize};
use tauri::State;

use crate::errors::CommandError;
use crate::models::SessionDto;
use crate::services::auth_service;
use crate::services::user_service;
use crate::state::AppState;

/// Status of the first-run setup, returned to frontend on app start.
#[derive(Debug, Serialize)]
pub struct SetupStatus {
    pub needs_setup: bool,
}

/// Payload for creating the initial owner account.
#[derive(Debug, Deserialize)]
pub struct CreateOwnerPayload {
    pub full_name: String,
    pub username: String,
    pub password: String,
}

/// Checks whether the app needs first-run setup.
///
/// Returns `needs_setup: true` if there are 0 users in the database.
/// This command does NOT require authentication (called before login screen).
#[tauri::command]
pub fn check_setup_status(state: State<'_, AppState>) -> Result<SetupStatus, CommandError> {
    let db = state.db.lock()?;

    let count: i64 = db.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;

    Ok(SetupStatus {
        needs_setup: count == 0,
    })
}

/// Creates the initial owner account and auto-logs in.
///
/// Security (T-01-12):
/// - Rejects if any user already exists (prevents overwriting existing accounts)
/// - Creates the account with role = "owner"
/// - Auto-logs in by creating a session
///
/// This command does NOT require authentication (called during setup wizard flow).
#[tauri::command]
pub fn create_initial_owner(
    state: State<'_, AppState>,
    payload: CreateOwnerPayload,
) -> Result<SessionDto, CommandError> {
    let db = state.db.lock()?;
    let mut sessions = state.sessions.lock()?;

    // Validate password length (D-06)
    if payload.password.len() < 6 {
        return Err(CommandError::validation(
            "Password must be at least 6 characters",
        ));
    }

    // Safety check: reject if any user already exists (T-01-12)
    let user_count: i64 =
        db.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if user_count > 0 {
        return Err(CommandError::validation(
            "Setup has already been completed",
        ));
    }

    // Create the initial owner account via user_service
    let create_dto = crate::models::CreateUserDto {
        full_name: payload.full_name,
        username: payload.username,
        password: payload.password,
        role: "owner".to_string(),
    };

    let user = user_service::create_user(&db, &create_dto)?;

    // Auto-login: create a session for the new owner
    let session = auth_service::login(&db, &mut sessions, &user.username, &create_dto.password)?;

    Ok(session)
}
