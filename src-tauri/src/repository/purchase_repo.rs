use rusqlite::Connection;

use crate::models::Purchase;
use crate::models::PurchaseItem;

/// Inserts a new purchase. Returns the new row id.
pub fn insert_purchase(
    conn: &Connection,
    supplier_id: i64,
    invoice_number: Option<&str>,
    purchase_date: &str,
    total_cost: f64,
    payment_status: &str,
    notes: Option<&str>,
    user_id: i64,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO purchases (supplier_id, invoice_number, purchase_date, total_cost, payment_status, notes, user_id) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            supplier_id,
            invoice_number,
            purchase_date,
            total_cost,
            payment_status,
            notes,
            user_id,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Inserts a purchase item. Returns the new row id.
pub fn insert_item(
    conn: &Connection,
    purchase_id: i64,
    medicine_id: i64,
    quantity: i64,
    purchase_price: f64,
    expiry_date: &str,
    line_cost: f64,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO purchase_items (purchase_id, medicine_id, quantity, purchase_price, expiry_date, line_cost) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            purchase_id,
            medicine_id,
            quantity,
            purchase_price,
            expiry_date,
            line_cost,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Updates the batch_id on a purchase_item after batch creation.
pub fn update_item_batch_id(
    conn: &Connection,
    item_id: i64,
    batch_id: i64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE purchase_items SET batch_id = ?2 WHERE id = ?1",
        rusqlite::params![item_id, batch_id],
    )?;
    Ok(())
}

/// Updates the total_cost on a purchase after all items are inserted.
pub fn update_purchase_total(
    conn: &Connection,
    purchase_id: i64,
    total_cost: f64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE purchases SET total_cost = ?2 WHERE id = ?1",
        rusqlite::params![purchase_id, total_cost],
    )?;
    Ok(())
}

/// Finds a purchase by id.
pub fn find_by_id(
    conn: &Connection,
    purchase_id: i64,
) -> Result<Option<Purchase>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, supplier_id, invoice_number, purchase_date, total_cost, \
                payment_status, notes, user_id, created_at \
         FROM purchases WHERE id = ?",
    )?;

    let mut rows = stmt.query_map(rusqlite::params![purchase_id], |row| {
        Ok(Purchase {
            id: row.get(0)?,
            supplier_id: row.get(1)?,
            invoice_number: row.get(2)?,
            purchase_date: row.get(3)?,
            total_cost: row.get(4)?,
            payment_status: row.get(5)?,
            notes: row.get(6)?,
            user_id: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;

    match rows.next() {
        Some(Ok(purchase)) => Ok(Some(purchase)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

/// Finds all items for a given purchase, ordered by id ASC.
pub fn find_items_by_purchase_id(
    conn: &Connection,
    purchase_id: i64,
) -> Result<Vec<PurchaseItem>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, purchase_id, medicine_id, quantity, purchase_price, \
                expiry_date, batch_id, line_cost \
         FROM purchase_items \
         WHERE purchase_id = ?1 \
         ORDER BY id ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![purchase_id], |row| {
        Ok(PurchaseItem {
            id: row.get(0)?,
            purchase_id: row.get(1)?,
            medicine_id: row.get(2)?,
            quantity: row.get(3)?,
            purchase_price: row.get(4)?,
            expiry_date: row.get(5)?,
            batch_id: row.get(6)?,
            line_cost: row.get(7)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Internal helper for mapping a purchase + supplier_name tuple.
struct PurchaseRow {
    purchase: Purchase,
    supplier_name: String,
}

/// Finds all purchases joined with supplier name, ordered by created_at DESC, limited to 100.
/// Returns Vec of (Purchase, supplier_name).
pub fn find_all(conn: &Connection) -> Result<Vec<(Purchase, String)>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.supplier_id, p.invoice_number, p.purchase_date, p.total_cost, \
                p.payment_status, p.notes, p.user_id, p.created_at, \
                s.company_name \
         FROM purchases p \
         JOIN suppliers s ON s.id = p.supplier_id \
         ORDER BY p.created_at DESC \
         LIMIT 100",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(PurchaseRow {
            purchase: Purchase {
                id: row.get(0)?,
                supplier_id: row.get(1)?,
                invoice_number: row.get(2)?,
                purchase_date: row.get(3)?,
                total_cost: row.get(4)?,
                payment_status: row.get(5)?,
                notes: row.get(6)?,
                user_id: row.get(7)?,
                created_at: row.get(8)?,
            },
            supplier_name: row.get(9)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        let r = row?;
        results.push((r.purchase, r.supplier_name));
    }
    Ok(results)
}

/// Gets the count of items for a given purchase.
pub fn get_item_count(
    conn: &Connection,
    purchase_id: i64,
) -> Result<i64, rusqlite::Error> {
    conn.query_row(
        "SELECT COUNT(*) FROM purchase_items WHERE purchase_id = ?1",
        rusqlite::params![purchase_id],
        |row| row.get(0),
    )
}
