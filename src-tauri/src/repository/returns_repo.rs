use rusqlite::Connection;

use crate::models::r#return::Return;

/// Inserts one return row. Returns the new id.
///
/// Accepts &Connection (works for both standalone Connection and Transaction via Deref).
/// Called inside an atomic transaction.
#[allow(clippy::too_many_arguments)]
pub fn insert(
    conn: &Connection,
    return_type: &str,
    reference_id: Option<i64>,
    medicine_id: i64,
    batch_id: Option<i64>,
    quantity: i64,
    reason: Option<&str>,
    condition: Option<&str>,
    refund_amount: f64,
    processed_by: i64,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO returns (return_type, reference_id, medicine_id, batch_id, quantity, reason, condition, refund_amount, processed_by) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            return_type,
            reference_id,
            medicine_id,
            batch_id,
            quantity,
            reason,
            condition,
            refund_amount,
            processed_by,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Finds all return rows for a given sale item (used to compute already_returned_qty).
/// Filters by return_type='customer' AND reference_id = sale_id AND medicine_id AND batch_id.
pub fn find_by_sale_item(
    conn: &Connection,
    sale_id: i64,
    medicine_id: i64,
    batch_id: i64,
) -> Result<Vec<Return>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, return_type, reference_id, medicine_id, batch_id, quantity, \
                reason, condition, refund_amount, processed_by, return_date \
         FROM returns \
         WHERE return_type = 'customer' \
           AND reference_id = ?1 \
           AND medicine_id = ?2 \
           AND batch_id = ?3 \
         ORDER BY id ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![sale_id, medicine_id, batch_id], |row| {
        Ok(Return {
            id: row.get(0)?,
            return_type: row.get(1)?,
            reference_id: row.get(2)?,
            medicine_id: row.get(3)?,
            batch_id: row.get(4)?,
            quantity: row.get(5)?,
            reason: row.get(6)?,
            condition: row.get(7)?,
            refund_amount: row.get(8)?,
            processed_by: row.get(9)?,
            return_date: row.get(10)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Finds a return by id (for receipt lookup).
pub fn find_by_id(conn: &Connection, return_id: i64) -> Result<Option<Return>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, return_type, reference_id, medicine_id, batch_id, quantity, \
                reason, condition, refund_amount, processed_by, return_date \
         FROM returns WHERE id = ?1",
    )?;

    let mut rows = stmt.query_map(rusqlite::params![return_id], |row| {
        Ok(Return {
            id: row.get(0)?,
            return_type: row.get(1)?,
            reference_id: row.get(2)?,
            medicine_id: row.get(3)?,
            batch_id: row.get(4)?,
            quantity: row.get(5)?,
            reason: row.get(6)?,
            condition: row.get(7)?,
            refund_amount: row.get(8)?,
            processed_by: row.get(9)?,
            return_date: row.get(10)?,
        })
    })?;

    match rows.next() {
        Some(Ok(r)) => Ok(Some(r)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}
