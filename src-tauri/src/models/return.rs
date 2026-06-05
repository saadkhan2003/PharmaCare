use serde::{Deserialize, Serialize};

// --- Database row struct ---

/// Full returns table row (DB-level).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Return {
    pub id: i64,
    pub return_type: String, // "customer" | "supplier" | "write_off"
    pub reference_id: Option<i64>,
    pub medicine_id: i64,
    pub batch_id: Option<i64>,
    pub quantity: i64,
    pub reason: Option<String>,
    pub condition: Option<String>, // "resellable" | "damaged" | "expired" | null
    pub refund_amount: f64,
    pub processed_by: i64,
    pub return_date: String,
}

// --- Command DTOs (from frontend) ---

/// Frontend payload: process a customer return.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerReturnDto {
    pub sale_id: i64,
    pub items: Vec<CustomerReturnItemDto>,
}

/// Individual item within a customer return request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerReturnItemDto {
    pub sale_item_id: i64,
    pub medicine_id: i64,
    pub batch_id: i64,
    pub quantity: i64,
    pub condition: String, // "resellable" | "damaged" | "expired"
    pub reason: Option<String>,
    pub refund_amount: f64,
}

/// Frontend payload: process a supplier return.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierReturnDto {
    pub purchase_id: i64,
    pub items: Vec<SupplierReturnItemDto>,
}

/// Individual item within a supplier return request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierReturnItemDto {
    pub medicine_id: i64,
    pub batch_id: i64,
    pub quantity: i64,
    pub reason: Option<String>,
    pub credit_amount: f64,
}

/// Frontend payload: process a write-off (standalone, not from return).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteOffDto {
    pub items: Vec<WriteOffItemDto>,
}

/// Individual item within a write-off request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteOffItemDto {
    pub medicine_id: i64,
    pub batch_id: i64,
    pub quantity: i64,
    pub condition: String, // "expired" | "damaged"
    pub reason: Option<String>,
}

// --- Response DTOs (to frontend) ---

/// Receipt returned after successful return processing.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnReceiptDto {
    pub return_ids: Vec<i64>,
    pub item_count: i64,
    pub total_refund: f64,
}

/// Sale data returned for customer return lookup.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleForReturnDto {
    pub id: i64,
    pub created_at: String,
    pub payment_method: String,
    pub total: f64,
    pub customer_name: Option<String>,
    pub items: Vec<SaleItemForReturnDto>,
}

/// Individual sale item with computed returnable quantity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleItemForReturnDto {
    pub sale_item_id: i64,
    pub medicine_id: i64,
    pub medicine_name: String,
    pub batch_id: i64,
    pub quantity: i64,
    pub unit_price: f64,
    pub already_returned_qty: i64,
    pub returnable_qty: i64,
}

/// Purchase data returned for supplier return lookup.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseForReturnDto {
    pub id: i64,
    pub supplier_id: i64,
    pub supplier_name: String,
    pub purchase_date: String,
    pub invoice_number: Option<String>,
    pub items: Vec<PurchaseItemForReturnDto>,
}

/// Individual purchase item with batch info for supplier return.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseItemForReturnDto {
    pub purchase_item_id: i64,
    pub medicine_id: i64,
    pub medicine_name: String,
    pub batch_id: i64,
    pub quantity: i64,
    pub remaining_qty: i64,
    pub purchase_price: f64,
    pub expiry_date: String,
}
