use tauri::State;

use crate::errors::CommandError;
use crate::guards::{require_owner, require_session};
use crate::models::{BatchListDto, ExpiryReportRow, UpdateBatchDto};
use crate::repository::batch_repo;
use crate::state::AppState;

#[tauri::command]
pub fn get_current_stock(
    state: State<'_, AppState>,
    session_token: String,
    medicine_id: i64,
) -> Result<i64, CommandError> {
    let _session = require_session(&state, &session_token)?;
    let db = state.db.lock()?;
    batch_repo::get_current_stock(&db, medicine_id).map_err(CommandError::from)
}

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

#[tauri::command]
pub fn list_batches(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<BatchListDto>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    batch_repo::find_all_with_medicine(&db).map_err(CommandError::from)
}

#[tauri::command]
pub fn update_batch(
    state: State<'_, AppState>,
    session_token: String,
    batch_id: i64,
    payload: UpdateBatchDto,
) -> Result<(), CommandError> {
    let _session = require_owner(&state, &session_token)?;
    if payload.expiry_date.trim().is_empty() {
        return Err(CommandError::validation("Expiry date is required"));
    }

    let db = state.db.lock()?;
    let batch_code = payload.batch_code.as_deref().map(str::trim).filter(|v| !v.is_empty());
    batch_repo::update_metadata(&db, batch_id, batch_code, payload.expiry_date.trim())?;
    Ok(())
}
