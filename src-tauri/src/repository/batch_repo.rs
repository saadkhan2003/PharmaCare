use rusqlite::Connection;

use crate::models::{Batch, ExpiryReportRow};

/// Inserts a new batch. Returns the new row id.
/// Accepts &Connection (works for both standalone Connection and Transaction via Deref).
/// `purchase_id` can be None for opening stock batches.
/// `batch_code` is optional; pass None to leave it null (legacy rows), or pass Some("...")
/// to store a user-visible batch identifier.
pub fn insert(
    conn: &Connection,
    medicine_id: i64,
    purchase_id: Option<i64>,
    purchase_item_id: Option<i64>,
    purchase_price: f64,
    quantity: i64,
    remaining_qty: i64,
    expiry_date: &str,
    batch_code: Option<&str>,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO batches (medicine_id, purchase_id, purchase_item_id, purchase_price, quantity, remaining_qty, expiry_date, batch_code) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            medicine_id,
            purchase_id,
            purchase_item_id,
            purchase_price,
            quantity,
            remaining_qty,
            expiry_date,
            batch_code,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Computes current stock for a medicine: sum of remaining_qty of non-expired batches.
/// D-23: SELECT COALESCE(SUM(remaining_qty), 0) FROM batches WHERE medicine_id = ? AND expiry_date > date('now')
pub fn get_current_stock(db: &Connection, medicine_id: i64) -> Result<i64, rusqlite::Error> {
    let result: i64 = db.query_row(
        "SELECT COALESCE(SUM(remaining_qty), 0) FROM batches \
         WHERE medicine_id = ?1 AND expiry_date > date('now')",
        rusqlite::params![medicine_id],
        |row| row.get(0),
    )?;
    Ok(result)
}

/// Returns the expiry report sorted by days_remaining ASC.
/// Optionally filtered by min_days (<=) and max_days (>=).
pub fn get_expiry_report(
    db: &Connection,
    min_days: Option<i64>,
    max_days: Option<i64>,
) -> Result<Vec<ExpiryReportRow>, rusqlite::Error> {
    let mut sql = String::from(
        "SELECT b.id, m.id, m.name, m.generic_name, b.quantity, b.remaining_qty, \
                b.purchase_price, b.expiry_date, \
                CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) AS days_remaining \
         FROM batches b \
         JOIN medicines m ON m.id = b.medicine_id \
         WHERE m.is_active = 1 \
           AND b.remaining_qty > 0",
    );

    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(min) = min_days {
        sql.push_str(&format!(" AND days_remaining <= ?{}", params.len() + 1));
        params.push(Box::new(min));
    }
    if let Some(max) = max_days {
        sql.push_str(&format!(" AND days_remaining >= ?{}", params.len() + 1));
        params.push(Box::new(max));
    }

    sql.push_str(" ORDER BY days_remaining ASC");

    let mut stmt = db.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(ExpiryReportRow {
            batch_id: row.get(0)?,
            medicine_id: row.get(1)?,
            medicine_name: row.get(2)?,
            generic_name: row.get(3)?,
            quantity: row.get(4)?,
            remaining_qty: row.get(5)?,
            purchase_price: row.get(6)?,
            expiry_date: row.get(7)?,
            days_remaining: row.get(8)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Finds FIFO-eligible batches for a medicine: non-expired, has stock, ordered by expiry ASC.
///
/// D-32: ORDER BY expiry_date ASC, received_date ASC, id ASC ensures oldest-expiry batches
/// are consumed first. expiry_date > date('now') filters out already-expired batches (BATC-03).
pub fn find_fifo_eligible(db: &Connection, medicine_id: i64) -> Result<Vec<Batch>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, medicine_id, purchase_id, purchase_item_id, purchase_price, \
                quantity, remaining_qty, expiry_date, received_date \
         FROM batches \
         WHERE medicine_id = ?1 \
           AND remaining_qty > 0 \
           AND expiry_date > date('now') \
         ORDER BY expiry_date ASC, received_date ASC, id ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![medicine_id], |row| {
        Ok(Batch {
            id: row.get(0)?,
            medicine_id: row.get(1)?,
            purchase_id: row.get(2)?,
            purchase_item_id: row.get(3)?,
            purchase_price: row.get(4)?,
            quantity: row.get(5)?,
            remaining_qty: row.get(6)?,
            expiry_date: row.get(7)?,
            received_date: row.get(8)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Increments remaining_qty on a batch by the given amount.
/// Used for resellable customer returns (D-45).
pub fn increment_remaining_qty(conn: &Connection, batch_id: i64, increment_by: i64) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE batches SET remaining_qty = remaining_qty + ?2 WHERE id = ?1",
        rusqlite::params![batch_id, increment_by],
    )?;
    Ok(())
}

/// Finds batches linked to a purchase with remaining stock (for supplier return lookup).
pub fn find_by_purchase_id(
    conn: &Connection,
    purchase_id: i64,
) -> Result<Vec<Batch>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, medicine_id, purchase_id, purchase_item_id, purchase_price, \
                quantity, remaining_qty, expiry_date, received_date \
         FROM batches \
         WHERE purchase_id = ?1 AND remaining_qty > 0 \
         ORDER BY id ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![purchase_id], |row| {
        Ok(Batch {
            id: row.get(0)?,
            medicine_id: row.get(1)?,
            purchase_id: row.get(2)?,
            purchase_item_id: row.get(3)?,
            purchase_price: row.get(4)?,
            quantity: row.get(5)?,
            remaining_qty: row.get(6)?,
            expiry_date: row.get(7)?,
            received_date: row.get(8)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Decrements remaining_qty on a batch by the given amount.
///
/// The CHECK remaining_qty >= ?2 prevents accidental over-deduction.
/// This should be called inside a transaction alongside sale header + item inserts.
pub fn decrement_remaining_qty(conn: &Connection, batch_id: i64, decrement_by: i64) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE batches SET remaining_qty = remaining_qty - ?2 WHERE id = ?1 AND remaining_qty >= ?2",
        rusqlite::params![batch_id, decrement_by],
    )?;
    Ok(())
}

/// Finds all batches for a given medicine.
pub fn find_by_medicine(db: &Connection, medicine_id: i64) -> Result<Vec<Batch>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, medicine_id, purchase_id, purchase_item_id, purchase_price, \
                quantity, remaining_qty, expiry_date, received_date \
         FROM batches \
         WHERE medicine_id = ?1 \
         ORDER BY expiry_date ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![medicine_id], |row| {
        Ok(Batch {
            id: row.get(0)?,
            medicine_id: row.get(1)?,
            purchase_id: row.get(2)?,
            purchase_item_id: row.get(3)?,
            purchase_price: row.get(4)?,
            quantity: row.get(5)?,
            remaining_qty: row.get(6)?,
            expiry_date: row.get(7)?,
            received_date: row.get(8)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}
