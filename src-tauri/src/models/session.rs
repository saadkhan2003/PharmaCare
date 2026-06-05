use serde::{Deserialize, Serialize};

/// In-memory session state stored in AppState.sessions HashMap.
/// Also persisted to the sessions SQLite table for crash recovery.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredSession {
    pub token: String,
    pub user_id: i64,
    pub username: String,
    pub role: String,
    pub full_name: String,
    pub created_at: String,
}

/// Session DTO returned to frontend after successful login.
/// Contains the session token, user info, but NEVER the password_hash.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionDto {
    pub token: String,
    pub user_id: i64,
    pub username: String,
    pub role: String,
    pub full_name: String,
}
