use rusqlite::Connection;

use crate::models::LoginAttemptDto;

/// Logs a login attempt (success or failure) in the login_attempts table.
///
/// Per T-01-10 (Repudiation), every login attempt is logged before the
/// response is returned to the caller, with:
/// - timestamp (created_at)
/// - username
/// - success/failure
/// - failure_reason (None for successful attempts)
/// - attempted_role (the role the user attempted to use, None if just logging in)
pub fn log_attempt(
    db: &Connection,
    username: &str,
    success: bool,
    failure_reason: Option<&str>,
    attempted_role: Option<&str>,
) -> Result<(), rusqlite::Error> {
    db.execute(
        "INSERT INTO login_attempts (username, success, failure_reason, attempted_role) \
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![username, success as i32, failure_reason, attempted_role],
    )?;
    Ok(())
}

/// Returns the most recent login attempts, ordered by created_at DESC.
pub fn get_recent(db: &Connection, limit: i64) -> Result<Vec<LoginAttemptDto>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, username, success, failure_reason, created_at \
         FROM login_attempts ORDER BY created_at DESC LIMIT ?1",
    )?;

    let rows = stmt.query_map(rusqlite::params![limit], |row| {
        Ok(LoginAttemptDto {
            id: row.get(0)?,
            username: row.get(1)?,
            success: row.get::<_, i32>(2)? != 0,
            failure_reason: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;

    let mut attempts = Vec::new();
    for row in rows {
        attempts.push(row?);
    }
    Ok(attempts)
}
