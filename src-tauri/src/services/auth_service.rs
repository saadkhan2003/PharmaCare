use std::collections::HashMap;

use bcrypt::verify;
use chrono::Utc;
use rusqlite::Connection;
use uuid::Uuid;

use crate::errors::CommandError;
use crate::guards::SessionInfo;
use crate::models::{SessionDto, StoredSession};
use crate::repository::{audit_repo, session_repo, user_repo};

/// Errors that can occur during authentication.
#[derive(Debug)]
pub enum AuthError {
    InvalidCredentials,
    AccountDeactivated,
    Internal(String),
}

impl From<AuthError> for CommandError {
    fn from(e: AuthError) -> Self {
        match e {
            AuthError::InvalidCredentials => CommandError::validation("Invalid credentials"),
            AuthError::AccountDeactivated => CommandError::validation("Account deactivated"),
            AuthError::Internal(msg) => CommandError::internal(&msg),
        }
    }
}

impl From<rusqlite::Error> for AuthError {
    fn from(e: rusqlite::Error) -> Self {
        AuthError::Internal(e.to_string())
    }
}

/// Authenticates a user with username and password.
///
/// Flow per Pattern 3 from RESEARCH.md:
/// 1. Look up user by username (generic "Invalid credentials" if not found — T-01-06)
/// 2. Check is_active flag
/// 3. bcrypt::verify password
/// 4. Generate UUID v4 session token
/// 5. Insert session into sessions table (crash recovery) and in-memory HashMap
/// 6. Log attempt (success or failure) in login_attempts table (T-01-10)
///
/// Lock ordering: caller must hold db lock then sessions lock.
pub fn login(
    db: &Connection,
    sessions: &mut HashMap<String, StoredSession>,
    username: &str,
    password: &str,
) -> Result<SessionDto, AuthError> {
    // 1. Look up user by username
    let user = user_repo::find_by_username(db, username)?
        .ok_or_else(|| {
            // Log failure before returning — but we need user info we don't have
            // for the "not found" case. Log what we can.
            let _ = audit_repo::log_attempt(db, username, false, Some("user_not_found"), None);
            AuthError::InvalidCredentials
        })?;

    // 2. Check is_active
    if !user.is_active {
        audit_repo::log_attempt(db, username, false, Some("account_deactivated"), Some(&user.role))?;
        return Err(AuthError::AccountDeactivated);
    }

    // 3. Verify password with bcrypt (constant-time comparison)
    let valid = verify(password, &user.password_hash).map_err(|e| {
        AuthError::Internal(format!("bcrypt verify error: {}", e))
    })?;

    if !valid {
        audit_repo::log_attempt(db, username, false, Some("wrong_password"), Some(&user.role))?;
        return Err(AuthError::InvalidCredentials);
    }

    // 4. Generate UUID v4 session token
    let token = Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let session = StoredSession {
        token: token.clone(),
        user_id: user.id,
        username: user.username.clone(),
        role: user.role.clone(),
        full_name: user.full_name.clone(),
        created_at: now,
    };

    // 5. Persist to SQLite (crash recovery)
    session_repo::insert(db, &session)?;

    // 6. Insert into in-memory HashMap
    sessions.insert(token.clone(), session);

    // 7. Log success attempt
    audit_repo::log_attempt(db, username, true, None, Some(&user.role))?;

    Ok(SessionDto {
        token,
        user_id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
    })
}

/// Logs out a user by removing their session from both the in-memory
/// HashMap and the sessions SQLite table.
pub fn logout(
    db: &Connection,
    sessions: &mut HashMap<String, StoredSession>,
    token: &str,
) -> Result<(), CommandError> {
    sessions.remove(token);
    session_repo::delete(db, token)?;
    Ok(())
}

/// Checks if a session token is valid by looking it up in the in-memory HashMap.
/// This is a fast path — no DB hit (D-04).
pub fn check_session(
    sessions: &HashMap<String, StoredSession>,
    token: &str,
) -> Result<SessionInfo, CommandError> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers;

    #[test]
    fn test_login_success() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let mut sessions: HashMap<String, StoredSession> = HashMap::new();
        let result = login(&db, &mut sessions, "owner", "password123");
        assert!(result.is_ok());
        let session = result.unwrap();
        assert_eq!(session.user_id, uid);
        assert_eq!(session.role, "owner");
    }

    #[test]
    fn test_login_wrong_password() {
        let db = test_helpers::setup_test_db();
        let mut sessions: HashMap<String, StoredSession> = HashMap::new();
        test_helpers::seed_owner(&db);
        let result = login(&db, &mut sessions, "owner", "wrongpassword");
        assert!(result.is_err());
    }

    #[test]
    fn test_login_inactive_user() {
        let db = test_helpers::setup_test_db();
        test_helpers::seed_owner(&db);
        db.execute("UPDATE users SET is_active = 0 WHERE username = 'owner'", []).unwrap();
        let mut sessions: HashMap<String, StoredSession> = HashMap::new();
        let result = login(&db, &mut sessions, "owner", "password123");
        assert!(result.is_err());
    }

    #[test]
    fn test_login_no_user() {
        let db = test_helpers::setup_test_db();
        let mut sessions: HashMap<String, StoredSession> = HashMap::new();
        let result = login(&db, &mut sessions, "nonexistent", "password");
        assert!(result.is_err());
    }
}
