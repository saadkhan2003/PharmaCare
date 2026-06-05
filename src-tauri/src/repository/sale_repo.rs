use rusqlite::Connection;

use crate::models::{Sale, SaleItem, TopSellerDto};

/// Inserts a sale header. Returns the new row id.
pub fn insert_sale(
    conn: &Connection,
    user_id: i64,
    subtotal: f64,
    bill_discount: f64,
    tax_rate: f64,
    tax_amount: f64,
    total: f64,
    payment_method: &str,
    customer_name: Option<&str>,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO sales (user_id, subtotal, bill_discount, tax_rate, tax_amount, total, payment_method, customer_name) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            user_id,
            subtotal,
            bill_discount,
            tax_rate,
            tax_amount,
            total,
            payment_method,
            customer_name,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Inserts a single sale_items row (one per batch allocation). Returns new row id.
pub fn insert_item(
    conn: &Connection,
    sale_id: i64,
    medicine_id: i64,
    batch_id: i64,
    quantity: i64,
    unit_price: f64,
    purchase_cost: f64,
    item_discount: f64,
    line_total: f64,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, purchase_cost, item_discount, line_total) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            sale_id,
            medicine_id,
            batch_id,
            quantity,
            unit_price,
            purchase_cost,
            item_discount,
            line_total,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Finds a sale by id.
pub fn find_by_id(conn: &Connection, sale_id: i64) -> Result<Option<Sale>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, subtotal, bill_discount, tax_rate, tax_amount, \
                total, payment_method, customer_name, created_at \
         FROM sales WHERE id = ?",
    )?;

    let mut rows = stmt.query_map(rusqlite::params![sale_id], |row| {
        Ok(Sale {
            id: row.get(0)?,
            user_id: row.get(1)?,
            subtotal: row.get(2)?,
            bill_discount: row.get(3)?,
            tax_rate: row.get(4)?,
            tax_amount: row.get(5)?,
            total: row.get(6)?,
            payment_method: row.get(7)?,
            customer_name: row.get(8)?,
            created_at: row.get(9)?,
        })
    })?;

    match rows.next() {
        Some(Ok(sale)) => Ok(Some(sale)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

/// Finds all items for a sale.
pub fn find_items_by_sale(conn: &Connection, sale_id: i64) -> Result<Vec<SaleItem>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, sale_id, medicine_id, batch_id, quantity, unit_price, \
                purchase_cost, item_discount, line_total \
         FROM sale_items \
         WHERE sale_id = ?1 \
         ORDER BY id ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![sale_id], |row| {
        Ok(SaleItem {
            id: row.get(0)?,
            sale_id: row.get(1)?,
            medicine_id: row.get(2)?,
            batch_id: row.get(3)?,
            quantity: row.get(4)?,
            unit_price: row.get(5)?,
            purchase_cost: row.get(6)?,
            item_discount: row.get(7)?,
            line_total: row.get(8)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Returns today's total sales revenue. D-41/REPT-01.
pub fn get_today_sales(conn: &Connection) -> Result<f64, rusqlite::Error> {
    conn.query_row(
        "SELECT COALESCE(ROUND(SUM(total), 2), 0) FROM sales WHERE date(created_at) = date('now')",
        [],
        |row| row.get(0),
    )
}

/// Returns today's profit: Σ(line_total - purchase_cost * quantity). D-41.
pub fn get_today_profit(conn: &Connection) -> Result<f64, rusqlite::Error> {
    conn.query_row(
        "SELECT COALESCE(ROUND(SUM(si.line_total - si.purchase_cost * si.quantity), 2), 0) \
         FROM sale_items si \
         JOIN sales s ON s.id = si.sale_id \
         WHERE date(s.created_at) = date('now')",
        [],
        |row| row.get(0),
    )
}

/// Returns current month's total sales. D-41.
pub fn get_month_sales(conn: &Connection) -> Result<f64, rusqlite::Error> {
    conn.query_row(
        "SELECT COALESCE(ROUND(SUM(total), 2), 0) FROM sales \
         WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')",
        [],
        |row| row.get(0),
    )
}

/// Returns top 5 selling medicines (by quantity) in the last 7 days. D-41.
pub fn get_top_sellers(conn: &Connection) -> Result<Vec<TopSellerDto>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT si.medicine_id, m.name, SUM(si.quantity) as total_qty \
         FROM sale_items si \
         JOIN medicines m ON m.id = si.medicine_id \
         JOIN sales s ON s.id = si.sale_id \
         WHERE date(s.created_at) >= date('now', '-7 days') \
         GROUP BY si.medicine_id \
         ORDER BY total_qty DESC \
         LIMIT 5",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(TopSellerDto {
            medicine_id: row.get(0)?,
            medicine_name: row.get(1)?,
            total_qty: row.get(2)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Returns count of low-stock medicines (current_stock < reorder_level).
pub fn get_low_stock_count(conn: &Connection) -> Result<i64, rusqlite::Error> {
    conn.query_row(
        "SELECT COUNT(*) FROM medicines m \
         WHERE m.is_active = 1 \
           AND COALESCE(( \
               SELECT SUM(b.remaining_qty) FROM batches b \
               WHERE b.medicine_id = m.id AND b.expiry_date > date('now') \
           ), 0) < m.reorder_level",
        [],
        |row| row.get(0),
    )
}

/// Returns count of batches expiring within N days and still > 0.
pub fn get_expiry_count(conn: &Connection, max_days: i64) -> Result<i64, rusqlite::Error> {
    conn.query_row(
        "SELECT COUNT(DISTINCT b.id) \
         FROM batches b \
         JOIN medicines m ON m.id = b.medicine_id \
         WHERE b.remaining_qty > 0 \
           AND m.is_active = 1 \
           AND b.expiry_date > date('now') \
           AND CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) <= ?1",
        rusqlite::params![max_days],
        |row| row.get(0),
    )
}
