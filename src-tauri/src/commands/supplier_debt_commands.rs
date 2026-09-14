use tauri::State;
use crate::errors::CommandError;
use crate::guards::require_owner;
use crate::models::supplier_debt::*;
use crate::services::supplier_debt_service;
use crate::state::AppState;

#[tauri::command]
pub fn create_supplier_debt(
    state: State<'_, AppState>,
    session_token: String,
    req: CreateSupplierDebtRequest,
) -> Result<SupplierDebt, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let mut db = state.db.lock()?;
    supplier_debt_service::create_debt(&mut db, &req)
}

#[tauri::command]
pub fn list_supplier_debts(
    state: State<'_, AppState>,
    session_token: String,
    supplier_id: Option<i64>,
) -> Result<Vec<SupplierDebtListItem>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    supplier_debt_service::list_debts(&db, supplier_id)
}

#[tauri::command]
pub fn get_supplier_debt(
    state: State<'_, AppState>,
    session_token: String,
    debt_id: i64,
) -> Result<SupplierDebtDetail, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    supplier_debt_service::get_debt(&db, debt_id)
}

#[tauri::command]
pub fn record_supplier_payment(
    state: State<'_, AppState>,
    session_token: String,
    req: RecordSupplierPaymentRequest,
) -> Result<SupplierPayment, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let mut db = state.db.lock()?;
    supplier_debt_service::record_payment(&mut db, &req)
}

#[tauri::command]
pub fn get_supplier_overdue_count(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<i64, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    supplier_debt_service::get_overdue_count(&db)
}

#[tauri::command]
pub fn create_supplier_debt_from_purchase(
    state: State<'_, AppState>,
    session_token: String,
    purchase_id: i64,
    supplier_id: i64,
    total_cost: f64,
    paid_amount: f64,
    payment_status: String,
    due_date: Option<String>,
) -> Result<SupplierDebt, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let mut db = state.db.lock()?;
    supplier_debt_service::create_from_purchase(
        &mut db, purchase_id, supplier_id, total_cost, paid_amount, &payment_status, due_date,
    )
}
