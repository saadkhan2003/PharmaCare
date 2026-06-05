export interface DebtorDto {
  id: number;
  customer_name: string;
  phone: string | null;
  total_amount: number;
  paid_amount: number;
  due_date: string;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface DebtorListItem {
  id: number;
  customer_name: string;
  phone: string | null;
  total_amount: number;
  paid_amount: number;
  remaining: number;
  due_date: string;
  status: string;
  days_remaining: number;
  item_count: number;
}

export interface DebtItemDto {
  id: number;
  debt_id: number;
  sale_id: number | null;
  medicine_name: string;
  quantity: number;
  amount: number;
}

export interface CreateDebtDto {
  customer_name: string;
  phone?: string | null;
  items: { medicine_name: string; quantity: number; amount: number }[];
  due_date: string;
  notes?: string | null;
}

export interface DebtDetailDto {
  debtor: DebtorDto;
  items: DebtItemDto[];
}
