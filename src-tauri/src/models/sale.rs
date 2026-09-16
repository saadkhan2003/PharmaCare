use serde::{Deserialize, Serialize};

/// POS-specific medicine search result — excludes purchase_price always (per D-34/POS-01)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicinePosDto {
    pub id: i64,
    pub name: String,
    pub generic_name: Option<String>,
    pub unit: String,
    pub retail_price: f64,
    pub current_stock: i64,
    pub reorder_level: i64,
    pub shelf_location: Option<String>,
}

/// Input item from frontend (what user adds to cart)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfirmSaleItemDto {
    pub medicine_id: i64,
    pub quantity: i64,
    pub item_discount: f64, // currency amount, capped at unit_price * qty
}

/// Frontend payload for confirming a sale
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfirmSaleDto {
    pub items: Vec<ConfirmSaleItemDto>,
    pub bill_discount: f64, // currency amount, capped at subtotal
    pub tax_enabled: bool,
    pub payment_method: String, // "Cash" | "Card" | "Credit"
    pub customer_name: Option<String>,
    #[serde(default)]
    pub customer_phone: Option<String>,
    #[serde(default)]
    pub due_date: Option<String>,
}

/// Full sale header (DB row)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sale {
    pub id: i64,
    pub user_id: i64,
    pub subtotal: f64,
    pub bill_discount: f64,
    pub tax_rate: f64,
    pub tax_amount: f64,
    pub total: f64,
    pub payment_method: String,
    pub customer_name: Option<String>,
    pub created_at: String,
}

/// Sale line item (DB row)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleItem {
    pub id: i64,
    pub sale_id: i64,
    pub medicine_id: i64,
    pub batch_id: i64,
    pub quantity: i64,
    pub unit_price: f64,
    pub purchase_cost: f64,
    pub item_discount: f64,
    pub line_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleListDto {
    pub id: i64,
    pub total: f64,
    pub payment_method: String,
    pub customer_name: Option<String>,
    pub item_count: i64,
    pub created_at: String,
    pub total_returned_qty: i64,
    pub total_refund_amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleDetailDto {
    pub sale: Sale,
    pub items: Vec<SaleDetailItemDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleDetailItemDto {
    pub id: i64,
    pub medicine_name: String,
    pub batch_id: i64,
    pub quantity: i64,
    pub unit_price: f64,
    pub purchase_cost: f64,
    pub item_discount: f64,
    pub line_total: f64,
}

/// DTO returned to frontend after successful sale
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleReceiptDto {
    pub sale_id: i64,
    pub subtotal: f64,
    pub bill_discount: f64,
    pub tax_rate: f64,
    pub tax_amount: f64,
    pub total: f64,
    pub payment_method: String,
    pub customer_name: Option<String>,
    pub item_count: i64,
    pub items: Vec<SaleReceiptItemDto>,
}

/// Individual line item in receipt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleReceiptItemDto {
    pub medicine_name: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub item_discount: f64,
    pub line_total: f64,
}

/// Owner dashboard DTO — includes profit data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnerDashboardDto {
    pub today_sales: f64,
    pub today_profit: f64,
    pub month_sales: f64,
    pub low_stock_count: i64,
    pub expiry_warning_count: i64,
    pub expiry_critical_count: i64,
    pub top_sellers: Vec<TopSellerDto>,
}

/// Pharmacist dashboard DTO — NO profit data (D-42)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PharmacistDashboardDto {
    pub today_sales: f64,
    pub low_stock_count: i64,
    pub expiry_warning_count: i64,
    pub expiry_critical_count: i64,
}

/// Top-selling medicine this week
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopSellerDto {
    pub medicine_id: i64,
    pub medicine_name: String,
    pub total_qty: i64,
}

/// Internal allocation record (used during FIFO processing, not IPC)
#[derive(Debug, Clone)]
pub struct SaleItemAllocation {
    pub medicine_id: i64,
    pub batch_id: i64,
    pub quantity: i64,
    pub unit_price: f64,
    pub purchase_cost: f64,
    pub item_discount: f64,
    pub line_total: f64,
}
