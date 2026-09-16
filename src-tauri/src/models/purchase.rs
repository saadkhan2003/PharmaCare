use serde::{Deserialize, Serialize};

// --- Database row structs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Purchase {
    pub id: i64,
    pub supplier_id: i64,
    pub invoice_number: Option<String>,
    pub purchase_date: String,
    pub total_cost: Option<f64>,
    pub payment_status: String,
    pub notes: Option<String>,
    pub user_id: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseItem {
    pub id: i64,
    pub purchase_id: i64,
    pub medicine_id: i64,
    pub quantity: i64,
    pub purchase_price: f64,
    pub expiry_date: String,
    pub batch_id: Option<i64>,
    pub line_cost: f64,
}

// --- Command DTOs (from frontend) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePurchaseItemDto {
    pub medicine_id: i64,
    pub quantity: i64,
    pub purchase_price: f64,
    pub expiry_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePurchaseDto {
    pub supplier_id: i64,
    pub invoice_number: Option<String>,
    pub purchase_date: String,
    pub payment_status: String,
    pub notes: Option<String>,
    pub items: Vec<CreatePurchaseItemDto>,
}

// --- Response DTOs (to frontend) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseReceiptDto {
    pub purchase_id: i64,
    pub total_cost: f64,
    pub item_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseItemDto {
    pub id: i64,
    pub medicine_id: i64,
    pub medicine_name: String,
    pub quantity: i64,
    pub purchase_price: f64,
    pub line_cost: f64,
    pub expiry_date: String,
    pub batch_id: Option<i64>,
    pub batch_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseDetailDto {
    pub id: i64,
    pub supplier_id: i64,
    pub supplier_name: String,
    pub invoice_number: Option<String>,
    pub purchase_date: String,
    pub total_cost: f64,
    pub paid_amount: f64,
    pub remaining_amount: f64,
    pub payment_status: String,
    pub debt_id: Option<i64>,
    pub notes: Option<String>,
    pub created_by: String,
    pub created_at: String,
    pub items: Vec<PurchaseItemDto>,
    pub payments: Vec<crate::models::supplier_debt::SupplierPayment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseListDto {
    pub id: i64,
    pub supplier_name: String,
    pub invoice_number: Option<String>,
    pub purchase_date: String,
    pub total_cost: f64,
    pub paid_amount: f64,
    pub remaining_amount: f64,
    pub payment_status: String,
    pub item_count: i64,
    pub created_at: String,
}
