export interface SettingsMap {
  default_tax_rate: number;
  cashier_discount_enabled: boolean;
  expiry_warning_days: number;
  expiry_critical_days: number;
  default_reorder_level: number;
  currency_symbol: string;
  pharmacy_name: string;
  owner_name: string;
  phone: string;
  address: string;
  logo_path: string;
  owner_email?: string | null;
  auto_backup_time: string;
  local_backup_path: string;
  last_backup_time: string | null;
  last_backup_status: string | null;
  google_drive_connected: boolean;
  tax_enabled_default: boolean;
}
