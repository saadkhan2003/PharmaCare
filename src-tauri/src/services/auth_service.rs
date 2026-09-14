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
/// HashMap and the sessions SQLite table. L-3 fix: also clean stale sessions.
pub fn logout(
    db: &Connection,
    sessions: &mut HashMap<String, StoredSession>,
    token: &str,
) -> Result<(), CommandError> {
    sessions.remove(token);
    // L-3: Clean all expired sessions (>24h) on logout
    let now = chrono::Utc::now();
    sessions.retain(|_, s| {
        if let Ok(created) = chrono::NaiveDateTime::parse_from_str(&s.created_at, "%Y-%m-%d %H:%M:%S") {
            now.naive_utc().signed_duration_since(created) <= chrono::Duration::hours(24)
        } else {
            false // Remove sessions with invalid timestamps
        }
    });
    // Also clean the database
    session_repo::delete_all_expired(db, 24)?;
    session_repo::delete(db, token)?;
    Ok(())
}

/// Checks if a session token is valid by looking it up in the in-memory HashMap.
/// This is a fast path — no DB hit (D-04).
/// Sessions expire after 24 hours (H-2 fix).
pub fn check_session(
    sessions: &HashMap<String, StoredSession>,
    token: &str,
) -> Result<SessionInfo, CommandError> {
    let session = sessions
        .get(token)
        .ok_or_else(CommandError::unauthorized)?;

    // H-2: Check session TTL (24 hours)
    if let Ok(created) = chrono::NaiveDateTime::parse_from_str(&session.created_at, "%Y-%m-%d %H:%M:%S") {
        let now = chrono::Utc::now().naive_utc();
        let age = now.signed_duration_since(created);
        if age > chrono::Duration::hours(24) {
            return Err(CommandError::unauthorized());
        }
    }

    Ok(SessionInfo {
        user_id: session.user_id,
        username: session.username.clone(),
        role: session.role.clone(),
        full_name: session.full_name.clone(),
    })
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

    #[test]
    fn test_logout_removes_session() {
        let db = test_helpers::setup_test_db();
        test_helpers::seed_owner(&db);
        let mut sessions: HashMap<String, StoredSession> = HashMap::new();
        let session = login(&db, &mut sessions, "owner", "password123").unwrap();
        assert!(sessions.contains_key(&session.token));

        logout(&db, &mut sessions, &session.token).unwrap();
        assert!(!sessions.contains_key(&session.token));
    }

    #[test]
    fn test_check_session_valid_token() {
        let db = test_helpers::setup_test_db();
        test_helpers::seed_owner(&db);
        let mut sessions: HashMap<String, StoredSession> = HashMap::new();
        let session = login(&db, &mut sessions, "owner", "password123").unwrap();

        let info = check_session(&sessions, &session.token).unwrap();
        assert_eq!(info.user_id, session.user_id);
        assert_eq!(info.username, "owner");
        assert_eq!(info.role, "owner");
    }

    #[test]
    fn test_check_session_invalid_token() {
        let sessions: HashMap<String, StoredSession> = HashMap::new();
        let result = check_session(&sessions, "nonexistent-token");
        assert!(result.is_err());
    }

    #[test]
    fn test_check_session_expired_token() {
        let mut sessions: HashMap<String, StoredSession> = HashMap::new();
        let expired = StoredSession {
            token: "expired-token".into(),
            user_id: 1,
            username: "owner".into(),
            role: "owner".into(),
            full_name: "Test Owner".into(),
            created_at: "2020-01-01 00:00:00".into(),
        };
        sessions.insert("expired-token".into(), expired);

        let result = check_session(&sessions, "expired-token");
        assert!(result.is_err());
    }

    #[test]
    fn test_login_creates_session_in_db() {
        let db = test_helpers::setup_test_db();
        test_helpers::seed_owner(&db);
        let mut sessions: HashMap<String, StoredSession> = HashMap::new();
        let session = login(&db, &mut sessions, "owner", "password123").unwrap();

        let count: i64 = db
            .query_row("SELECT COUNT(*) FROM sessions WHERE token = ?1", rusqlite::params![session.token], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_logout_removes_session_from_db() {
        let db = test_helpers::setup_test_db();
        test_helpers::seed_owner(&db);
        let mut sessions: HashMap<String, StoredSession> = HashMap::new();
        let session = login(&db, &mut sessions, "owner", "password123").unwrap();

        logout(&db, &mut sessions, &session.token).unwrap();

        let count: i64 = db
            .query_row("SELECT COUNT(*) FROM sessions WHERE token = ?1", rusqlite::params![session.token], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
}
