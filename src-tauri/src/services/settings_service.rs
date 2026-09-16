use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::{SettingsMap, UpdateSettingsPayload};
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

/// Reads a setting as String with a default fallback.
fn get_string(db: &Connection, key: &str, default: String) -> Result<String, CommandError> {
    Ok(settings_repo::get_string(db, key)?.unwrap_or(default))
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
        currency_symbol: get_string(db, "currency_symbol", "Rs.".to_string())?,
        // Pharmacy Info
        pharmacy_name: get_string(db, "pharmacy_name", String::new())?,
        owner_name: get_string(db, "owner_name", String::new())?,
        phone: get_string(db, "phone", String::new())?,
        address: get_string(db, "address", String::new())?,
        logo_path: get_string(db, "logo_path", String::new())?,
        owner_email: settings_repo::get_string(db, "owner_email")?,
        // Backup
        auto_backup_time: get_string(db, "auto_backup_time", "23:00".to_string())?,
        local_backup_path: get_string(db, "local_backup_path", String::new())?,
        last_backup_time: settings_repo::get_string(db, "last_backup_time")?,
        last_backup_status: settings_repo::get_string(db, "last_backup_status")?,
        google_drive_connected: {
            let token = settings_repo::get_string(db, "google_drive_token")?;
            token.is_some() && !token.as_deref().unwrap_or("").is_empty()
        },
        tax_enabled_default: get_bool(db, "tax_enabled_default", false)?,
    })
}

/// Updates settings from a typed payload. Only non-None values are written.
/// All values stored as strings in the settings table (existing pattern).
pub fn update_settings(db: &Connection, payload: &UpdateSettingsPayload) -> Result<(), CommandError> {
    // Pharmacy Info
    if let Some(ref v) = payload.pharmacy_name {
        settings_repo::set_value(db, "pharmacy_name", v)?;
    }
    if let Some(ref v) = payload.owner_name {
        settings_repo::set_value(db, "owner_name", v)?;
    }
    if let Some(ref v) = payload.phone {
        settings_repo::set_value(db, "phone", v)?;
    }
    if let Some(ref v) = payload.address {
        settings_repo::set_value(db, "address", v)?;
    }
    if let Some(ref v) = payload.logo_path {
        settings_repo::set_value(db, "logo_path", v)?;
    }
    if let Some(ref v) = payload.owner_email {
        settings_repo::set_value(db, "owner_email", v.trim())?;
    }
    // Financial
    if let Some(v) = payload.default_tax_rate {
        settings_repo::set_value(db, "default_tax_rate", &v.to_string())?;
    }
    if let Some(v) = payload.tax_enabled_default {
        settings_repo::set_value(db, "tax_enabled_default", if v { "true" } else { "false" })?;
    }
    if let Some(v) = payload.cashier_discount_enabled {
        settings_repo::set_value(db, "cashier_discount_enabled", if v { "true" } else { "false" })?;
    }
    if let Some(ref v) = payload.currency_symbol {
        settings_repo::set_value(db, "currency_symbol", v)?;
    }
    // Inventory
    if let Some(v) = payload.default_reorder_level {
        settings_repo::set_value(db, "default_reorder_level", &v.to_string())?;
    }
    if let Some(v) = payload.expiry_warning_days {
        settings_repo::set_value(db, "expiry_warning_days", &v.to_string())?;
    }
    if let Some(v) = payload.expiry_critical_days {
        settings_repo::set_value(db, "expiry_critical_days", &v.to_string())?;
    }
    // Backup
    if let Some(ref v) = payload.auto_backup_time {
        settings_repo::set_value(db, "auto_backup_time", v)?;
    }
    if let Some(ref v) = payload.local_backup_path {
        settings_repo::set_value(db, "local_backup_path", v)?;
    }

    Ok(())
}
