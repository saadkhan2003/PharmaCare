use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Debtor {
    pub id: i64,
    pub customer_name: String,
    pub phone: Option<String>,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub due_date: String,
    pub notes: Option<String>,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebtorListItem {
    pub id: i64,
    pub customer_name: String,
    pub phone: Option<String>,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub remaining: f64,
    pub due_date: String,
    pub status: String,
    pub days_remaining: i64,
    pub item_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebtItem {
    pub id: i64,
    pub debt_id: i64,
    pub sale_id: Option<i64>,
    pub medicine_name: String,
    pub quantity: i64,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDebtRequest {
    pub customer_name: String,
    pub phone: Option<String>,
    pub items: Vec<DebtItemRequest>,
    pub due_date: String,
    pub notes: Option<String>,
}

impl CreateDebtRequest {
    pub fn total_amount(&self) -> f64 {
        self.items.iter().map(|i| i.amount).sum()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebtItemRequest {
    pub medicine_name: String,
    pub quantity: i64,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebtDetail {
    pub debtor: Debtor,
    pub items: Vec<DebtItem>,
}
