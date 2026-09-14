import { invoke } from '@tauri-apps/api/core';
import type { SessionDto, SetupStatus } from '../types/session';
import type { UserDto, CreateUserDto, LoginAttemptDto } from '../types/user';
import type { LoginDto } from '../types/session';
import type {
  MedicineDto, MedicineListItem, MedicinePharmacistDto, PaginatedList,
  CreateMedicineDto, UpdateMedicineDto, CsvImportResult,
} from '../types/medicine';
import type {
  SupplierDto, CreateSupplierDto, UpdateSupplierDto,
} from '../types/supplier';
import type {
  CreatePurchaseDto, PurchaseReceiptDto, PurchaseListDto, PurchaseDetailDto,
} from '../types/purchase';
import type { SettingsMap } from '../types/settings';
import type {
  DailySalesRow, MonthlyPnLRow, TopSellerRow, SlowMovingRow,
  LowStockRow, ExpiryReportDetailRow, SupplierPurchaseRow, SalesByUserRow,
  ProfitMarginRow, UpdateSettingsPayload, BackupStatus, BackupResult, BackupFileInfo,
  DbStatus,
} from '../types/report';
import type {
  MedicinePosDto, ConfirmSaleDto, SaleReceiptDto,
  OwnerDashboardDto, PharmacistDashboardDto, SaleListDto, SaleDetailDto,
} from '../types/sale';
import type { BatchListDto, UpdateBatchDto } from '../types/batch';
import type {
  CustomerReturnDto, ReturnReceiptDto,
  SaleForReturnDto, SupplierReturnDto,
  PurchaseForReturnDto, WriteOffDto,
  ReturnListItemDto,
} from '../types/return';
import type { DebtorDto, DebtorListItem, DebtDetailDto, CreateDebtDto } from '../types/debt';

export interface SessionInfo {
  user_id: number;
  username: string;
  role: 'owner' | 'pharmacist';
  full_name: string;
}

// Payload for creating the initial owner (matches Rust CreateOwnerPayload)
export interface CreateOwnerDto {
  full_name: string;
  username: string;
  password: string;
  owner_email?: string | null;
}

// ExpiryReportRow returned by get_expiry_report
export interface ExpiryReportRow {
  batch_id: number;
  medicine_id: number;
  medicine_name: string;
  generic_name: string | null;
  quantity: number;
  remaining_qty: number;
  purchase_price: number;
  expiry_date: string;
  days_remaining: number;
}

/** Typed wrappers for all Tauri commands.
 *
 * Each method encapsulates invoke() with correct types,
 * so callers don't need to specify the generic parameter.
 */
