import { invoke } from '@tauri-apps/api/core';
import type { SessionDto, SetupStatus } from '../types/session';
import type { UserDto, CreateUserDto, LoginAttemptDto } from '../types/user';
import type { LoginDto } from '../types/session';
import type {
  MedicineDto, MedicineListItem, MedicinePharmacistDto,
  CreateMedicineDto, UpdateMedicineDto,
} from '../types/medicine';
import type {
  SupplierDto, CreateSupplierDto, UpdateSupplierDto,
} from '../types/supplier';
import type {
  CreatePurchaseDto, PurchaseReceiptDto, PurchaseListDto, PurchaseDetailDto,
} from '../types/purchase';
import type { SettingsMap } from '../types/settings';
import type {
  MedicinePosDto, ConfirmSaleDto, SaleReceiptDto,
  OwnerDashboardDto, PharmacistDashboardDto,
} from '../types/sale';
import type {
  CustomerReturnDto, ReturnReceiptDto,
  SaleForReturnDto, SupplierReturnDto,
  PurchaseForReturnDto, WriteOffDto,
  ReturnListItemDto,
} from '../types/return';

// SessionInfo returned by check_session — matches Rust SessionInfo struct
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
  },
  users: {
    list: (sessionToken: string) =>
      invoke<UserDto[]>('list_users', { sessionToken }),
    create: (sessionToken: string, payload: CreateUserDto) =>
      invoke<UserDto>('create_user', { sessionToken, payload }),
    deactivate: (sessionToken: string, targetUserId: number) =>
      invoke<void>('deactivate_user', { sessionToken, targetUserId }),
  },
  audit: {
    getLoginAttempts: (sessionToken: string) =>
      invoke<LoginAttemptDto[]>('get_login_attempts', { sessionToken }),
  },

  medicines: {
    list: (sessionToken: string) =>
      invoke<MedicineListItem[]>('list_medicines', { sessionToken }),
    search: (sessionToken: string, query: string) =>
      invoke<MedicineListItem[]>('search_medicines', { sessionToken, query }),
    searchPharmacist: (sessionToken: string, query: string) =>
      invoke<MedicinePharmacistDto[]>('search_medicines_pharmacist', { sessionToken, query }),
    create: (sessionToken: string, payload: CreateMedicineDto) =>
      invoke<MedicineDto>('create_medicine', { sessionToken, payload }),
    update: (sessionToken: string, medicineId: number, payload: UpdateMedicineDto) =>
      invoke<MedicineDto>('update_medicine', { sessionToken, medicineId, payload }),
    deactivate: (sessionToken: string, medicineId: number) =>
      invoke<void>('deactivate_medicine', { sessionToken, medicineId }),
    get: (sessionToken: string, medicineId: number) =>
      invoke<MedicineDto>('get_medicine', { sessionToken, medicineId }),
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
    get: () => invoke<SettingsMap>('get_settings'),
  },

  expiry: {
    getReport: (sessionToken: string, minDays?: number, maxDays?: number) =>
      invoke<ExpiryReportRow[]>('get_expiry_report', { sessionToken, minDays, maxDays }),
  },

  sales: {
    searchMedicinesPos: (sessionToken: string, query: string) =>
      invoke<MedicinePosDto[]>('search_medicines_pos', { sessionToken, query }),
    confirmSale: (sessionToken: string, payload: ConfirmSaleDto) =>
      invoke<SaleReceiptDto>('confirm_sale', { sessionToken, payload }),
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
    listReturns: (sessionToken: string) =>
      invoke<ReturnListItemDto[]>('list_returns', { sessionToken }),
  },
};
