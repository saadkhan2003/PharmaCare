use serde::{Deserialize, Serialize};

/// Full medicine record from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Medicine {
    pub id: i64,
    pub name: String,
    pub generic_name: Option<String>,
    pub brand_name: Option<String>,
    pub category: String,
    pub unit: String,
    pub retail_price: f64,
    pub purchase_price: f64,
    pub reorder_level: i64,
    pub shelf_location: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

/// Full view — for Owner role only. Includes purchase_price.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicineDto {
    pub id: i64,
    pub name: String,
    pub generic_name: Option<String>,
    pub brand_name: Option<String>,
    pub category: String,
    pub unit: String,
    pub retail_price: f64,
    pub purchase_price: f64,
    pub current_stock: i64,
    pub reorder_level: i64,
    pub shelf_location: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
}

impl From<Medicine> for MedicineDto {
    fn from(m: Medicine) -> Self {
        MedicineDto {
            id: m.id,
            name: m.name,
            generic_name: m.generic_name,
            brand_name: m.brand_name,
            category: m.category,
            unit: m.unit,
            retail_price: m.retail_price,
            purchase_price: m.purchase_price,
            current_stock: 0,
            reorder_level: m.reorder_level,
            shelf_location: m.shelf_location,
            notes: m.notes,
            is_active: m.is_active,
        }
    }
}

/// Pharmacist-safe view — purchase_price REMOVED by design (D-15).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicinePharmacistDto {
    pub id: i64,
    pub name: String,
    pub generic_name: Option<String>,
    pub brand_name: Option<String>,
    pub category: String,
    pub unit: String,
    pub retail_price: f64,
    pub current_stock: i64,
    pub reorder_level: i64,
    pub shelf_location: Option<String>,
    pub is_active: bool,
}

impl From<Medicine> for MedicinePharmacistDto {
    fn from(m: Medicine) -> Self {
        MedicinePharmacistDto {
            id: m.id,
            name: m.name,
            generic_name: m.generic_name,
            brand_name: m.brand_name,
            category: m.category,
            unit: m.unit,
            retail_price: m.retail_price,
            current_stock: 0,
            reorder_level: m.reorder_level,
            shelf_location: m.shelf_location,
            is_active: m.is_active,
        }
    }
}

/// Medicine list item with computed current_stock.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicineListItem {
    pub id: i64,
    pub name: String,
    pub generic_name: Option<String>,
    pub brand_name: Option<String>,
    pub category: String,
    pub unit: String,
    pub retail_price: f64,
    pub purchase_price: f64,
    pub current_stock: i64,
    pub reorder_level: i64,
    pub is_active: bool,
}

/// Result of a CSV import operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvImportResult {
    pub imported: i64,
    pub skipped: i64,
    pub errors: Vec<String>,
}

/// Payload for creating a new medicine (owner-only).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMedicineDto {
    pub name: String,
    pub generic_name: Option<String>,
    pub brand_name: Option<String>,
    pub category: String,
    pub unit: String,
    pub retail_price: f64,
    pub purchase_price: f64,
    pub reorder_level: Option<i64>,
    pub shelf_location: Option<String>,
    pub notes: Option<String>,
    /// Optional initial stock quantity for opening stock (creates a batch).
    #[serde(default)]
    pub initial_stock: Option<i64>,
    /// Optional expiry date for the initial stock batch (YYYY-MM-DD).
    #[serde(default)]
    pub initial_expiry_date: Option<String>,
}

/// Payload for updating a medicine (owner-only).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMedicineDto {
    pub name: Option<String>,
    pub generic_name: Option<String>,
    pub brand_name: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub retail_price: Option<f64>,
    pub purchase_price: Option<f64>,
    pub reorder_level: Option<i64>,
    pub shelf_location: Option<String>,
    pub notes: Option<String>,
}
