use tauri::State;

use crate::errors::CommandError;
use crate::guards::{require_owner, require_session};
use crate::models::*;
use crate::services::sale_service;
use crate::state::AppState;

/// Confirms a sale — atomic FIFO transaction. Both owner and pharmacist can process sales.
#[tauri::command]
pub fn confirm_sale(
    state: State<'_, AppState>,
    session_token: String,
    payload: ConfirmSaleDto,
) -> Result<SaleReceiptDto, CommandError> {
    let session = require_session(&state, &session_token)?;
    // NOT require_owner — both owner and pharmacist can process sales
    let mut db = state.db.lock()?;
    sale_service::confirm_sale(&mut *db, &payload, session.user_id, &session.role)
}

/// POS-specific medicine search — excludes purchase_price. Both roles can search.
#[tauri::command]
pub fn search_medicines_pos(
    state: State<'_, AppState>,
    session_token: String,
    query: String,
) -> Result<Vec<MedicinePosDto>, CommandError> {
    let _session = require_session(&state, &session_token)?;
    // Both owner and pharmacist can search for POS
    let db = state.db.lock()?;
    sale_service::search_medicines_pos(&db, &query)
}

#[tauri::command]
pub fn list_sales(
    state: State<'_, AppState>,
    session_token: String,
    query: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<SaleListDto>, CommandError> {
    let _session = require_session(&state, &session_token)?;
    let db = state.db.lock()?;
    sale_service::list_sales(&db, &query, &start_date, &end_date)
}

#[tauri::command]
pub fn get_sale_detail(
    state: State<'_, AppState>,
    session_token: String,
    sale_id: i64,
) -> Result<SaleDetailDto, CommandError> {
    let _session = require_session(&state, &session_token)?;
    let db = state.db.lock()?;
    sale_service::get_sale_detail(&db, sale_id)
}

/// Owner dashboard — full financial data including profit. Owner-only command (D-41/REPT-01).
#[tauri::command]
pub fn get_owner_dashboard(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<OwnerDashboardDto, CommandError> {
    let _session = require_owner(&state, &session_token)?; // D-41: Owner only
    let db = state.db.lock()?;
    sale_service::get_owner_dashboard(&db)
}

/// Pharmacist dashboard — sales summary + alerts only. Both roles (D-42/REPT-02).
#[tauri::command]
pub fn get_pharmacist_dashboard(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<PharmacistDashboardDto, CommandError> {
    let _session = require_session(&state, &session_token)?;
    // Pharmacist can access this — no require_owner
    let db = state.db.lock()?;
    sale_service::get_pharmacist_dashboard(&db)
}
