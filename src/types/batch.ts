export interface BatchListDto {
  id: number;
  medicine_id: number;
  medicine_name: string;
  batch_code: string | null;
  purchase_id: number | null;
  purchase_price: number;
  quantity: number;
  remaining_qty: number;
  expiry_date: string;
  received_date: string;
}

export interface UpdateBatchDto {
  batch_code?: string | null;
  expiry_date: string;
}
