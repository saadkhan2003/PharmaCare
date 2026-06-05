use tauri::State;

use crate::errors::CommandError;
use crate::guards::{require_owner, require_session};
use crate::models::ExpiryReportRow;
use crate::repository::batch_repo;
use crate::services::stock_ledger_service;
use crate::state::AppState;

/// Returns the expiry report sorted by days_remaining ASC.
/// Owner-only command. Supports optional min_days and max_days filters.
#[tauri::command]
pub fn get_expiry_report(
    state: State<'_, AppState>,
    session_token: String,
    min_days: Option<i64>,
    max_days: Option<i64>,
) -> Result<Vec<ExpiryReportRow>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    batch_repo::get_expiry_report(&db, min_days, max_days).map_err(CommandError::from)
}

/// Returns current stock for a medicine. Session required.
#[tauri::command]
pub fn get_current_stock(
    state: State<'_, AppState>,
    session_token: String,
    medicine_id: i64,
) -> Result<i64, CommandError> {
    let _session = require_session(&state, &session_token)?;
    let db = state.db.lock()?;
    stock_ledger_service::get_current_stock(&db, medicine_id)
}
