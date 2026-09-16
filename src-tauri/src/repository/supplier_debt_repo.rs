use rusqlite::Connection;
use crate::models::supplier_debt::*;

pub fn insert_debt(conn: &Connection, dto: &CreateSupplierDebtRequest) -> Result<SupplierDebt, rusqlite::Error> {
    let paid = dto.paid_amount.unwrap_or(0.0);
    let status = if paid <= 0.0 {
        "Pending"
    } else if paid >= dto.total_amount {
        "Paid"
    } else {
        "Partial"
    };

    conn.execute(
        "INSERT INTO supplier_debts (supplier_id, purchase_id, total_amount, paid_amount, due_date, status, notes) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            dto.supplier_id,
            dto.purchase_id,
            dto.total_amount,
            paid,
            dto.due_date,
            status,
            dto.notes,
        ],
    )?;
    let id = conn.last_insert_rowid();
    get_debt_by_id(conn, id)
}

pub fn get_debt_by_id(conn: &Connection, id: i64) -> Result<SupplierDebt, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT sd.id, sd.supplier_id, s.company_name, sd.purchase_id, \
                sd.total_amount, sd.paid_amount, sd.due_date, sd.status, \
                sd.notes, sd.created_at, sd.updated_at \
         FROM supplier_debts sd \
         JOIN suppliers s ON s.id = sd.supplier_id \
         WHERE sd.id = ?1",
    )?;
    let debt = stmt.query_row(rusqlite::params![id], |row| {
        let total: f64 = row.get(4)?;
        let paid: f64 = row.get(5)?;
        Ok(SupplierDebt {
            id: row.get(0)?,
            supplier_id: row.get(1)?,
            supplier_name: row.get(2)?,
            purchase_id: row.get(3)?,
            total_amount: total,
            paid_amount: paid,
            remaining_amount: total - paid,
            due_date: row.get(6)?,
            status: row.get(7)?,
            notes: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;
    Ok(debt)
}

pub fn list_debts(conn: &Connection, supplier_id: Option<i64>) -> Result<Vec<SupplierDebtListItem>, rusqlite::Error> {
    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(sid) = supplier_id {
        (
            "SELECT sd.id, sd.supplier_id, s.company_name, sd.purchase_id, \
                    sd.total_amount, sd.paid_amount, sd.due_date, sd.status, \
                    sd.notes, sd.created_at \
             FROM supplier_debts sd \
             JOIN suppliers s ON s.id = sd.supplier_id \
             WHERE sd.supplier_id = ?1 \
             ORDER BY \
                CASE sd.status WHEN 'Pending' THEN 0 WHEN 'Partial' THEN 1 ELSE 2 END, \
                sd.created_at DESC"
                .to_string(),
            vec![Box::new(sid)],
        )
    } else {
        (
            "SELECT sd.id, sd.supplier_id, s.company_name, sd.purchase_id, \
                    sd.total_amount, sd.paid_amount, sd.due_date, sd.status, \
                    sd.notes, sd.created_at \
             FROM supplier_debts sd \
             JOIN suppliers s ON s.id = sd.supplier_id \
             ORDER BY \
                CASE sd.status WHEN 'Pending' THEN 0 WHEN 'Partial' THEN 1 ELSE 2 END, \
                sd.created_at DESC"
                .to_string(),
            vec![],
        )
    };

    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        let total: f64 = row.get(4)?;
        let paid: f64 = row.get(5)?;
        Ok(SupplierDebtListItem {
            id: row.get(0)?,
            supplier_id: row.get(1)?,
            supplier_name: row.get(2)?,
            purchase_id: row.get(3)?,
            total_amount: total,
            paid_amount: paid,
            remaining_amount: total - paid,
            due_date: row.get(6)?,
            status: row.get(7)?,
            notes: row.get(8)?,
            created_at: row.get(9)?,
        })
    })?;
    let mut results = Vec::new();
    for row in rows { results.push(row?); }
    Ok(results)
}

pub fn get_debt_detail(conn: &Connection, debt_id: i64) -> Result<Option<SupplierDebtDetail>, rusqlite::Error> {
    match get_debt_by_id(conn, debt_id) {
        Ok(debt) => {
            let mut stmt = conn.prepare(
                "SELECT id, debt_id, amount, payment_date, notes, recorded_by, created_at \
                 FROM supplier_payments WHERE debt_id = ?1 ORDER BY created_at ASC",
            )?;
            let payments = stmt.query_map(rusqlite::params![debt_id], |row| {
                Ok(SupplierPayment {
                    id: row.get(0)?,
                    debt_id: row.get(1)?,
                    amount: row.get(2)?,
                    payment_date: row.get(3)?,
                    notes: row.get(4)?,
                    recorded_by: row.get(5)?,
                    created_at: row.get(6)?,
                })
            })?.filter_map(|r| r.ok()).collect();
            Ok(Some(SupplierDebtDetail { debt, payments }))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn record_payment(conn: &Connection, dto: &RecordSupplierPaymentRequest) -> Result<SupplierPayment, rusqlite::Error> {
    let is_literal = dto.payment_date.is_some();

    if is_literal {
        conn.execute(
            "INSERT INTO supplier_payments (debt_id, amount, payment_date, notes, recorded_by) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![dto.debt_id, dto.amount, dto.payment_date, dto.notes, dto.recorded_by],
        )?;
    } else {
        conn.execute(
            "INSERT INTO supplier_payments (debt_id, amount, notes, recorded_by) \
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![dto.debt_id, dto.amount, dto.notes, dto.recorded_by],
        )?;
    }

    conn.execute(
        "UPDATE supplier_debts \
         SET paid_amount = paid_amount + ?1, \
             status = CASE \
                 WHEN paid_amount + ?1 >= total_amount THEN 'Paid' \
                 WHEN paid_amount + ?1 > 0 THEN 'Partial' \
                 ELSE status \
             END, \
             updated_at = datetime('now') \
         WHERE id = ?2",
        rusqlite::params![dto.amount, dto.debt_id],
    )?;

    // Synchronize linked purchase payment_status if this debt belongs to a purchase
    let debt_info: Option<(Option<i64>, String)> = conn
        .query_row(
            "SELECT purchase_id, status FROM supplier_debts WHERE id = ?1",
            rusqlite::params![dto.debt_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    if let Some((Some(purchase_id), status)) = debt_info {
        let _ = conn.execute(
            "UPDATE purchases SET payment_status = ?1 WHERE id = ?2",
            rusqlite::params![status, purchase_id],
        );
    }

    let payment_id = conn.last_insert_rowid();
    let mut stmt = conn.prepare(
        "SELECT id, debt_id, amount, payment_date, notes, recorded_by, created_at \
         FROM supplier_payments WHERE id = ?1",
    )?;
    let payment = stmt.query_row(rusqlite::params![payment_id], |row| {
        Ok(SupplierPayment {
            id: row.get(0)?,
            debt_id: row.get(1)?,
            amount: row.get(2)?,
            payment_date: row.get(3)?,
            notes: row.get(4)?,
            recorded_by: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    Ok(payment)
}

pub fn get_overdue_count(conn: &Connection) -> Result<i64, rusqlite::Error> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM supplier_debts \
         WHERE status != 'Paid' AND due_date IS NOT NULL AND due_date < date('now')",
        [],
        |row| row.get(0),
    )?;
    Ok(count)
}

pub fn update_overdue_status(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE supplier_debts SET status = 'Pending', updated_at = datetime('now') \
         WHERE status != 'Paid' AND due_date IS NOT NULL AND due_date < date('now') AND status != 'Pending'",
        [],
    )?;
    Ok(())
}

pub fn get_by_supplier(conn: &Connection, supplier_id: i64) -> Result<Vec<SupplierDebtListItem>, rusqlite::Error> {
    list_debts(conn, Some(supplier_id))
}

pub fn get_last_insert_id(conn: &Connection) -> Result<i64, rusqlite::Error> {
    Ok(conn.last_insert_rowid())
}
