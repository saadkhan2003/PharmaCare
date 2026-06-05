use serde::{Deserialize, Serialize};

/// Typed settings map returned to frontend.
/// All fields populated from the settings table key-value store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsMap {
    pub default_tax_rate: f64,
    pub cashier_discount_enabled: bool,
    pub expiry_warning_days: i64,
    pub expiry_critical_days: i64,
    pub default_reorder_level: i64,
    pub currency_symbol: String,
    // Pharmacy Info
    pub pharmacy_name: String,
    pub owner_name: String,
    pub phone: String,
    pub address: String,
    pub logo_path: String,
    // Backup
    pub auto_backup_time: String,
    pub local_backup_path: String,
    pub last_backup_time: Option<String>,
    pub last_backup_status: Option<String>,
    pub google_drive_connected: bool,
    // Financial
    pub tax_enabled_default: bool,
}

impl Default for SettingsMap {
    fn default() -> Self {
        SettingsMap {
            default_tax_rate: 0.0,
            cashier_discount_enabled: false,
            expiry_warning_days: 60,
            expiry_critical_days: 30,
            default_reorder_level: 10,
            currency_symbol: "Rs.".to_string(),
            pharmacy_name: String::new(),
            owner_name: String::new(),
            phone: String::new(),
            address: String::new(),
            logo_path: String::new(),
            auto_backup_time: "23:00".to_string(),
            local_backup_path: String::new(),
            last_backup_time: None,
            last_backup_status: None,
            google_drive_connected: false,
            tax_enabled_default: false,
        }
    }
}
