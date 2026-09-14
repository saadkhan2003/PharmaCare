export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface MedicineDto {
  id: number;
  name: string;
  generic_name: string | null;
  brand_name: string | null;
  category: string;
  unit: string;
  retail_price: number;
  purchase_price: number;
  current_stock: number;
  reorder_level: number;
  shelf_location: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface MedicinePharmacistDto {
  id: number;
  name: string;
  generic_name: string | null;
  brand_name: string | null;
  category: string;
  unit: string;
  retail_price: number;
  current_stock: number;
  reorder_level: number;
  shelf_location: string | null;
  is_active: boolean;
}

export interface MedicineListItem {
  id: number;
  name: string;
  generic_name: string | null;
  brand_name: string | null;
  category: string;
  unit: string;
  retail_price: number;
  purchase_price: number;
  current_stock: number;
  reorder_level: number;
  is_active: boolean;
}

export interface CreateMedicineDto {
  name: string;
  generic_name: string | null;
  brand_name: string | null;
  category: string;
  unit: string;
  retail_price: number;
  purchase_price: number;
  reorder_level: number | null;
  shelf_location: string | null;
  notes: string | null;
  initial_stock?: number | null;
  initial_expiry_date?: string | null;
}

export interface UpdateMedicineDto {
  name?: string;
  generic_name?: string | null;
  brand_name?: string | null;
  category?: string;
  unit?: string;
  retail_price?: number;
  purchase_price?: number;
  reorder_level?: number | null;
  shelf_location?: string | null;
  notes?: string | null;
}

export const MEDICINE_CATEGORIES = ['Tablet', 'Syrup', 'Injection', 'OTC', 'Prescription'] as const;
export const MEDICINE_UNITS = ['Strip', 'Bottle', 'Vial', 'Box', 'Sachet'] as const;

export type MedicineCategory = typeof MEDICINE_CATEGORIES[number];
export type MedicineUnit = typeof MEDICINE_UNITS[number];

export interface CsvImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}
