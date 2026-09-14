use rusqlite::Connection;

use crate::models::{Sale, SaleDetailItemDto, SaleItem, SaleListDto, TopSellerDto};

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

pub fn find_recent(
    conn: &Connection,
    query: &str,
    start_date: &str,
    end_date: &str,
    offset: i64,
    limit: i64,
) -> Result<(Vec<SaleListDto>, i64), rusqlite::Error> {
    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if !query.is_empty() {
        let pattern = format!("%{}%", query);
        conditions.push(
            "(CAST(s.id AS TEXT) LIKE ? OR s.customer_name LIKE ? OR s.payment_method LIKE ? OR m.name LIKE ?)".to_string(),
        );
        params.push(Box::new(pattern.clone()));
        params.push(Box::new(pattern.clone()));
        params.push(Box::new(pattern.clone()));
        params.push(Box::new(pattern));
    }
    if !start_date.is_empty() {
        conditions.push("s.created_at >= ?".to_string());
        params.push(Box::new(start_date.to_string()));
    }
    if !end_date.is_empty() {
        conditions.push("s.created_at <= ?".to_string());
        params.push(Box::new(end_date.to_string()));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {} ", conditions.join(" AND "))
    };

    let count_sql = format!(
        "SELECT COUNT(*) FROM (SELECT s.id \
         FROM sales s \
         LEFT JOIN sale_items si ON si.sale_id = s.id \
         LEFT JOIN medicines m ON m.id = si.medicine_id \
         {} \
         GROUP BY s.id)",
        where_clause
    );

    let total: i64 = if params.is_empty() {
        conn.query_row(&count_sql, [], |row| row.get(0))?
    } else {
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        conn.query_row(&count_sql, param_refs.as_slice(), |row| row.get(0))?
    };

    let data_sql = format!(
        "SELECT s.id, s.total, s.payment_method, s.customer_name, COUNT(si.id) AS item_count, s.created_at,
            COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.return_type = 'customer' AND r.reference_id = s.id), 0) as total_returned_qty,
            COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.return_type = 'customer' AND r.reference_id = s.id), 0) as total_refund_amount
         FROM sales s \
         LEFT JOIN sale_items si ON si.sale_id = s.id \
         LEFT JOIN medicines m ON m.id = si.medicine_id \
         {} \
         GROUP BY s.id \
         ORDER BY s.created_at DESC \
         LIMIT {} OFFSET {}",
        where_clause, limit, offset
    );

    let mut stmt = conn.prepare(&data_sql)?;

    let rows: Vec<SaleListDto> = if params.is_empty() {
        stmt.query_map([], |row| {
        Ok(SaleListDto {
            id: row.get(0)?,
            total: row.get(1)?,
            payment_method: row.get(2)?,
            customer_name: row.get(3)?,
            item_count: row.get(4)?,
            created_at: row.get(5)?,
            total_returned_qty: row.get(6)?,
            total_refund_amount: row.get(7)?,
        })
    })?
        .collect::<Result<Vec<_>, _>>()?
    } else {
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        stmt.query_map(param_refs.as_slice(), |row| {
        Ok(SaleListDto {
            id: row.get(0)?,
            total: row.get(1)?,
            payment_method: row.get(2)?,
            customer_name: row.get(3)?,
            item_count: row.get(4)?,
            created_at: row.get(5)?,
            total_returned_qty: row.get(6)?,
            total_refund_amount: row.get(7)?,
        })
    })?
        .collect::<Result<Vec<_>, _>>()?
    };

    Ok((rows, total))
}

pub fn find_detail_items(conn: &Connection, sale_id: i64) -> Result<Vec<SaleDetailItemDto>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT si.id, m.name, si.batch_id, si.quantity, si.unit_price, si.purchase_cost, \
                si.item_discount, si.line_total \
         FROM sale_items si \
         JOIN medicines m ON m.id = si.medicine_id \
         WHERE si.sale_id = ?1 \
         ORDER BY si.id ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![sale_id], |row| {
        Ok(SaleDetailItemDto {
            id: row.get(0)?,
            medicine_name: row.get(1)?,
            batch_id: row.get(2)?,
            quantity: row.get(3)?,
            unit_price: row.get(4)?,
            purchase_cost: row.get(5)?,
            item_discount: row.get(6)?,
            line_total: row.get(7)?,
        })
    })?;

    rows.collect()
}

/// Returns today's total sales revenue minus customer returns. D-41/REPT-01.
pub fn get_today_sales(conn: &Connection) -> Result<f64, rusqlite::Error> {
    conn.query_row(
        "SELECT COALESCE(ROUND(SUM(total), 2), 0)
         - COALESCE((SELECT ROUND(SUM(refund_amount), 2) FROM returns
             WHERE return_type = 'customer' AND date(return_date) = date('now')), 0)
         FROM sales WHERE date(created_at) = date('now')",
        [],
        |row| row.get(0),
    )
}

/// Returns today's profit minus customer returns: Σ(line_total - purchase_cost * quantity) - refunds. D-41.
pub fn get_today_profit(conn: &Connection) -> Result<f64, rusqlite::Error> {
    conn.query_row(
        "SELECT COALESCE(ROUND(SUM(si.line_total - si.purchase_cost * si.quantity), 2), 0)
         - COALESCE((SELECT ROUND(SUM(r.refund_amount - COALESCE(
             (SELECT si2.purchase_cost * r.quantity FROM sale_items si2
              WHERE si2.sale_id = r.reference_id AND si2.medicine_id = r.medicine_id LIMIT 1),
             0)), 2) FROM returns r
             WHERE r.return_type = 'customer' AND date(r.return_date) = date('now')), 0)
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE date(s.created_at) = date('now')",
        [],
        |row| row.get(0),
    )
}

/// Returns current month's total sales minus customer returns. D-41.
pub fn get_month_sales(conn: &Connection) -> Result<f64, rusqlite::Error> {
    conn.query_row(
        "SELECT COALESCE(ROUND(SUM(total), 2), 0)
         - COALESCE((SELECT ROUND(SUM(refund_amount), 2) FROM returns
             WHERE return_type = 'customer'
             AND strftime('%Y-%m', return_date) = strftime('%Y-%m', 'now')), 0)
         FROM sales
         WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')",
        [],
        |row| row.get(0),
    )
}

/// Returns top 5 selling medicines (by quantity) in the last 7 days, minus returns. D-41.
pub fn get_top_sellers(conn: &Connection) -> Result<Vec<TopSellerDto>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT si.medicine_id, m.name,
            SUM(si.quantity)
            - COALESCE((SELECT SUM(r.quantity) FROM returns r
                WHERE r.return_type = 'customer' AND r.medicine_id = si.medicine_id
                AND date(r.return_date) >= date('now', '-7 days')), 0)
            as total_qty
         FROM sale_items si
         JOIN medicines m ON m.id = si.medicine_id
         JOIN sales s ON s.id = si.sale_id
         WHERE date(s.created_at) >= date('now', '-7 days')
         GROUP BY si.medicine_id
         ORDER BY total_qty DESC
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
