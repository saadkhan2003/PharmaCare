use tauri::State;

use crate::errors::CommandError;
use crate::guards::require_owner;
use crate::models::{
    DailySalesRow, MonthlyPnLRow, TopSellerRow, SlowMovingRow,
    LowStockRow, ExpiryReportDetailRow, SupplierPurchaseRow,
    SalesByUserRow, ProfitMarginRow,
};
use crate::services::report_service;
use crate::state::AppState;

/// Daily Sales Summary report (REPT-03). Owner only (REPT-13).
#[tauri::command]
pub fn get_daily_sales_report(
    state: State<'_, AppState>,
    session_token: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<DailySalesRow>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    report_service::get_daily_sales(&db, &start_date, &end_date)
}

/// Monthly P&L report (REPT-04). Owner only (REPT-13).
#[tauri::command]
pub fn get_monthly_pnl(
    state: State<'_, AppState>,
    session_token: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<MonthlyPnLRow>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    report_service::get_monthly_pnl(&db, &start_date, &end_date)
}

/// Top Selling Medicines report (REPT-05). Owner only (REPT-13).
#[tauri::command]
pub fn get_top_sellers(
    state: State<'_, AppState>,
    session_token: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<TopSellerRow>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    report_service::get_top_sellers(&db, &start_date, &end_date)
}

/// Slow-Moving Stock report (REPT-06). Owner only (REPT-13).
#[tauri::command]
pub fn get_slow_moving(
    state: State<'_, AppState>,
    session_token: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<SlowMovingRow>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    report_service::get_slow_moving(&db, &start_date, &end_date)
}

/// Low Stock report (REPT-07). Owner only (REPT-13). No date params — current state.
#[tauri::command]
pub fn get_low_stock(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<LowStockRow>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    report_service::get_low_stock(&db)
}

/// Expiry Report (REPT-08). Owner only (REPT-13).
/// Uses warning_days and critical_days thresholds instead of date range.
/// Distinct name from the existing get_expiry_report in batch_commands.
#[tauri::command]
pub fn get_expiry_report_phase5(
    state: State<'_, AppState>,
    session_token: String,
    warning_days: i64,
    critical_days: i64,
) -> Result<Vec<ExpiryReportDetailRow>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    report_service::get_expiry_report(&db, warning_days, critical_days)
}

/// Supplier Purchase History report (REPT-09). Owner only (REPT-13).
#[tauri::command]
pub fn get_supplier_purchases(
    state: State<'_, AppState>,
    session_token: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<SupplierPurchaseRow>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    report_service::get_supplier_purchases(&db, &start_date, &end_date)
}

/// Sales by User report (REPT-10). Owner only (REPT-13).
#[tauri::command]
pub fn get_sales_by_user(
    state: State<'_, AppState>,
    session_token: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<SalesByUserRow>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    report_service::get_sales_by_user(&db, &start_date, &end_date)
}

/// Profit Margin report (REPT-11). Owner only (REPT-13).
#[tauri::command]
pub fn get_profit_margin(
    state: State<'_, AppState>,
    session_token: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<ProfitMarginRow>, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;
    report_service::get_profit_margin(&db, &start_date, &end_date)
}
