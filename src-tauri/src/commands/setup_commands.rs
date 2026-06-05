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
    pub owner_email: Option<String>,
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

    // Store owner email if provided (for password recovery)
    if let Some(email) = &payload.owner_email {
        let _ = db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('owner_email', ?1)",
            rusqlite::params![email],
        );
    }

    // Auto-login: create a session for the new owner
    let session = auth_service::login(&db, &mut sessions, &user.username, &create_dto.password)?;

    Ok(session)
}

/// Generates a recovery code for password reset. Stores it with 15-min expiry.
/// Returns the code + owner email hint for display.
#[tauri::command]
pub fn request_recovery_code(
    state: State<'_, AppState>,
) -> Result<RecoveryCodeResponse, CommandError> {
    let db = state.db.lock()?;

    // Check there's at least one owner
    let owner_count: i64 = db.query_row(
        "SELECT COUNT(*) FROM users WHERE role = 'owner' AND is_active = 1",
        [],
        |row| row.get(0),
    )?;
    if owner_count == 0 {
        return Err(CommandError::validation("No owner account found"));
    }

    // Get owner email from settings
    let owner_email: Option<String> = db
        .query_row(
            "SELECT value FROM settings WHERE key = 'owner_email'",
            [],
            |row| row.get(0),
        )
        .ok();

    // Generate 6-digit code
    use std::time::{SystemTime, UNIX_EPOCH};
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    let code = format!("{:06}", (seed % 900000 + 100000));

    // Store code with expiry (15 minutes)
    let expires = chrono::Utc::now() + chrono::Duration::minutes(15);
    let _ = db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('recovery_code', ?1)",
        rusqlite::params![&code],
    );
    let _ = db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('recovery_expires', ?1)",
        rusqlite::params![expires.format("%Y-%m-%d %H:%M:%S").to_string()],
    );

    Ok(RecoveryCodeResponse {
        code: code.clone(),
        owner_email: owner_email.clone(),
        masked_email: owner_email.as_ref().map(|e| {
            let at = e.find('@').unwrap_or(e.len());
            let prefix = &e[..at.min(2)];
            format!("{}***@***", prefix)
        }),
    })
}

/// Verifies a recovery code and returns owner user IDs for reset.
#[tauri::command]
pub fn verify_recovery_code(
    state: State<'_, AppState>,
    code: String,
) -> Result<Vec<i64>, CommandError> {
    let db = state.db.lock()?;

    let stored: Option<String> = db
        .query_row(
            "SELECT value FROM settings WHERE key = 'recovery_code'",
            [],
            |row| row.get(0),
        )
        .ok();

    match stored {
        Some(saved) if saved == code => {
            // Check expiry
            let expires: Option<String> = db
                .query_row(
                    "SELECT value FROM settings WHERE key = 'recovery_expires'",
                    [],
                    |row| row.get(0),
                )
                .ok();
            if let Some(exp) = expires {
                if let Ok(exp_time) =
                    chrono::NaiveDateTime::parse_from_str(&exp, "%Y-%m-%d %H:%M:%S")
                {
                    if chrono::Utc::now().naive_utc() > exp_time {
                        return Err(CommandError::validation("Recovery code has expired"));
                    }
                }
            }

            // Get all owner user IDs
            let mut stmt = db.prepare(
                "SELECT id FROM users WHERE role = 'owner' AND is_active = 1",
            )?;
            let ids: Vec<i64> = stmt
                .query_map([], |row| row.get(0))?
                .filter_map(|r| r.ok())
                .collect();

            Ok(ids)
        }
        _ => Err(CommandError::validation("Invalid recovery code")),
    }
}

/// Resets password for an owner user using a verified recovery code.
#[tauri::command]
pub fn reset_with_recovery_code(
    state: State<'_, AppState>,
    user_id: i64,
    code: String,
    new_password: String,
) -> Result<(), CommandError> {
    let db = state.db.lock()?;

    // Verify code first
    let stored: Option<String> = db
        .query_row(
            "SELECT value FROM settings WHERE key = 'recovery_code'",
            [],
            |row| row.get(0),
        )
        .ok();
    match stored {
        Some(saved) if saved == code => {}
        _ => return Err(CommandError::validation("Invalid recovery code")),
    }

    if new_password.len() < 6 {
        return Err(CommandError::validation("Password must be at least 6 characters"));
    }

    use bcrypt::{hash, DEFAULT_COST};
    let new_hash =
        hash(&new_password, DEFAULT_COST).map_err(|e| CommandError::internal(&e.to_string()))?;

    // Update password and clear recovery code
    db.execute(
        "UPDATE users SET password_hash = ?1 WHERE id = ?2",
        rusqlite::params![&new_hash, user_id],
    )?;
    db.execute("DELETE FROM settings WHERE key = 'recovery_code'", [])?;
    db.execute("DELETE FROM settings WHERE key = 'recovery_expires'", [])?;

    Ok(())
}

#[derive(Serialize)]
pub struct RecoveryCodeResponse {
    pub code: String,
    pub owner_email: Option<String>,
    pub masked_email: Option<String>,
}
