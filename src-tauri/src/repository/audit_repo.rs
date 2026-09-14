use rusqlite::Connection;

use crate::models::{LoginAttemptDto, LoginAttemptFilters};

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

pub fn get_filtered(
    db: &Connection,
    filters: &LoginAttemptFilters,
) -> Result<Vec<LoginAttemptDto>, rusqlite::Error> {
    let mut sql = String::from(
        "SELECT id, username, success, failure_reason, created_at \
         FROM login_attempts WHERE 1=1",
    );
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref username) = filters.username {
        if !username.is_empty() {
            sql.push_str(&format!(" AND username LIKE ?{}", idx));
            params.push(Box::new(format!("%{}%", username)));
            idx += 1;
        }
    }

    if let Some(success) = filters.success {
        sql.push_str(&format!(" AND success = ?{}", idx));
        params.push(Box::new(success as i32));
        idx += 1;
    }

    if let Some(ref start_date) = filters.start_date {
        if !start_date.is_empty() {
            sql.push_str(&format!(" AND created_at >= ?{}", idx));
            params.push(Box::new(start_date.clone()));
            idx += 1;
        }
    }

    if let Some(ref end_date) = filters.end_date {
        if !end_date.is_empty() {
            sql.push_str(&format!(" AND created_at <= ?{}", idx));
            params.push(Box::new(end_date.clone()));
            idx += 1;
        }
    }

    sql.push_str(" ORDER BY created_at DESC");

    let limit = filters.limit.unwrap_or(100);
    let offset = filters.offset.unwrap_or(0);
    sql.push_str(&format!(" LIMIT ?{} OFFSET ?{}", idx, idx + 1));
    params.push(Box::new(limit));
    params.push(Box::new(offset));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = db.prepare(&sql)?;

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
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
