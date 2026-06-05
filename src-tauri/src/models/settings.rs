use serde::{Deserialize, Serialize};

/// Typed settings map returned to frontend.
/// All 6 fields populated from the settings table key-value store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsMap {
    pub default_tax_rate: f64,
    pub cashier_discount_enabled: bool,
    pub expiry_warning_days: i64,
    pub expiry_critical_days: i64,
    pub default_reorder_level: i64,
    pub currency_symbol: String,
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
        }
    }
}
