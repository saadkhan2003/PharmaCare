use rusqlite::Connection;
use crate::errors::CommandError;
use crate::models::debt::*;
use crate::repository::debt_repo;

pub fn create_debt(db: &Connection, dto: &CreateDebtRequest) -> Result<Debtor, CommandError> {
    if dto.customer_name.trim().is_empty() {
        return Err(CommandError::validation("Customer name is required"));
    }
    if dto.items.is_empty() {
        return Err(CommandError::validation("At least one item is required"));
    }
    let debt_id = debt_repo::insert_debtor(db, dto)?;
    for item in &dto.items {
        debt_repo::insert_debt_item(db, debt_id, item)?;
    }
    debt_repo::update_overdue_status(db)?;
    let detail = debt_repo::get_debt_detail(db, debt_id)?
        .ok_or_else(|| CommandError::internal("Debt created but not found"))?;
    Ok(detail.debtor)
}

pub fn list_debts(db: &Connection) -> Result<Vec<DebtorListItem>, CommandError> {
    debt_repo::update_overdue_status(db)?;
    debt_repo::list_debtors(db).map_err(|e| CommandError::internal(&e.to_string()))
}

pub fn get_debt(db: &Connection, id: i64) -> Result<DebtDetail, CommandError> {
    debt_repo::get_debt_detail(db, id)?
        .ok_or_else(|| CommandError::not_found("Debt"))
}

pub fn record_payment(db: &Connection, id: i64, amount: f64) -> Result<Debtor, CommandError> {
    let detail = debt_repo::get_debt_detail(db, id)?
        .ok_or_else(|| CommandError::not_found("Debt"))?;
    let remaining = detail.debtor.total_amount - detail.debtor.paid_amount;
    if amount <= 0.0 {
        return Err(CommandError::validation("Payment amount must be positive"));
    }
    if amount > remaining {
        return Err(CommandError::validation(&format!(
            "Amount {:.2} exceeds remaining balance {:.2}", amount, remaining
        )));
    }
    debt_repo::mark_as_paid(db, id, amount)?;
    debt_repo::update_overdue_status(db)?;
    let updated = debt_repo::get_debt_detail(db, id)?
        .ok_or_else(|| CommandError::internal("Debt not found after payment"))?;
    Ok(updated.debtor)
}

pub fn get_overdue_count(db: &Connection) -> Result<i64, CommandError> {
    debt_repo::update_overdue_status(db)?;
    debt_repo::get_overdue_count(db).map_err(|e| CommandError::internal(&e.to_string()))
}
