use serde::{Deserialize, Serialize};

/// Full user record with password_hash (used internally by services).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub full_name: String,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: String,
}

/// User DTO returned to frontend — password_hash is excluded.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDto {
    pub id: i64,
    pub full_name: String,
    pub username: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: String,
}

impl From<User> for UserDto {
    fn from(u: User) -> Self {
        UserDto {
            id: u.id,
            full_name: u.full_name,
            username: u.username,
            role: u.role,
            is_active: u.is_active,
            created_at: u.created_at,
        }
    }
}

/// Payload for creating a new user (owner-only command).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserDto {
    pub full_name: String,
    pub username: String,
    pub password: String,
    pub role: String,
}

/// Payload for deactivating a user (owner-only command).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeactivateUserDto {
    pub user_id: i64,
}
