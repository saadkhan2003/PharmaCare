use tauri::State;
use crate::errors::CommandError;
use crate::guards::require_owner;
use crate::models::debt::*;
use crate::services::debt_service;
use crate::state::AppState;

#[tauri::command]
pub fn create_debt(
    state: State<'_, AppState>,
    session_token: String,
    payload: CreateDebtRequest,
) -> Result<Debtor, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    debt_service::create_debt(&db, &payload)
}

#[tauri::command]
pub fn list_debts(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<DebtorListItem>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    debt_service::list_debts(&db)
}

#[tauri::command]
pub fn get_debt(
    state: State<'_, AppState>,
    session_token: String,
    debt_id: i64,
) -> Result<DebtDetail, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    debt_service::get_debt(&db, debt_id)
}

#[tauri::command]
pub fn record_payment(
    state: State<'_, AppState>,
    session_token: String,
    debt_id: i64,
    amount: f64,
) -> Result<Debtor, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    debt_service::record_payment(&db, debt_id, amount)
}

#[tauri::command]
pub fn get_overdue_count(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<i64, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    debt_service::get_overdue_count(&db)
}

#[tauri::command]
pub fn get_due_soon_count(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<i64, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    debt_service::get_due_soon_count(&db)
}
