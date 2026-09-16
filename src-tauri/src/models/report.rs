use serde::{Deserialize, Serialize};

// ── Report 1: Daily Sales Summary (REPT-03) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailySalesRow {
    pub date: String,
    pub sale_count: i64,
    pub item_count: i64,
    pub gross_sales: f64,
    pub discounts: f64,
    pub tax_amount: f64,
    pub net_sales: f64,
    pub profit: f64,
}

// ── Report 2: Monthly P&L (REPT-04) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthlyPnLRow {
    pub month: String,
    pub sale_count: i64,
    pub total_revenue: f64,
    pub total_cogs: f64,
    pub gross_profit: f64,
    pub total_refunds: f64,
    pub write_off_losses: f64,
    pub net_profit: f64,
}

// ── Report 3: Top Selling Medicines (REPT-05) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopSellerRow {
    pub medicine_id: i64,
    pub medicine_name: String,
    pub generic_name: Option<String>,
    pub total_qty: i64,
    pub total_revenue: f64,
    pub total_profit: f64,
}

// ── Report 4: Slow-Moving Stock (REPT-06) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlowMovingRow {
    pub medicine_id: i64,
    pub medicine_name: String,
    pub category: Option<String>,
    pub current_stock: i64,
    pub total_investment: f64,
}

// ── Report 5: Low Stock (REPT-07) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LowStockRow {
    pub medicine_id: i64,
    pub medicine_name: String,
    pub category: Option<String>,
    pub reorder_level: i64,
    pub current_stock: i64,
    pub unit: String,
    pub deficit: i64,
}

// ── Report 6: Expiry Report (REPT-08) ──
// Extended version with batch_code, potential_loss, status fields.
// Distinct from the simpler ExpiryReportRow in batch.rs.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpiryReportDetailRow {
    pub batch_id: i64,
    pub medicine_id: i64,
    pub medicine_name: String,
    pub batch_code: Option<String>,
    pub original_qty: i64,
    pub remaining_qty: i64,
    pub unit_cost: f64,
    pub expiry_date: String,
    pub days_remaining: i64,
    pub potential_loss: f64,
    pub status: String,
}

// ── Report 7: Supplier Purchase History (REPT-09) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierPurchaseRow {
    pub supplier_id: i64,
    pub company_name: String,
    pub purchase_count: i64,
    pub item_count: i64,
    pub total_spent: f64,
    pub avg_order_value: f64,
    pub last_purchase_date: Option<String>,
}

// ── Report 8: Sales by User (REPT-10) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesByUserRow {
    pub user_id: i64,
    pub full_name: String,
    pub role: String,
    pub sale_count: i64,
    pub item_count: i64,
    pub total_sales: f64,
    pub total_profit: f64,
    pub avg_profit_per_sale: f64,
}

// ── Report 9: Profit Margin (REPT-11) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfitMarginRow {
    pub medicine_id: i64,
    pub medicine_name: String,
    pub category: Option<String>,
    pub times_sold: i64,
    pub total_qty: i64,
    pub avg_sell_price: f64,
    pub avg_cost: f64,
    pub avg_margin_per_unit: f64,
    pub margin_pct: f64,
    pub total_profit: f64,
}

// ── Settings Write Payload ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSettingsPayload {
    // Pharmacy Info
    pub pharmacy_name: Option<String>,
    pub owner_name: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub logo_path: Option<String>,
    pub owner_email: Option<String>,
    // Financial
    pub default_tax_rate: Option<f64>,
    pub tax_enabled_default: Option<bool>,
    pub cashier_discount_enabled: Option<bool>,
    pub currency_symbol: Option<String>,
    // Inventory
    pub default_reorder_level: Option<i64>,
    pub expiry_warning_days: Option<i64>,
    pub expiry_critical_days: Option<i64>,
    // Backup
    pub auto_backup_time: Option<String>,
    pub local_backup_path: Option<String>,
}

// ── Backup DTOs ──

#[derive(Debug, Clone, Serialize)]
pub struct BackupStatus {
    pub last_backup_time: Option<String>,
    pub last_backup_status: Option<String>,
    pub google_drive_connected: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct BackupResult {
    pub success: bool,
    pub message: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct BackupFileInfo {
    pub id: String,
    pub name: String,
    pub created_time: String,
}
