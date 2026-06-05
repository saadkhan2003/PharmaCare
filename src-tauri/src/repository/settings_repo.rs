use rusqlite::Connection;

/// Reads a setting value by key. Returns None if the key doesn't exist.
pub fn get_string(db: &Connection, key: &str) -> Result<Option<String>, rusqlite::Error> {
    let mut stmt = db.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query_map(rusqlite::params![key], |row| {
        row.get::<_, String>(0)
    })?;

    match rows.next() {
        Some(Ok(val)) => Ok(Some(val)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

/// Sets a setting value by key (inserts or replaces).
pub fn set_value(db: &Connection, key: &str, value: &str) -> Result<(), rusqlite::Error> {
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    )?;
    Ok(())
}
