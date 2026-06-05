use tauri::State;

use crate::errors::CommandError;
use crate::models::SettingsMap;
use crate::services::settings_service;
use crate::state::AppState;

/// Returns all settings as a typed SettingsMap.
/// No auth guard needed — settings contain no sensitive data (T-02-07).
#[tauri::command]
pub fn get_settings(
    state: State<'_, AppState>,
) -> Result<SettingsMap, CommandError> {
    let db = state.db.lock()?;
    settings_service::get_settings(&db)
}
