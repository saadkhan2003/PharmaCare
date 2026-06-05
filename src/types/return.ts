// --- Customer Return ---

export interface CustomerReturnItemDto {
  sale_item_id: number;
  medicine_id: number;
  batch_id: number;
  quantity: number;
  condition: 'resellable' | 'damaged' | 'expired';
  reason: string | null;
  refund_amount: number;
}

export interface CustomerReturnDto {
  sale_id: number;
  items: CustomerReturnItemDto[];
}

export interface SaleItemForReturnDto {
  sale_item_id: number;
  medicine_id: number;
  medicine_name: string;
  batch_id: number;
  quantity: number;
  unit_price: number;
  already_returned_qty: number;
  returnable_qty: number;
}

export interface SaleForReturnDto {
  id: number;
  created_at: string;
  payment_method: string;
  total: number;
  customer_name: string | null;
  items: SaleItemForReturnDto[];
}

// --- Supplier Return ---

export interface SupplierReturnItemDto {
  medicine_id: number;
  batch_id: number;
  quantity: number;
  reason: string | null;
  credit_amount: number;
}

export interface SupplierReturnDto {
  purchase_id: number;
  items: SupplierReturnItemDto[];
}

export interface PurchaseItemForReturnDto {
  purchase_item_id: number;
  medicine_id: number;
  medicine_name: string;
  batch_id: number;
  quantity: number;
  remaining_qty: number;
  purchase_price: number;
  expiry_date: string;
}

export interface PurchaseForReturnDto {
  id: number;
  supplier_id: number;
  supplier_name: string;
  purchase_date: string;
  invoice_number: string | null;
  items: PurchaseItemForReturnDto[];
}

// --- Write-off ---

export interface WriteOffItemDto {
  medicine_id: number;
  batch_id: number;
  quantity: number;
  condition: 'expired' | 'damaged';
  reason: string | null;
}

export interface WriteOffDto {
  items: WriteOffItemDto[];
}

// --- Return History ---

export interface ReturnListItemDto {
  id: number;
  return_type: string;
  reference_id: number | null;
  medicine_id: number;
  medicine_name: string;
  batch_id: number | null;
  quantity: number;
  condition: string | null;
  refund_amount: number;
  processed_by: number;
  return_date: string;
}

// --- Receipt (shared) ---

export interface ReturnReceiptDto {
  return_ids: number[];
  item_count: number;
  total_refund: number;
}
