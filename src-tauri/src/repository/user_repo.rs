use rusqlite::Connection;

use crate::models::{User, UserDto};

/// Looks up a user by username.
/// Returns None if no user with that username exists.
pub fn find_by_username(db: &Connection, username: &str) -> Result<Option<User>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, full_name, username, password_hash, role, is_active, created_at \
         FROM users WHERE username = ?",
    )?;

    let mut rows = stmt.query_map(rusqlite::params![username], |row| {
        Ok(User {
            id: row.get(0)?,
            full_name: row.get(1)?,
            username: row.get(2)?,
            password_hash: row.get(3)?,
            role: row.get(4)?,
            is_active: row.get::<_, i32>(5)? != 0,
            created_at: row.get(6)?,
        })
    })?;

    match rows.next() {
        Some(Ok(user)) => Ok(Some(user)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

/// Looks up a user by their primary key ID.
pub fn find_by_id(db: &Connection, id: i64) -> Result<Option<User>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, full_name, username, password_hash, role, is_active, created_at \
         FROM users WHERE id = ?",
    )?;

    let mut rows = stmt.query_map(rusqlite::params![id], |row| {
        Ok(User {
            id: row.get(0)?,
            full_name: row.get(1)?,
            username: row.get(2)?,
            password_hash: row.get(3)?,
            role: row.get(4)?,
            is_active: row.get::<_, i32>(5)? != 0,
            created_at: row.get(6)?,
        })
    })?;

    match rows.next() {
        Some(Ok(user)) => Ok(Some(user)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

/// Inserts a new user into the database.
/// Returns the created UserDto on success.
/// Username uniqueness is enforced by the SQL UNIQUE constraint.
pub fn insert(
    db: &Connection,
    full_name: &str,
    username: &str,
    password_hash: &str,
    role: &str,
) -> Result<UserDto, rusqlite::Error> {
    db.execute(
        "INSERT INTO users (full_name, username, password_hash, role) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![full_name, username, password_hash, role],
    )?;

    let id = db.last_insert_rowid();

    Ok(UserDto {
        id,
        full_name: full_name.to_string(),
        username: username.to_string(),
        role: role.to_string(),
        is_active: true,
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

/// Sets is_active = 0 for the given user ID.
/// Returns true if a row was actually updated.
pub fn deactivate(db: &Connection, id: i64) -> Result<bool, rusqlite::Error> {
    let affected = db.execute(
        "UPDATE users SET is_active = 0 WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(affected > 0)
}

/// Checks if a user has any related records (sales, stock movements).
pub fn has_related_records(db: &Connection, id: i64) -> Result<bool, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT COUNT(*) FROM (SELECT id FROM sales WHERE user_id = ?1 LIMIT 1)"
    )?;
    let count: i64 = stmt.query_row(rusqlite::params![id], |row| row.get(0))?;
    Ok(count > 0)
}

/// Hard deletes a user only if they have no related records.
pub fn hard_delete(db: &Connection, id: i64) -> Result<(), rusqlite::Error> {
    db.execute("DELETE FROM sessions WHERE user_id = ?1", rusqlite::params![id])?;
    db.execute("DELETE FROM users WHERE id = ?1", rusqlite::params![id])?;
    Ok(())
}

/// Lists all users (both active and inactive).
/// Returns DTOs without password_hash for frontend consumption.
pub fn list_all(db: &Connection) -> Result<Vec<UserDto>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, full_name, username, role, is_active, created_at \
         FROM users ORDER BY created_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(UserDto {
            id: row.get(0)?,
            full_name: row.get(1)?,
            username: row.get(2)?,
            role: row.get(3)?,
            is_active: row.get::<_, i32>(4)? != 0,
            created_at: row.get(5)?,
        })
    })?;

    let mut users = Vec::new();
    for row in rows {
        users.push(row?);
    }
    Ok(users)
}

/// Counts the number of active (is_active=1) owner accounts.
pub fn count_active_owners(db: &Connection) -> Result<i64, rusqlite::Error> {
    db.query_row(
        "SELECT COUNT(*) FROM users WHERE role = 'owner' AND is_active = 1",
        [],
        |row| row.get(0),
    )
}

/// Retrieves the password hash for a user by ID.
pub fn get_password_hash(db: &Connection, user_id: i64) -> Result<Option<String>, rusqlite::Error> {
    let mut stmt = db.prepare("SELECT password_hash FROM users WHERE id = ?1")?;
    let mut rows = stmt.query_map(rusqlite::params![user_id], |row| {
        row.get::<_, String>(0)
    })?;
    match rows.next() {
        Some(Ok(hash)) => Ok(Some(hash)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

/// Updates the password hash for a user by ID.
pub fn update_password_hash(db: &Connection, user_id: i64, new_hash: &str) -> Result<(), rusqlite::Error> {
    db.execute(
        "UPDATE users SET password_hash = ?1 WHERE id = ?2",
        rusqlite::params![new_hash, user_id],
    )?;
    Ok(())
}
