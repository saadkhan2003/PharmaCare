use tauri::State;

use crate::errors::CommandError;
use crate::guards::{require_owner, require_session};
use crate::models::*;
use crate::services::return_service;
use crate::state::AppState;

/// Processes a customer return. Both owner AND pharmacist can process customer returns
/// (D-44: customer return available to pharmacist).
#[tauri::command]
pub fn process_customer_return(
    state: State<'_, AppState>,
    session_token: String,
    payload: CustomerReturnDto,
) -> Result<ReturnReceiptDto, CommandError> {
    let session = require_session(&state, &session_token)?;
    // Both owner AND pharmacist can process customer returns (CONTEXT.md: D-44)
    let mut db = state.db.lock()?;
    return_service::process_customer_return(&mut *db, &payload, session.user_id)
}

/// Processes a supplier return. Owner only (D-50).
#[tauri::command]
pub fn process_supplier_return(
    state: State<'_, AppState>,
    session_token: String,
    payload: SupplierReturnDto,
) -> Result<ReturnReceiptDto, CommandError> {
    let session = require_owner(&state, &session_token)?; // D-50: Owner only
    let mut db = state.db.lock()?;
    return_service::process_supplier_return(&mut *db, &payload, session.user_id)
}

/// Processes a write-off. Owner only (D-53).
#[tauri::command]
pub fn process_write_off(
    state: State<'_, AppState>,
    session_token: String,
    payload: WriteOffDto,
) -> Result<ReturnReceiptDto, CommandError> {
    let session = require_owner(&state, &session_token)?; // D-53: Owner only
    let mut db = state.db.lock()?;
    return_service::process_write_off(&mut *db, &payload, session.user_id)
}

/// Lists all returns for history display. Owner only.
#[tauri::command]
pub fn list_returns(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<ReturnListItemDto>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    crate::repository::returns_repo::list_all(&db)
        .map_err(|e| CommandError::internal(&format!("Failed to list returns: {}", e)))
}

/// Searches for a sale by ID to display items eligible for return.
/// Both roles can search (D-44: sale search for customer return).
#[tauri::command]
pub fn search_sale_for_return(
    state: State<'_, AppState>,
    session_token: String,
    sale_id: i64,
) -> Result<SaleForReturnDto, CommandError> {
    let _session = require_session(&state, &session_token)?;
    // Both owner and pharmacist can search
    let db = state.db.lock()?;
    return_service::search_sale_for_return(&db, sale_id)
}

/// Searches for a purchase by ID to display items eligible for supplier return.
/// Owner only (D-49: supplier return management).
#[tauri::command]
pub fn search_purchase_for_return(
    state: State<'_, AppState>,
    session_token: String,
    purchase_id: i64,
) -> Result<PurchaseForReturnDto, CommandError> {
    let _session = require_owner(&state, &session_token)?; // D-49: Owner only
    let db = state.db.lock()?;
    return_service::search_purchase_for_return(&db, purchase_id)
}
