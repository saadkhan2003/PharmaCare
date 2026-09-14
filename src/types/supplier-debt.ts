export interface SupplierDebt {
  id: number;
  supplier_id: number;
  supplier_name: string;
  purchase_id: number | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierPayment {
  id: number;
  debt_id: number;
  amount: number;
  payment_date: string;
  notes: string | null;
  recorded_by: number;
  created_at: string;
}

export interface SupplierDebtDetail {
  debt: SupplierDebt;
  payments: SupplierPayment[];
}

export interface SupplierDebtListItem {
  id: number;
  supplier_id: number;
  supplier_name: string;
  purchase_id: number | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface CreateSupplierDebtRequest {
  supplier_id: number;
  purchase_id?: number;
  total_amount: number;
  paid_amount?: number;
  due_date?: string;
  notes?: string;
}

export interface RecordSupplierPaymentRequest {
  debt_id: number;
  amount: number;
  payment_date?: string;
  notes?: string;
  recorded_by: number;
}
