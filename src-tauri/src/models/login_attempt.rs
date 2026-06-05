use serde::{Deserialize, Serialize};

/// Full login attempt record (used internally by services).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginAttempt {
    pub id: i64,
    pub username: String,
    pub attempted_role: Option<String>,
    pub success: bool,
    pub failure_reason: Option<String>,
    pub created_at: String,
}

/// Login attempt DTO returned to frontend (owner-only view).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginAttemptDto {
    pub id: i64,
    pub username: String,
    pub success: bool,
    pub failure_reason: Option<String>,
    pub created_at: String,
}
