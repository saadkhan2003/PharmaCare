use rusqlite::Connection;
use crate::models::debt::*;

pub fn insert_debtor(db: &Connection, dto: &CreateDebtRequest) -> Result<i64, rusqlite::Error> {
    let status = "pending";
    db.execute(
        "INSERT INTO debtors (customer_name, phone, total_amount, due_date, notes, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![dto.customer_name, dto.phone, dto.total_amount(), dto.due_date, dto.notes, status],
    )?;
    Ok(db.last_insert_rowid())
}

pub fn insert_debt_item(db: &Connection, debt_id: i64, item: &DebtItemRequest) -> Result<(), rusqlite::Error> {
    db.execute(
        "INSERT INTO debt_items (debt_id, medicine_name, quantity, amount) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![debt_id, item.medicine_name, item.quantity, item.amount],
    )?;
    Ok(())
}

pub fn list_debtors(db: &Connection) -> Result<Vec<DebtorListItem>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT d.id, d.customer_name, d.phone, d.total_amount, d.paid_amount, d.due_date, d.status, d.created_at, 
                CAST((julianday(d.due_date) - julianday('now')) AS INTEGER) as days_remaining,
                (SELECT COUNT(*) FROM debt_items WHERE debt_id = d.id) as item_count
         FROM debtors d ORDER BY 
            CASE d.status WHEN 'overdue' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
            days_remaining ASC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(DebtorListItem {
            id: row.get(0)?,
            customer_name: row.get(1)?,
            phone: row.get(2)?,
            total_amount: row.get(3)?,
            paid_amount: row.get(4)?,
            remaining: row.get::<_, f64>(3)? - row.get::<_, f64>(4)?,
            due_date: row.get(5)?,
            status: row.get(6)?,
            days_remaining: row.get(8)?,
            item_count: row.get(9)?,
        })
    })?;
    let mut results = Vec::new();
    for row in rows { results.push(row?); }
    Ok(results)
}

pub fn get_debt_detail(db: &Connection, id: i64) -> Result<Option<DebtDetail>, rusqlite::Error> {
    let mut stmt = db.prepare("SELECT id, customer_name, phone, total_amount, paid_amount, due_date, notes, status, created_at FROM debtors WHERE id = ?1")?;
    let debtor = stmt.query_row(rusqlite::params![id], |row| {
        Ok(Debtor {
            id: row.get(0)?, customer_name: row.get(1)?, phone: row.get(2)?,
            total_amount: row.get(3)?, paid_amount: row.get(4)?, due_date: row.get(5)?,
            notes: row.get(6)?, status: row.get(7)?, created_at: row.get(8)?,
        })
    }).ok();
    match debtor {
        Some(d) => {
            let mut stmt2 = db.prepare("SELECT id, debt_id, sale_id, medicine_name, quantity, amount FROM debt_items WHERE debt_id = ?1")?;
            let items = stmt2.query_map(rusqlite::params![id], |row| {
                Ok(DebtItem {
                    id: row.get(0)?, debt_id: row.get(1)?, sale_id: row.get(2)?,
                    medicine_name: row.get(3)?, quantity: row.get(4)?, amount: row.get(5)?,
                })
            })?.filter_map(|r| r.ok()).collect();
            Ok(Some(DebtDetail { debtor: d, items }))
        }
        None => Ok(None),
    }
}

pub fn mark_as_paid(db: &Connection, id: i64, amount: f64) -> Result<(), rusqlite::Error> {
    db.execute(
        "UPDATE debtors SET paid_amount = paid_amount + ?1, status = CASE WHEN paid_amount + ?1 >= total_amount THEN 'paid' ELSE status END, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![amount, id],
    )?;
    Ok(())
}

pub fn update_overdue_status(db: &Connection) -> Result<(), rusqlite::Error> {
    db.execute(
        "UPDATE debtors SET status = 'overdue' WHERE status = 'pending' AND due_date < date('now')",
        [],
    )?;
    Ok(())
}

pub fn get_overdue_count(db: &Connection) -> Result<i64, rusqlite::Error> {
    let count: i64 = db.query_row(
        "SELECT COUNT(*) FROM debtors WHERE status = 'overdue'",
        [],
        |row| row.get(0),
    )?;
    Ok(count)
}
