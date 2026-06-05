use serde::{Deserialize, Serialize};
use tauri::State;

use crate::errors::CommandError;
use crate::models::SessionDto;
use crate::services::auth_service;
use crate::services::email_service;
use crate::services::user_service;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct SetupStatus {
    pub needs_setup: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateOwnerPayload {
    pub full_name: String,
    pub username: String,
    pub password: String,
    pub owner_email: Option<String>,
}

#[derive(Serialize)]
pub struct RecoveryCodeResponse {
    pub masked_email: String,
    pub expires_minutes: i64,
}

#[tauri::command]
pub fn check_setup_status(state: State<'_, AppState>) -> Result<SetupStatus, CommandError> {
    let db = state.db.lock()?;
    let count: i64 = db.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;

    Ok(SetupStatus {
        needs_setup: count == 0,
    })
}

#[tauri::command]
pub fn create_initial_owner(
    state: State<'_, AppState>,
    payload: CreateOwnerPayload,
) -> Result<SessionDto, CommandError> {
    let db = state.db.lock()?;
    let mut sessions = state.sessions.lock()?;

    if payload.password.len() < 6 {
        return Err(CommandError::validation(
            "Password must be at least 6 characters",
        ));
    }

    let user_count: i64 = db.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if user_count > 0 {
        return Err(CommandError::validation(
            "Setup has already been completed",
        ));
    }

    let create_dto = crate::models::CreateUserDto {
        full_name: payload.full_name,
        username: payload.username,
        password: payload.password,
        role: "owner".to_string(),
    };

    let user = user_service::create_user(&db, &create_dto)?;

    if let Some(email) = &payload.owner_email {
        if !email.trim().is_empty() {
            db.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('owner_email', ?1)",
                rusqlite::params![email.trim()],
            )?;
        }
    }

    auth_service::login(&db, &mut sessions, &user.username, &create_dto.password)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn request_recovery_code(
    state: State<'_, AppState>,
) -> Result<RecoveryCodeResponse, CommandError> {
    let db = state.db.lock()?;

    let owner_name: Option<String> = db
        .query_row(
            "SELECT full_name FROM users WHERE role = 'owner' AND is_active = 1 ORDER BY id LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();
    let owner_name = owner_name.ok_or_else(|| CommandError::validation("No owner account found"))?;

    let owner_email: Option<String> = db
        .query_row(
            "SELECT value FROM settings WHERE key = 'owner_email'",
            [],
            |row| row.get(0),
        )
        .ok();
    let owner_email = owner_email
        .map(|email| email.trim().to_string())
        .filter(|email| !email.is_empty())
        .ok_or_else(|| CommandError::validation("Owner email is not configured"))?;

    let smtp_config = email_service::SmtpConfig::from_env()
        .ok_or_else(|| CommandError::validation("SMTP email settings are not configured"))?;

    let code = email_service::generate_otp();
    let code_hash = bcrypt::hash(&code, bcrypt::DEFAULT_COST)
        .map_err(|e| CommandError::internal(&e.to_string()))?;
    let expires_minutes = otp_expires_minutes();
    let expires = chrono::Utc::now() + chrono::Duration::minutes(expires_minutes);

    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('recovery_otp_hash', ?1)",
        rusqlite::params![&code_hash],
    )?;
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('recovery_expires', ?1)",
        rusqlite::params![expires.format("%Y-%m-%d %H:%M:%S").to_string()],
    )?;
    db.execute("DELETE FROM settings WHERE key = 'recovery_code'", [])?;

    if let Err(err) = email_service::send_otp_email(&smtp_config, &owner_email, &code, &owner_name) {
        db.execute("DELETE FROM settings WHERE key = 'recovery_otp_hash'", [])?;
        db.execute("DELETE FROM settings WHERE key = 'recovery_expires'", [])?;
        return Err(CommandError::internal(&format!(
            "Failed to send recovery email: {}",
            err
        )));
    }

    Ok(RecoveryCodeResponse {
        masked_email: mask_email(&owner_email),
        expires_minutes,
    })
}

