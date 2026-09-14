use rusqlite::Connection;
use crate::errors::CommandError;
use crate::models::debt::*;
use crate::repository::debt_repo;

pub fn create_debt(db: &mut Connection, dto: &CreateDebtRequest) -> Result<Debtor, CommandError> {
    if dto.customer_name.trim().is_empty() {
        return Err(CommandError::validation("Customer name is required"));
    }
    if dto.items.is_empty() {
        return Err(CommandError::validation("At least one item is required"));
    }
    // M-3 fix: Wrap in transaction for atomicity
    let tx = db.transaction().map_err(|e| CommandError::internal(&format!("Transaction error: {}", e)))?;
    let debt_id = debt_repo::insert_debtor(&tx, dto)?;
    for item in &dto.items {
        debt_repo::insert_debt_item(&tx, debt_id, item)?;
    }
    tx.commit().map_err(|e| CommandError::internal(&format!("Commit failed: {}", e)))?;
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

pub fn record_payment(db: &mut Connection, id: i64, amount: f64) -> Result<Debtor, CommandError> {
    let detail = debt_repo::get_debt_detail(db, id)?
        .ok_or_else(|| CommandError::not_found("Debt"))?;
    let remaining = detail.debtor.total_amount - detail.debtor.paid_amount;
    if amount.is_nan() || amount <= 0.0 {
        return Err(CommandError::validation("Payment amount must be positive"));
    }
    if amount > remaining {
        return Err(CommandError::validation(&format!(
            "Amount {:.2} exceeds remaining balance {:.2}", amount, remaining
        )));
    }
    // M-3 fix: Wrap in transaction for atomicity
    let tx = db.transaction().map_err(|e| CommandError::internal(&format!("Transaction error: {}", e)))?;
    debt_repo::mark_as_paid(&tx, id, amount)?;
    debt_repo::update_overdue_status(&tx)?;
    tx.commit().map_err(|e| CommandError::internal(&format!("Commit failed: {}", e)))?;
    let updated = debt_repo::get_debt_detail(db, id)?
        .ok_or_else(|| CommandError::internal("Debt not found after payment"))?;
    Ok(updated.debtor)
}

pub fn get_overdue_count(db: &Connection) -> Result<i64, CommandError> {
    debt_repo::update_overdue_status(db)?;
    debt_repo::get_overdue_count(db).map_err(|e| CommandError::internal(&e.to_string()))
}

pub fn get_due_soon_count(db: &Connection) -> Result<i64, CommandError> {
    debt_repo::update_overdue_status(db)?;
    debt_repo::get_due_soon_count(db).map_err(|e| CommandError::internal(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers;

    fn make_debt_dto(name: &str, amount: f64) -> CreateDebtRequest {
        CreateDebtRequest {
            customer_name: name.into(),
            phone: Some("1234567890".into()),
            items: vec![DebtItemRequest {
                medicine_name: "Panadol".into(),
                quantity: 10,
                amount,
            }],
            due_date: "2099-12-31".into(),
            notes: None,
        }
    }

    #[test]
    fn test_create_debt_success() {
        let mut db = test_helpers::setup_test_db();
        let dto = make_debt_dto("John Doe", 500.0);
        let debtor = create_debt(&mut db, &dto).unwrap();
        assert_eq!(debtor.customer_name, "John Doe");
        assert!((debtor.total_amount - 500.0).abs() < 0.01);
        assert!((debtor.paid_amount - 0.0).abs() < 0.01);
        assert_eq!(debtor.status, "pending");
    }

    #[test]
    fn test_create_debt_empty_customer_name() {
        let mut db = test_helpers::setup_test_db();
        let dto = CreateDebtRequest {
            customer_name: "   ".into(),
            phone: None,
            items: vec![DebtItemRequest {
                medicine_name: "Panadol".into(),
                quantity: 1,
                amount: 100.0,
            }],
            due_date: "2099-12-31".into(),
            notes: None,
        };
        let result = create_debt(&mut db, &dto);
        assert!(result.is_err());
    }

    #[test]
    fn test_create_debt_empty_items() {
        let mut db = test_helpers::setup_test_db();
        let dto = CreateDebtRequest {
            customer_name: "John".into(),
            phone: None,
            items: vec![],
            due_date: "2099-12-31".into(),
            notes: None,
        };
        let result = create_debt(&mut db, &dto);
        assert!(result.is_err());
    }

    #[test]
    fn test_record_valid_payment() {
        let mut db = test_helpers::setup_test_db();
        let dto = make_debt_dto("John Doe", 500.0);
        let debtor = create_debt(&mut db, &dto).unwrap();

        let updated = record_payment(&mut db, debtor.id, 200.0).unwrap();
        assert!((updated.paid_amount - 200.0).abs() < 0.01);
        assert_eq!(updated.status, "pending");
    }

    #[test]
    fn test_record_full_payment_marks_paid() {
        let mut db = test_helpers::setup_test_db();
        let dto = make_debt_dto("John Doe", 500.0);
        let debtor = create_debt(&mut db, &dto).unwrap();

        let updated = record_payment(&mut db, debtor.id, 500.0).unwrap();
        assert!((updated.paid_amount - 500.0).abs() < 0.01);
        assert_eq!(updated.status, "paid");
    }

    #[test]
    fn test_record_payment_exceeding_balance() {
        let mut db = test_helpers::setup_test_db();
        let dto = make_debt_dto("John Doe", 500.0);
        let debtor = create_debt(&mut db, &dto).unwrap();

        let result = record_payment(&mut db, debtor.id, 600.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_record_nan_payment() {
        let mut db = test_helpers::setup_test_db();
        let dto = make_debt_dto("John Doe", 500.0);
        let debtor = create_debt(&mut db, &dto).unwrap();

        let result = record_payment(&mut db, debtor.id, f64::NAN);
        assert!(result.is_err());
    }

    #[test]
    fn test_record_zero_payment() {
        let mut db = test_helpers::setup_test_db();
        let dto = make_debt_dto("John Doe", 500.0);
        let debtor = create_debt(&mut db, &dto).unwrap();

        let result = record_payment(&mut db, debtor.id, 0.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_record_negative_payment() {
        let mut db = test_helpers::setup_test_db();
        let dto = make_debt_dto("John Doe", 500.0);
        let debtor = create_debt(&mut db, &dto).unwrap();

        let result = record_payment(&mut db, debtor.id, -100.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_overdue_count() {
        let mut db = test_helpers::setup_test_db();

        // Create a debt with a past due date
        let dto = CreateDebtRequest {
            customer_name: "Overdue Person".into(),
            phone: None,
            items: vec![DebtItemRequest {
                medicine_name: "Med".into(),
                quantity: 1,
                amount: 100.0,
            }],
            due_date: "2020-01-01".into(),
            notes: None,
        };
        create_debt(&mut db, &dto).unwrap();

        let count = get_overdue_count(&db).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_get_overdue_count_zero() {
        let db = test_helpers::setup_test_db();
        let count = get_overdue_count(&db).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_list_debts() {
        let mut db = test_helpers::setup_test_db();
        let dto = make_debt_dto("Alice", 100.0);
        create_debt(&mut db, &dto).unwrap();

        let list = list_debts(&db).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].customer_name, "Alice");
    }

    #[test]
    fn test_get_debt_detail() {
        let mut db = test_helpers::setup_test_db();
        let dto = make_debt_dto("Bob", 250.0);
        let debtor = create_debt(&mut db, &dto).unwrap();

        let detail = get_debt(&db, debtor.id).unwrap();
        assert_eq!(detail.debtor.customer_name, "Bob");
        assert_eq!(detail.items.len(), 1);
        assert_eq!(detail.items[0].medicine_name, "Panadol");
    }

    #[test]
    fn test_get_debt_not_found() {
        let db = test_helpers::setup_test_db();
        let result = get_debt(&db, 999);
        assert!(result.is_err());
    }
}
