use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::SettingsMap;
use crate::repository::settings_repo;

/// Reads a setting as f64 with a default fallback.
pub fn get_f64(db: &Connection, key: &str, default: f64) -> Result<f64, CommandError> {
    match settings_repo::get_string(db, key)? {
        Some(val) => val.parse::<f64>().or(Ok(default)),
        None => Ok(default),
    }
}

/// Reads a setting as i64 with a default fallback.
pub fn get_i64(db: &Connection, key: &str, default: i64) -> Result<i64, CommandError> {
    match settings_repo::get_string(db, key)? {
        Some(val) => val.parse::<i64>().or(Ok(default)),
        None => Ok(default),
    }
}

/// Reads a setting as bool with a default fallback.
pub fn get_bool(db: &Connection, key: &str, default: bool) -> Result<bool, CommandError> {
    match settings_repo::get_string(db, key)? {
        Some(val) => Ok(val == "true" || val == "1"),
        None => Ok(default),
    }
}

/// Returns all settings as a typed SettingsMap.
/// Falls back to defaults for any missing keys.
pub fn get_settings(db: &Connection) -> Result<SettingsMap, CommandError> {
    Ok(SettingsMap {
        default_tax_rate: get_f64(db, "default_tax_rate", 0.0)?,
        cashier_discount_enabled: get_bool(db, "cashier_discount_enabled", false)?,
        expiry_warning_days: get_i64(db, "expiry_warning_days", 60)?,
        expiry_critical_days: get_i64(db, "expiry_critical_days", 30)?,
        default_reorder_level: get_i64(db, "default_reorder_level", 10)?,
        currency_symbol: settings_repo::get_string(db, "currency_symbol")?
            .unwrap_or_else(|| "Rs.".to_string()),
    })
}
