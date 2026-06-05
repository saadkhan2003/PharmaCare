export interface MedicinePosDto {
  id: number;
  name: string;
  generic_name: string | null;
  unit: string;
  retail_price: number;
  current_stock: number;
  reorder_level: number;
  shelf_location: string | null;
}

export interface ConfirmSaleItemDto {
  medicine_id: number;
  quantity: number;
  item_discount: number;
}

export interface ConfirmSaleDto {
  items: ConfirmSaleItemDto[];
  bill_discount: number;
  tax_enabled: boolean;
  payment_method: string;
  customer_name: string | null;
}

export interface SaleReceiptDto {
  sale_id: number;
  subtotal: number;
  bill_discount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  payment_method: string;
  customer_name: string | null;
  item_count: number;
  items: SaleReceiptItemDto[];
}

export interface SaleReceiptItemDto {
  medicine_name: string;
  quantity: number;
  unit_price: number;
  item_discount: number;
  line_total: number;
}

export interface OwnerDashboardDto {
  today_sales: number;
  today_profit: number;
  month_sales: number;
  low_stock_count: number;
  expiry_warning_count: number;
  expiry_critical_count: number;
  top_sellers: TopSellerDto[];
}

export interface PharmacistDashboardDto {
  today_sales: number;
  low_stock_count: number;
  expiry_warning_count: number;
  expiry_critical_count: number;
}

export interface TopSellerDto {
  medicine_id: number;
  medicine_name: string;
  total_qty: number;
}
