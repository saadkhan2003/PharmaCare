use tauri::State;

use crate::errors::CommandError;
use crate::guards::{require_owner, require_session};
use crate::models::{
    CreateMedicineDto, MedicineDto, MedicineListItem, MedicinePharmacistDto, UpdateMedicineDto,
};
use crate::services::medicine_service;
use crate::state::AppState;

/// Creates a new medicine. Owner-only command.
#[tauri::command]
pub fn create_medicine(
    state: State<'_, AppState>,
    session_token: String,
    payload: CreateMedicineDto,
) -> Result<MedicineDto, CommandError> {
    let session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    medicine_service::create_medicine(&db, &payload, session.user_id)
}

/// Updates an existing medicine. Owner-only command.
#[tauri::command]
pub fn update_medicine(
    state: State<'_, AppState>,
    session_token: String,
    medicine_id: i64,
    payload: UpdateMedicineDto,
) -> Result<MedicineDto, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    medicine_service::update_medicine(&db, medicine_id, &payload)
}

/// Deactivates a medicine (soft delete). Owner-only command.
#[tauri::command]
pub fn deactivate_medicine(
    state: State<'_, AppState>,
    session_token: String,
    medicine_id: i64,
) -> Result<(), CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    medicine_service::deactivate_medicine(&db, medicine_id)
}

/// Hard deletes a medicine if no related records exist. Owner-only.
#[tauri::command]
pub fn delete_medicine(
    state: State<'_, AppState>,
    session_token: String,
    medicine_id: i64,
) -> Result<(), CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    medicine_service::delete_medicine(&db, medicine_id)
}

/// Lists all medicines with current stock. Session required.
#[tauri::command]
pub fn list_medicines(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<MedicineListItem>, CommandError> {
    let _session = require_session(&state, &session_token)?;
    let db = state.db.lock()?;
    medicine_service::list_medicines(&db)
}

/// Searches medicines by name/generic/brand/category. Session required.
/// Returns full DTO with purchase_price for authorized users.
#[tauri::command]
pub fn search_medicines(
    state: State<'_, AppState>,
    session_token: String,
    query: String,
) -> Result<Vec<MedicineListItem>, CommandError> {
    let _session = require_session(&state, &session_token)?;
    let db = state.db.lock()?;
    medicine_service::search_medicines(&db, &query)
}

/// Searches medicines for pharmacist — returns DTO WITHOUT purchase_price (D-15).
/// Extra safety: verifies caller is actually a pharmacist.
#[tauri::command]
pub fn search_medicines_pharmacist(
    state: State<'_, AppState>,
    session_token: String,
    query: String,
) -> Result<Vec<MedicinePharmacistDto>, CommandError> {
    let session = require_session(&state, &session_token)?;
    // Extra safety: verify caller is actually a pharmacist
    if session.role != "pharmacist" {
        return Err(CommandError::validation(
            "Owner should use search_medicines",
        ));
    }
    let db = state.db.lock()?;
    medicine_service::search_medicines_pharmacist(&db, &query)
}

/// Gets a single medicine by id with current stock. Session required.
#[tauri::command]
pub fn get_medicine(
    state: State<'_, AppState>,
    session_token: String,
    medicine_id: i64,
) -> Result<MedicineDto, CommandError> {
    let _session = require_session(&state, &session_token)?;
    let db = state.db.lock()?;
    medicine_service::get_medicine_by_id(&db, medicine_id)
}
