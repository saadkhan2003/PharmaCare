export interface SupplierDto {
  id: number;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  outstanding_debt: number;
}

export interface CreateSupplierDto {
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
}

export interface UpdateSupplierDto {
  company_name?: string;
  contact_person?: string | null;
  phone?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
}
