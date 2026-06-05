use tauri::State;

use crate::errors::CommandError;
use crate::guards::{require_owner, require_session};
use crate::models::{CreateSupplierDto, SupplierDto, UpdateSupplierDto};
use crate::services::supplier_service;
use crate::state::AppState;

/// Creates a new supplier. Owner-only command.
#[tauri::command]
pub fn create_supplier(
    state: State<'_, AppState>,
    session_token: String,
    payload: CreateSupplierDto,
) -> Result<SupplierDto, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    supplier_service::create_supplier(&db, &payload)
}

/// Updates an existing supplier. Owner-only command.
#[tauri::command]
pub fn update_supplier(
    state: State<'_, AppState>,
    session_token: String,
    supplier_id: i64,
    payload: UpdateSupplierDto,
) -> Result<SupplierDto, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    supplier_service::update_supplier(&db, supplier_id, &payload)
}

/// Deactivates a supplier (soft delete). Owner-only command.
#[tauri::command]
pub fn deactivate_supplier(
    state: State<'_, AppState>,
    session_token: String,
    supplier_id: i64,
) -> Result<(), CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    supplier_service::deactivate_supplier(&db, supplier_id)
}

/// Hard deletes a supplier if no purchase records exist. Owner-only.
#[tauri::command]
pub fn delete_supplier(
    state: State<'_, AppState>,
    session_token: String,
    supplier_id: i64,
) -> Result<(), CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    supplier_service::delete_supplier(&db, supplier_id)
}

/// Lists all suppliers. Session required.
#[tauri::command]
pub fn list_suppliers(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<SupplierDto>, CommandError> {
    let _session = require_session(&state, &session_token)?;
    let db = state.db.lock()?;
    supplier_service::list_suppliers(&db)
}

/// Searches suppliers by name or phone. Session required.
#[tauri::command]
pub fn search_suppliers(
    state: State<'_, AppState>,
    session_token: String,
    query: String,
) -> Result<Vec<SupplierDto>, CommandError> {
    let _session = require_session(&state, &session_token)?;
    let db = state.db.lock()?;
    supplier_service::search_suppliers(&db, &query)
}
