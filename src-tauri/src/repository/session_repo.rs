use rusqlite::Connection;

use crate::models::StoredSession;

/// Inserts a session record into the sessions table.
/// Used for crash-recovery persistence across app restarts.
pub fn insert(db: &Connection, session: &StoredSession) -> Result<(), rusqlite::Error> {
    db.execute(
        "INSERT INTO sessions (token, user_id, username, role, full_name, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            session.token,
            session.user_id,
            session.username,
            session.role,
            session.full_name,
            session.created_at,
        ],
    )?;
    Ok(())
}

/// Deletes a session from the sessions table by token.
pub fn delete(db: &Connection, token: &str) -> Result<(), rusqlite::Error> {
    db.execute(
        "DELETE FROM sessions WHERE token = ?1",
        rusqlite::params![token],
    )?;
    Ok(())
}

/// Loads all sessions from the sessions table into a Vec.
/// Called at app startup to restore sessions for crash recovery (D-04).
pub fn load_all(db: &Connection) -> Result<Vec<StoredSession>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT token, user_id, username, role, full_name, created_at FROM sessions",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(StoredSession {
            token: row.get(0)?,
            user_id: row.get(1)?,
            username: row.get(2)?,
            role: row.get(3)?,
            full_name: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;

    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row?);
    }
    Ok(sessions)
}
