use serde::{Deserialize, Serialize};

/// Full batch record from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Batch {
    pub id: i64,
    pub medicine_id: i64,
    pub purchase_id: Option<i64>,
    pub purchase_item_id: Option<i64>,
    pub purchase_price: f64,
    pub quantity: i64,
    pub remaining_qty: i64,
    pub expiry_date: String,
    pub received_date: String,
}

/// Batch DTO for frontend display (excludes internal FK refs).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchDto {
    pub id: i64,
    pub medicine_id: i64,
    pub purchase_price: f64,
    pub quantity: i64,
    pub remaining_qty: i64,
    pub expiry_date: String,
    pub received_date: String,
}

impl From<Batch> for BatchDto {
    fn from(b: Batch) -> Self {
        BatchDto {
            id: b.id,
            medicine_id: b.medicine_id,
            purchase_price: b.purchase_price,
            quantity: b.quantity,
            remaining_qty: b.remaining_qty,
            expiry_date: b.expiry_date,
            received_date: b.received_date,
        }
    }
}

/// Row returned by the expiry report query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpiryReportRow {
    pub batch_id: i64,
    pub medicine_id: i64,
    pub medicine_name: String,
    pub generic_name: Option<String>,
    pub quantity: i64,
    pub remaining_qty: i64,
    pub purchase_price: f64,
    pub expiry_date: String,
    pub days_remaining: i64,
}
