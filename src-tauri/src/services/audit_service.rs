use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::LoginAttemptDto;
use crate::repository::audit_repo;

/// Returns the 100 most recent login attempts, ordered by created_at DESC.
/// Owner-only access per D-09.
pub fn get_login_attempts(db: &Connection) -> Result<Vec<LoginAttemptDto>, CommandError> {
    let attempts = audit_repo::get_recent(db, 100)?;
    Ok(attempts)
}
