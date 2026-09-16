// ── Report 1: Daily Sales Summary (REPT-03) ──

export interface DailySalesRow {
  date: string;
  sale_count: number;
  item_count: number;
  gross_sales: number;
  discounts: number;
  tax_amount: number;
  net_sales: number;
  profit: number;
}

// ── Report 2: Monthly P&L (REPT-04) ──

export interface MonthlyPnLRow {
  month: string;
  sale_count: number;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  total_refunds: number;
  write_off_losses: number;
  net_profit: number;
}

// ── Report 3: Top Selling Medicines (REPT-05) ──

export interface TopSellerRow {
  medicine_id: number;
  medicine_name: string;
  generic_name: string | null;
  total_qty: number;
  total_revenue: number;
  total_profit: number;
}

// ── Report 4: Slow-Moving Stock (REPT-06) ──

export interface SlowMovingRow {
  medicine_id: number;
  medicine_name: string;
  category: string | null;
  current_stock: number;
  total_investment: number;
}

// ── Report 5: Low Stock (REPT-07) ──

export interface LowStockRow {
  medicine_id: number;
  medicine_name: string;
  category: string | null;
  reorder_level: number;
  current_stock: number;
  unit: string;
  deficit: number;
}

// ── Report 6: Expiry Report (REPT-08) ──

export interface ExpiryReportDetailRow {
  batch_id: number;
  medicine_id: number;
  medicine_name: string;
  batch_code: string | null;
  original_qty: number;
  remaining_qty: number;
  unit_cost: number;
  expiry_date: string;
  days_remaining: number;
  potential_loss: number;
  status: string;
}

// ── Report 7: Supplier Purchase History (REPT-09) ──

export interface SupplierPurchaseRow {
  supplier_id: number;
  company_name: string;
  purchase_count: number;
  item_count: number;
  total_spent: number;
  avg_order_value: number;
  last_purchase_date: string | null;
}

// ── Report 8: Sales by User (REPT-10) ──

export interface SalesByUserRow {
  user_id: number;
  full_name: string;
  role: string;
  sale_count: number;
  item_count: number;
  total_sales: number;
  total_profit: number;
  avg_profit_per_sale: number;
}

// ── Report 9: Profit Margin (REPT-11) ──

export interface ProfitMarginRow {
  medicine_id: number;
  medicine_name: string;
  category: string | null;
  times_sold: number;
  total_qty: number;
  avg_sell_price: number;
  avg_cost: number;
  avg_margin_per_unit: number;
  margin_pct: number;
  total_profit: number;
}

// ── Settings Write Payload ──

export interface UpdateSettingsPayload {
  pharmacy_name?: string | null;
  owner_name?: string | null;
  phone?: string | null;
  address?: string | null;
  logo_path?: string | null;
  owner_email?: string | null;
  default_tax_rate?: number | null;
  tax_enabled_default?: boolean | null;
  cashier_discount_enabled?: boolean | null;
  currency_symbol?: string | null;
  default_reorder_level?: number | null;
  expiry_warning_days?: number | null;
  expiry_critical_days?: number | null;
  auto_backup_time?: string | null;
  local_backup_path?: string | null;
}

// ── Backup DTOs ──

export interface BackupStatus {
  last_backup_time: string | null;
  last_backup_status: string | null;
  google_drive_connected: boolean;
}

export interface BackupResult {
  success: boolean;
  message: string;
  path: string;
}

export interface BackupFileInfo {
  id: string;
  name: string;
  created_time: string;
}

// ── Database Status ──

export interface DbStatus {
  db_path: string;
  db_size_bytes: number;
  migration_version: number;
  total_migrations: number;
  wal_mode: boolean;
  foreign_keys: boolean;
}
