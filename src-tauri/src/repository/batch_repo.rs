use rusqlite::Connection;

use crate::models::{Batch, BatchListDto, ExpiryReportRow};

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
/// Returns the number of rows affected — callers MUST check this to detect
/// stock inconsistencies (C-4 fix). Returns 0 if insufficient stock.
pub fn decrement_remaining_qty(conn: &Connection, batch_id: i64, decrement_by: i64) -> Result<usize, rusqlite::Error> {
    let rows = conn.execute(
        "UPDATE batches SET remaining_qty = remaining_qty - ?2 WHERE id = ?1 AND remaining_qty >= ?2",
        rusqlite::params![batch_id, decrement_by],
    )?;
    Ok(rows)
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

pub fn find_all_with_medicine(db: &Connection) -> Result<Vec<BatchListDto>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT b.id, b.medicine_id, m.name, b.batch_code, b.purchase_id, b.purchase_price, \
                b.quantity, b.remaining_qty, b.expiry_date, b.received_date \
         FROM batches b \
         JOIN medicines m ON m.id = b.medicine_id \
         ORDER BY b.expiry_date ASC, b.id ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(BatchListDto {
            id: row.get(0)?,
            medicine_id: row.get(1)?,
            medicine_name: row.get(2)?,
            batch_code: row.get(3)?,
            purchase_id: row.get(4)?,
            purchase_price: row.get(5)?,
            quantity: row.get(6)?,
            remaining_qty: row.get(7)?,
            expiry_date: row.get(8)?,
            received_date: row.get(9)?,
        })
    })?;

    rows.collect()
}