#[tauri::command]
pub fn verify_recovery_code(
    state: State<'_, AppState>,
    code: String,
) -> Result<Vec<i64>, CommandError> {
    let db = state.db.lock()?;
    verify_recovery_otp(&db, &code)?;

    let mut stmt = db.prepare("SELECT id FROM users WHERE role = 'owner' AND is_active = 1")?;
    let ids = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(Result::ok)
        .collect();

    Ok(ids)
}

#[tauri::command]
pub fn reset_with_recovery_code(
    state: State<'_, AppState>,
    user_id: i64,
    code: String,
    new_password: String,
) -> Result<(), CommandError> {
    let db = state.db.lock()?;
    verify_recovery_otp(&db, &code)?;

    if new_password.len() < 6 {
        return Err(CommandError::validation("Password must be at least 6 characters"));
    }

    let owner_count: i64 = db.query_row(
        "SELECT COUNT(*) FROM users WHERE id = ?1 AND role = 'owner' AND is_active = 1",
        rusqlite::params![user_id],
        |row| row.get(0),
    )?;
    if owner_count == 0 {
        return Err(CommandError::validation("Owner account not found"));
    }

    let new_hash = bcrypt::hash(&new_password, bcrypt::DEFAULT_COST)
        .map_err(|e| CommandError::internal(&e.to_string()))?;
    db.execute(
        "UPDATE users SET password_hash = ?1 WHERE id = ?2",
        rusqlite::params![&new_hash, user_id],
    )?;
    clear_recovery_otp(&db)?;

    Ok(())
}

fn verify_recovery_otp(db: &rusqlite::Connection, code: &str) -> Result<(), CommandError> {
    let code = code.trim();
    if code.len() != 6 || !code.chars().all(|c| c.is_ascii_digit()) {
        return Err(CommandError::validation("Invalid recovery code"));
    }

    let expires: Option<String> = db
        .query_row(
            "SELECT value FROM settings WHERE key = 'recovery_expires'",
            [],
            |row| row.get(0),
        )
        .ok();
    let expires = expires.ok_or_else(|| CommandError::validation("No active recovery code found"))?;
    let expires = chrono::NaiveDateTime::parse_from_str(&expires, "%Y-%m-%d %H:%M:%S")
        .map_err(|_| CommandError::validation("Recovery code has expired"))?;

    if chrono::Utc::now().naive_utc() > expires {
        clear_recovery_otp(db)?;
        return Err(CommandError::validation("Recovery code has expired"));
    }

    let stored_hash: Option<String> = db
        .query_row(
            "SELECT value FROM settings WHERE key = 'recovery_otp_hash'",
            [],
            |row| row.get(0),
        )
        .ok();
    let stored_hash = stored_hash.ok_or_else(|| CommandError::validation("No active recovery code found"))?;

    let valid = bcrypt::verify(code, &stored_hash)
        .map_err(|e| CommandError::internal(&e.to_string()))?;
    if !valid {
        return Err(CommandError::validation("Invalid recovery code"));
    }

    Ok(())
}

fn clear_recovery_otp(db: &rusqlite::Connection) -> Result<(), CommandError> {
    db.execute("DELETE FROM settings WHERE key = 'recovery_otp_hash'", [])?;
    db.execute("DELETE FROM settings WHERE key = 'recovery_code'", [])?;
    db.execute("DELETE FROM settings WHERE key = 'recovery_expires'", [])?;
    Ok(())
}

fn otp_expires_minutes() -> i64 {
    std::env::var("OTP_EXPIRES_MINUTES")
        .ok()
        .and_then(|value| value.parse::<i64>().ok())
        .filter(|minutes| *minutes > 0)
        .unwrap_or(15)
}

fn mask_email(email: &str) -> String {
    let Some((local, domain)) = email.split_once('@') else {
        return "***".to_string();
    };
    let visible = local.chars().take(2).collect::<String>();
    format!("{}***@{}", visible, domain)
}