export const tauri = {
  auth: {
    login: (payload: LoginDto) =>
      invoke<SessionDto>('auth_login', { payload }),
    logout: (sessionToken: string) =>
      invoke<void>('auth_logout', { sessionToken }),
    checkSession: (sessionToken: string) =>
      invoke<SessionInfo>('check_session', { sessionToken }),
  },
  setup: {
    checkStatus: () =>
      invoke<SetupStatus>('check_setup_status'),
    createOwner: (payload: CreateOwnerDto) =>
      invoke<SessionDto>('create_initial_owner', { payload }),
    requestRecoveryCode: () =>
      invoke<{ masked_email: string; expires_minutes: number }>('request_recovery_code'),
    verifyRecoveryCode: (code: string) =>
      invoke<{ id: number; username: string }[]>('verify_recovery_code', { code }),
    resetWithRecoveryCode: (userId: number, code: string, newPassword: string) =>
      invoke<void>('reset_with_recovery_code', { userId, code, newPassword }),
  },
  users: {
    list: (sessionToken: string) =>
      invoke<UserDto[]>('list_users', { sessionToken }),
    create: (sessionToken: string, payload: CreateUserDto) =>
      invoke<UserDto>('create_user', { sessionToken, payload }),
    deactivate: (sessionToken: string, targetUserId: number) =>
      invoke<void>('deactivate_user', { sessionToken, targetUserId }),
    delete: (sessionToken: string, targetUserId: number) =>
      invoke<void>('delete_user', { sessionToken, targetUserId }),
    changePassword: (sessionToken: string, currentPassword: string, newPassword: string) =>
      invoke<void>('change_password', { sessionToken, currentPassword, newPassword }),
    resetPassword: (sessionToken: string, targetUserId: number, newPassword: string) =>
      invoke<void>('reset_password', { sessionToken, targetUserId, newPassword }),
  },
  audit: {
    getLoginAttempts: (sessionToken: string) =>
      invoke<LoginAttemptDto[]>('get_login_attempts', { sessionToken }),
    getLoginAttemptsFiltered: (
      sessionToken: string,
      filters: {
        username?: string | null;
        success?: boolean | null;
        start_date?: string | null;
        end_date?: string | null;
        limit?: number | null;
        offset?: number | null;
      }
    ) =>
      invoke<LoginAttemptDto[]>('get_login_attempts_filtered', { sessionToken, filters }),
  },

  medicines: {
    list: (sessionToken: string, page: number, perPage: number) =>
      invoke<PaginatedList<MedicineListItem>>('list_medicines', { sessionToken, page, perPage }),
    search: (sessionToken: string, query: string, page: number, perPage: number) =>
      invoke<PaginatedList<MedicineListItem>>('search_medicines', { sessionToken, query, page, perPage }),
    searchPharmacist: (sessionToken: string, query: string, page: number, perPage: number) =>
      invoke<PaginatedList<MedicinePharmacistDto>>('search_medicines_pharmacist', { sessionToken, query, page, perPage }),
    create: (sessionToken: string, payload: CreateMedicineDto) =>
      invoke<MedicineDto>('create_medicine', { sessionToken, payload }),
    update: (sessionToken: string, medicineId: number, payload: UpdateMedicineDto) =>
      invoke<MedicineDto>('update_medicine', { sessionToken, medicineId, payload }),
    deactivate: (sessionToken: string, medicineId: number) =>
      invoke<void>('deactivate_medicine', { sessionToken, medicineId }),
    delete: (sessionToken: string, medicineId: number) =>
      invoke<void>('delete_medicine', { sessionToken, medicineId }),
    get: (sessionToken: string, medicineId: number) =>
      invoke<MedicineDto>('get_medicine', { sessionToken, medicineId }),
    importCsv: (sessionToken: string, csvData: string) =>
      invoke<CsvImportResult>('import_medicines_csv', { sessionToken, csvData }),
  },

  suppliers: {
    list: (sessionToken: string) =>
      invoke<SupplierDto[]>('list_suppliers', { sessionToken }),
    search: (sessionToken: string, query: string) =>
      invoke<SupplierDto[]>('search_suppliers', { sessionToken, query }),
    create: (sessionToken: string, payload: CreateSupplierDto) =>
      invoke<SupplierDto>('create_supplier', { sessionToken, payload }),
    update: (sessionToken: string, supplierId: number, payload: UpdateSupplierDto) =>
      invoke<SupplierDto>('update_supplier', { sessionToken, supplierId, payload }),
    deactivate: (sessionToken: string, supplierId: number) =>
      invoke<void>('deactivate_supplier', { sessionToken, supplierId }),
    delete: (sessionToken: string, supplierId: number) =>
      invoke<void>('delete_supplier', { sessionToken, supplierId }),
  },

  purchases: {
    record: (sessionToken: string, payload: CreatePurchaseDto) =>
      invoke<PurchaseReceiptDto>('record_purchase', { sessionToken, payload }),
    list: (sessionToken: string) =>
      invoke<PurchaseListDto[]>('list_purchases', { sessionToken }),
    getDetail: (sessionToken: string, purchaseId: number) =>
      invoke<PurchaseDetailDto>('get_purchase_detail', { sessionToken, purchaseId }),
  },

  stock: {
    getCurrentStock: (sessionToken: string, medicineId: number) =>
      invoke<number>('get_current_stock', { sessionToken, medicineId }),
  },

  settings: {
    get: (sessionToken: string) => invoke<SettingsMap>('get_settings', { sessionToken }),
    update: (sessionToken: string, payload: UpdateSettingsPayload) =>
      invoke<void>('update_settings', { sessionToken, payload }),
  },

  expiry: {
    getReport: (sessionToken: string, minDays?: number, maxDays?: number) =>
      invoke<ExpiryReportRow[]>('get_expiry_report', { sessionToken, minDays, maxDays }),
  },

  reports: {
    dailySales: (sessionToken: string, startDate: string, endDate: string) =>
      invoke<DailySalesRow[]>('get_daily_sales_report', { sessionToken, startDate, endDate }),
    monthlyPnl: (sessionToken: string, startDate: string, endDate: string) =>
      invoke<MonthlyPnLRow[]>('get_monthly_pnl', { sessionToken, startDate, endDate }),
    topSellers: (sessionToken: string, startDate: string, endDate: string) =>
      invoke<TopSellerRow[]>('get_top_sellers', { sessionToken, startDate, endDate }),
    slowMoving: (sessionToken: string, startDate: string, endDate: string) =>
      invoke<SlowMovingRow[]>('get_slow_moving', { sessionToken, startDate, endDate }),
    lowStock: (sessionToken: string) =>
      invoke<LowStockRow[]>('get_low_stock', { sessionToken }),
    expiryReport: (sessionToken: string, warningDays: number, criticalDays: number) =>
      invoke<ExpiryReportDetailRow[]>('get_expiry_report_phase5', { sessionToken, warningDays, criticalDays }),
    supplierPurchases: (sessionToken: string, startDate: string, endDate: string) =>
      invoke<SupplierPurchaseRow[]>('get_supplier_purchases', { sessionToken, startDate, endDate }),
    salesByUser: (sessionToken: string, startDate: string, endDate: string) =>
      invoke<SalesByUserRow[]>('get_sales_by_user', { sessionToken, startDate, endDate }),
    profitMargin: (sessionToken: string, startDate: string, endDate: string) =>
      invoke<ProfitMarginRow[]>('get_profit_margin', { sessionToken, startDate, endDate }),
  },

  backup: {
    trigger: (sessionToken: string) =>
      invoke<BackupResult>('trigger_backup', { sessionToken }),
    restore: (sessionToken: string, fileName: string, source: string) =>
      invoke<BackupResult>('restore_backup', { sessionToken, fileName, source }),
    connectDrive: (sessionToken: string) =>
      invoke<void>('start_drive_oauth', { sessionToken }),
    disconnectDrive: (sessionToken: string) =>
      invoke<void>('disconnect_drive', { sessionToken }),
    listDriveBackups: (sessionToken: string) =>
      invoke<BackupFileInfo[]>('list_drive_backups', { sessionToken }),
    getStatus: (sessionToken: string) =>
      invoke<BackupStatus>('get_backup_status', { sessionToken }),
  },

  sales: {
    searchMedicinesPos: (sessionToken: string, query: string) =>
      invoke<MedicinePosDto[]>('search_medicines_pos', { sessionToken, query }),
    confirmSale: (sessionToken: string, payload: ConfirmSaleDto) =>
      invoke<SaleReceiptDto>('confirm_sale', { sessionToken, payload }),
    list: (sessionToken: string, query?: string, startDate?: string, endDate?: string, page?: number, perPage?: number) =>
      invoke<PaginatedList<SaleListDto>>('list_sales', { sessionToken, query: query ?? '', startDate: startDate ?? '', endDate: endDate ?? '', page: page ?? 1, perPage: perPage ?? 50 }),
    getDetail: (sessionToken: string, saleId: number) =>
      invoke<SaleDetailDto>('get_sale_detail', { sessionToken, saleId }),
    getOwnerDashboard: (sessionToken: string) =>
      invoke<OwnerDashboardDto>('get_owner_dashboard', { sessionToken }),
    getPharmacistDashboard: (sessionToken: string) =>
      invoke<PharmacistDashboardDto>('get_pharmacist_dashboard', { sessionToken }),
  },

  returns: {
    processCustomerReturn: (sessionToken: string, payload: CustomerReturnDto) =>
      invoke<ReturnReceiptDto>('process_customer_return', { sessionToken, payload }),
    processSupplierReturn: (sessionToken: string, payload: SupplierReturnDto) =>
      invoke<ReturnReceiptDto>('process_supplier_return', { sessionToken, payload }),
    processWriteOff: (sessionToken: string, payload: WriteOffDto) =>
      invoke<ReturnReceiptDto>('process_write_off', { sessionToken, payload }),
    searchSaleForReturn: (sessionToken: string, saleId: number) =>
      invoke<SaleForReturnDto>('search_sale_for_return', { sessionToken, saleId }),
    searchPurchaseForReturn: (sessionToken: string, purchaseId: number) =>
      invoke<PurchaseForReturnDto>('search_purchase_for_return', { sessionToken, purchaseId }),
    listReturns: (sessionToken: string, page: number, perPage: number) =>
      invoke<PaginatedList<ReturnListItemDto>>('list_returns', { sessionToken, page, perPage }),
  },

  debt: {
    create: (sessionToken: string, payload: CreateDebtDto) =>
      invoke<DebtorDto>('create_debt', { sessionToken, payload }),
    list: (sessionToken: string) =>
      invoke<DebtorListItem[]>('list_debts', { sessionToken }),
    get: (sessionToken: string, debtId: number) =>
      invoke<DebtDetailDto>('get_debt', { sessionToken, debtId }),
    recordPayment: (sessionToken: string, debtId: number, amount: number) =>
      invoke<DebtorDto>('record_payment', { sessionToken, debtId, amount }),
    getOverdueCount: (sessionToken: string) =>
      invoke<number>('get_overdue_count', { sessionToken }),
    getDueSoonCount: (sessionToken: string) =>
      invoke<number>('get_due_soon_count', { sessionToken }),
  },

  batches: {
    list: (sessionToken: string) =>
      invoke<BatchListDto[]>('list_batches', { sessionToken }),
    update: (sessionToken: string, batchId: number, payload: UpdateBatchDto) =>
      invoke<void>('update_batch', { sessionToken, batchId, payload }),
  },

  pdf: {
    save: (sessionToken: string, fileName: string, bytes: number[]) =>
      invoke<string | null>('save_pdf', { sessionToken, fileName, bytes }),
  },

  db: {
    getStatus: (sessionToken: string) =>
      invoke<DbStatus>('get_db_status', { sessionToken }),
  },
};
