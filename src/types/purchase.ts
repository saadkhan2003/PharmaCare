export interface CreatePurchaseItemDto {
  medicine_id: number;
  quantity: number;
  purchase_price: number;
  expiry_date: string;
}

export interface CreatePurchaseDto {
  supplier_id: number;
  invoice_number: string | null;
  purchase_date: string;
  payment_status: string;
  notes: string | null;
  items: CreatePurchaseItemDto[];
}

export interface PurchaseReceiptDto {
  purchase_id: number;
  total_cost: number;
  item_count: number;
}

export interface PurchaseListDto {
  id: number;
  supplier_name: string;
  invoice_number: string | null;
  purchase_date: string;
  total_cost: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  item_count: number;
  created_at: string;
}

export interface PurchaseDetailDto {
  id: number;
  supplier_id: number;
  supplier_name: string;
  invoice_number: string | null;
  purchase_date: string;
  total_cost: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  debt_id?: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  items: PurchaseItemDetailDto[];
  payments: import('./supplier-debt').SupplierPayment[];
}

export interface PurchaseItemDetailDto {
  id: number;
  medicine_id: number;
  medicine_name: string;
  quantity: number;
  purchase_price: number;
  line_cost: number;
  expiry_date: string;
  batch_id: number | null;
  batch_code?: string | null;
}

export const PAYMENT_STATUSES = ['Paid', 'Pending', 'Partial'] as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[number];
