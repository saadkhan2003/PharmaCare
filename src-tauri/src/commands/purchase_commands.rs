use tauri::State;

use crate::errors::CommandError;
use crate::guards::require_owner;
use crate::models::{CreatePurchaseDto, PurchaseDetailDto, PurchaseListDto, PurchaseReceiptDto};
use crate::services::purchase_service;
use crate::state::AppState;

/// Records a new purchase. Owner-only command.
///
/// This is the primary stock-increase pathway. The service creates an atomic
/// transaction that inserts the purchase header, line items, batch records,
/// and stock movements — all or nothing.
#[tauri::command]
pub fn record_purchase(
    state: State<'_, AppState>,
    session_token: String,
    payload: CreatePurchaseDto,
) -> Result<PurchaseReceiptDto, CommandError> {
    let session = require_owner(&state, &session_token)?;
    let mut db = state.db.lock()?;
    // Pass &mut Connection — purchase_service::record_purchase needs it for
    // rusqlite::Connection::transaction() which requires &mut self.
    purchase_service::record_purchase(&mut *db, &payload, session.user_id)
}

/// Lists all purchases with supplier name and item count. Owner-only command.
#[tauri::command]
pub fn list_purchases(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<PurchaseListDto>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    purchase_service::list_purchases(&db)
}

/// Gets a single purchase with all items and medicine names. Owner-only command.
#[tauri::command]
pub fn get_purchase_detail(
    state: State<'_, AppState>,
    session_token: String,
    purchase_id: i64,
) -> Result<PurchaseDetailDto, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    purchase_service::get_purchase_detail(&db, purchase_id)
}
