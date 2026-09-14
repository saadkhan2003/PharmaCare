use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierDebt {
    pub id: i64,
    pub supplier_id: i64,
    pub supplier_name: String,
    pub purchase_id: Option<i64>,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub remaining_amount: f64,
    pub due_date: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierPayment {
    pub id: i64,
    pub debt_id: i64,
    pub amount: f64,
    pub payment_date: String,
    pub notes: Option<String>,
    pub recorded_by: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSupplierDebtRequest {
    pub supplier_id: i64,
    pub purchase_id: Option<i64>,
    pub total_amount: f64,
    pub paid_amount: Option<f64>,
    pub due_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordSupplierPaymentRequest {
    pub debt_id: i64,
    pub amount: f64,
    pub payment_date: Option<String>,
    pub notes: Option<String>,
    pub recorded_by: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierDebtListItem {
    pub id: i64,
    pub supplier_id: i64,
    pub supplier_name: String,
    pub purchase_id: Option<i64>,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub remaining_amount: f64,
    pub due_date: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierDebtDetail {
    pub debt: SupplierDebt,
    pub payments: Vec<SupplierPayment>,
}
