use rusqlite::Connection;
use crate::errors::CommandError;
use crate::models::supplier_debt::*;
use crate::repository::supplier_debt_repo;

pub fn create_debt(db: &mut Connection, dto: &CreateSupplierDebtRequest) -> Result<SupplierDebt, CommandError> {
    if dto.total_amount <= 0.0 {
        return Err(CommandError::validation("Total amount must be positive"));
    }
    supplier_debt_repo::insert_debt(db, dto)
        .map_err(|e| CommandError::internal(&e.to_string()))
}

pub fn list_debts(db: &Connection, supplier_id: Option<i64>) -> Result<Vec<SupplierDebtListItem>, CommandError> {
    supplier_debt_repo::update_overdue_status(db)
        .map_err(|e| CommandError::internal(&e.to_string()))?;
    supplier_debt_repo::list_debts(db, supplier_id)
        .map_err(|e| CommandError::internal(&e.to_string()))
}

pub fn get_debt(db: &Connection, debt_id: i64) -> Result<SupplierDebtDetail, CommandError> {
    supplier_debt_repo::get_debt_detail(db, debt_id)?
        .ok_or_else(|| CommandError::not_found("Supplier debt"))
}

pub fn record_payment(db: &mut Connection, dto: &RecordSupplierPaymentRequest) -> Result<SupplierPayment, CommandError> {
    let detail = supplier_debt_repo::get_debt_detail(db, dto.debt_id)?
        .ok_or_else(|| CommandError::not_found("Supplier debt"))?;
    let remaining = detail.debt.total_amount - detail.debt.paid_amount;
    if dto.amount <= 0.0 {
        return Err(CommandError::validation("Payment amount must be positive"));
    }
    if dto.amount > remaining + 0.001 {
        return Err(CommandError::validation(&format!(
            "Amount {:.2} exceeds remaining balance {:.2}", dto.amount, remaining
        )));
    }
    supplier_debt_repo::record_payment(db, dto)
        .map_err(|e| CommandError::internal(&e.to_string()))
}

pub fn get_overdue_count(db: &Connection) -> Result<i64, CommandError> {
    supplier_debt_repo::update_overdue_status(db)
        .map_err(|e| CommandError::internal(&e.to_string()))?;
    supplier_debt_repo::get_overdue_count(db)
        .map_err(|e| CommandError::internal(&e.to_string()))
}

pub fn create_from_purchase(
    db: &mut Connection,
    purchase_id: i64,
    supplier_id: i64,
    total_cost: f64,
    paid_amount: f64,
    payment_status: &str,
    due_date: Option<String>,
) -> Result<SupplierDebt, CommandError> {
    if payment_status == "Paid" {
        return Err(CommandError::validation("Cannot create debt for fully paid purchase"));
    }
    let remaining = total_cost - paid_amount;
    if remaining <= 0.0 {
        return Err(CommandError::validation("No remaining amount to track"));
    }
    let dto = CreateSupplierDebtRequest {
        supplier_id,
        purchase_id: Some(purchase_id),
        total_amount: total_cost,
        paid_amount: Some(paid_amount),
        due_date,
        notes: Some(format!("Auto-created from purchase #{}", purchase_id)),
    };
    let debt = supplier_debt_repo::insert_debt(db, &dto)
        .map_err(|e| CommandError::internal(&e.to_string()))?;

    if paid_amount > 0.0 {
        let _ = db.execute(
            "INSERT INTO supplier_payments (debt_id, amount, notes, recorded_by) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![debt.id, paid_amount, "Initial payment recorded at purchase time", 1],
        );
    }
    Ok(debt)
}