pub fn update_metadata(
    db: &Connection,
    batch_id: i64,
    batch_code: Option<&str>,
    expiry_date: &str,
) -> Result<(), rusqlite::Error> {
    db.execute(
        "UPDATE batches SET batch_code = ?2, expiry_date = ?3 WHERE id = ?1",
        rusqlite::params![batch_id, batch_code, expiry_date],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers;

    #[test]
    fn test_insert_batch() {
        let db = test_helpers::setup_test_db();
        let mid = test_helpers::seed_medicine(&db, "Panadol");
        let batch_id = insert(&db, mid, None, None, 5.0, 100, 100, "2027-12-31", Some("BATCH-001")).unwrap();
        assert!(batch_id > 0);

        let batches = find_by_medicine(&db, mid).unwrap();
        assert_eq!(batches.len(), 1);
        assert_eq!(batches[0].quantity, 100);
        assert_eq!(batches[0].remaining_qty, 100);

        // Verify batch_code via direct query (Batch struct doesn't store batch_code)
        let code: Option<String> = db.query_row(
            "SELECT batch_code FROM batches WHERE id = ?1",
            rusqlite::params![batch_id],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(code.as_deref(), Some("BATCH-001"));
    }

    #[test]
    fn test_get_current_stock() {
        let db = test_helpers::setup_test_db();
        let mid = test_helpers::seed_medicine(&db, "Panadol");
        insert(&db, mid, None, None, 5.0, 100, 80, "2027-12-31", None).unwrap();

        let stock = get_current_stock(&db, mid).unwrap();
        assert_eq!(stock, 80);
    }

    #[test]
    fn test_get_current_stock_excludes_expired() {
        let db = test_helpers::setup_test_db();
        let mid = test_helpers::seed_medicine(&db, "Panadol");
        // Expired batch
        insert(&db, mid, None, None, 5.0, 100, 100, "2020-01-01", None).unwrap();
        // Non-expired batch
        insert(&db, mid, None, None, 5.0, 50, 50, "2099-12-31", None).unwrap();

        let stock = get_current_stock(&db, mid).unwrap();
        assert_eq!(stock, 50); // Only non-expired counted
    }

    #[test]
    fn test_find_fifo_eligible() {
        let db = test_helpers::setup_test_db();
        let mid = test_helpers::seed_medicine(&db, "Panadol");
        // Batch expiring sooner (2027)
        let b1 = insert(&db, mid, None, None, 5.0, 100, 100, "2027-06-01", None).unwrap();
        // Batch expiring later (2028)
        let b2 = insert(&db, mid, None, None, 6.0, 100, 100, "2028-12-31", None).unwrap();

        let fifo = find_fifo_eligible(&db, mid).unwrap();
        assert_eq!(fifo.len(), 2);
        // Should be ordered by expiry ASC (sooner first)
        assert_eq!(fifo[0].id, b1);
        assert_eq!(fifo[1].id, b2);
    }

    #[test]
    fn test_find_fifo_eligible_excludes_expired() {
        let db = test_helpers::setup_test_db();
        let mid = test_helpers::seed_medicine(&db, "Panadol");
        insert(&db, mid, None, None, 5.0, 100, 100, "2020-01-01", None).unwrap();
        insert(&db, mid, None, None, 5.0, 100, 100, "2099-12-31", None).unwrap();

        let fifo = find_fifo_eligible(&db, mid).unwrap();
        assert_eq!(fifo.len(), 1); // Only non-expired
    }

    #[test]
    fn test_decrement_remaining_qty_success() {
        let db = test_helpers::setup_test_db();
        let mid = test_helpers::seed_medicine(&db, "Panadol");
        let batch_id = insert(&db, mid, None, None, 5.0, 100, 100, "2027-12-31", None).unwrap();

        let rows = decrement_remaining_qty(&db, batch_id, 30).unwrap();
        assert_eq!(rows, 1);

        let stock = get_current_stock(&db, mid).unwrap();
        assert_eq!(stock, 70);
    }

    #[test]
    fn test_decrement_remaining_qty_insufficient() {
        let db = test_helpers::setup_test_db();
        let mid = test_helpers::seed_medicine(&db, "Panadol");
        let batch_id = insert(&db, mid, None, None, 5.0, 10, 10, "2027-12-31", None).unwrap();

        let rows = decrement_remaining_qty(&db, batch_id, 20).unwrap();
        assert_eq!(rows, 0); // CHECK prevents over-deduction
    }

    #[test]
    fn test_expiry_report() {
        let db = test_helpers::setup_test_db();
        let mid = test_helpers::seed_medicine(&db, "Panadol");
        insert(&db, mid, None, None, 5.0, 100, 100, "2027-06-01", None).unwrap();

        let report = get_expiry_report(&db, None, None).unwrap();
        assert_eq!(report.len(), 1);
        assert_eq!(report[0].medicine_name, "Panadol");
        assert!(report[0].days_remaining > 0);
    }

    #[test]
    fn test_expiry_report_excludes_zero_remaining() {
        let db = test_helpers::setup_test_db();
        let mid = test_helpers::seed_medicine(&db, "Panadol");
        insert(&db, mid, None, None, 5.0, 100, 0, "2027-06-01", None).unwrap();

        let report = get_expiry_report(&db, None, None).unwrap();
        assert_eq!(report.len(), 0);
    }

    #[test]
    fn test_increment_remaining_qty() {
        let db = test_helpers::setup_test_db();
        let mid = test_helpers::seed_medicine(&db, "Panadol");
        let batch_id = insert(&db, mid, None, None, 5.0, 100, 80, "2027-12-31", None).unwrap();

        increment_remaining_qty(&db, batch_id, 10).unwrap();
        let stock = get_current_stock(&db, mid).unwrap();
        assert_eq!(stock, 90);
    }

    #[test]
    fn test_update_metadata() {
        let db = test_helpers::setup_test_db();
        let mid = test_helpers::seed_medicine(&db, "Panadol");
        let batch_id = insert(&db, mid, None, None, 5.0, 100, 100, "2027-12-31", None).unwrap();

        update_metadata(&db, batch_id, Some("NEW-CODE"), "2028-06-15").unwrap();

        let code: Option<String> = db.query_row(
            "SELECT batch_code FROM batches WHERE id = ?1",
            rusqlite::params![batch_id],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(code.as_deref(), Some("NEW-CODE"));

        let expiry: String = db.query_row(
            "SELECT expiry_date FROM batches WHERE id = ?1",
            rusqlite::params![batch_id],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(expiry, "2028-06-15");
    }
}
