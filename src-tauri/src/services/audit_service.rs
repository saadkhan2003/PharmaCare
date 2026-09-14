use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::{LoginAttemptDto, LoginAttemptFilters};
use crate::repository::audit_repo;

pub fn get_login_attempts(db: &Connection) -> Result<Vec<LoginAttemptDto>, CommandError> {
    let attempts = audit_repo::get_recent(db, 100)?;
    Ok(attempts)
}

pub fn get_login_attempts_filtered(
    db: &Connection,
    filters: &LoginAttemptFilters,
) -> Result<Vec<LoginAttemptDto>, CommandError> {
    let attempts = audit_repo::get_filtered(db, filters)?;
    Ok(attempts)
}
