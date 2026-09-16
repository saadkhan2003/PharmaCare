use serde::{Deserialize, Serialize};

/// Full supplier record from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Supplier {
    pub id: i64,
    pub company_name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub payment_terms: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

/// Supplier DTO returned to frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierDto {
    pub id: i64,
    pub company_name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub payment_terms: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub outstanding_debt: f64,
}

impl From<Supplier> for SupplierDto {
    fn from(s: Supplier) -> Self {
        SupplierDto {
            id: s.id,
            company_name: s.company_name,
            contact_person: s.contact_person,
            phone: s.phone,
            address: s.address,
            payment_terms: s.payment_terms,
            notes: s.notes,
            is_active: s.is_active,
            outstanding_debt: 0.0,
        }
    }
}

/// Payload for creating a new supplier (owner-only).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSupplierDto {
    pub company_name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub payment_terms: Option<String>,
    pub notes: Option<String>,
}

/// Payload for updating a supplier (owner-only).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSupplierDto {
    pub company_name: Option<String>,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub payment_terms: Option<String>,
    pub notes: Option<String>,
}
