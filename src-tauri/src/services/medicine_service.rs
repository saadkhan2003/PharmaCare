use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::{
    CreateMedicineDto, MedicineDto, MedicineListItem, MedicinePharmacistDto, UpdateMedicineDto,
};
use crate::repository::{batch_repo, medicine_repo};
use crate::services::stock_ledger_service;

/// Valid categories for defense-in-depth (D-13 also has CHECK constraint).
const VALID_CATEGORIES: &[&str] = &["Tablet", "Syrup", "Injection", "OTC", "Prescription"];
/// Valid units for defense-in-depth (D-13 also has CHECK constraint).
const VALID_UNITS: &[&str] = &["Strip", "Bottle", "Vial", "Box", "Sachet"];

/// Creates a new medicine. Validates retail_price >= purchase_price (D-16).
pub fn create_medicine(
    db: &Connection,
    dto: &CreateMedicineDto,
    user_id: i64,
) -> Result<MedicineDto, CommandError> {
    // Validate retail_price >= purchase_price using integer-cent comparison (D-16)
    let retail_cents = (dto.retail_price * 100.0).round() as i64;
    let purchase_cents = (dto.purchase_price * 100.0).round() as i64;
    if retail_cents < purchase_cents {
        return Err(CommandError::validation(
            "Retail price must be greater than or equal to purchase price",
        ));
    }

    // Validate category (defense-in-depth)
    if !VALID_CATEGORIES.contains(&dto.category.as_str()) {
        return Err(CommandError::validation(&format!(
            "Invalid category: {}. Must be one of: Tablet, Syrup, Injection, OTC, Prescription",
            dto.category
        )));
    }

    // Validate unit (defense-in-depth)
    if !VALID_UNITS.contains(&dto.unit.as_str()) {
        return Err(CommandError::validation(&format!(
            "Invalid unit: {}. Must be one of: Strip, Bottle, Vial, Box, Sachet",
            dto.unit
        )));
    }

    let id = medicine_repo::insert(db, dto)?;

    // If initial_stock provided, create an opening batch and record stock movement
    if let Some(qty) = dto.initial_stock {
        if qty > 0 {
            let expiry = dto.initial_expiry_date.as_deref().unwrap_or("2099-12-31");
            batch_repo::insert(db, id, None, None, dto.purchase_price, qty, qty, expiry)?;
            stock_ledger_service::record_movement(
                db,
                "purchase",
                id,
                None,
                qty,
                "medicine_creation",
                None,
                Some(&format!("Opening stock for {}", dto.name)),
                user_id,
            )?;
        }
    }

    let medicine = medicine_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::internal("Medicine created but not found"))?;

    let mut dto = MedicineDto::from(medicine);
    dto.current_stock = batch_repo::get_current_stock(db, id)?;
    Ok(dto)
}

/// Updates an existing medicine. Validates retail_price >= purchase_price if both provided.
pub fn update_medicine(
    db: &Connection,
    id: i64,
    dto: &UpdateMedicineDto,
) -> Result<MedicineDto, CommandError> {
    // Verify medicine exists
    let existing = medicine_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::not_found("Medicine"))?;

    // If both prices provided, validate retail >= purchase
    let retail = dto.retail_price.unwrap_or(existing.retail_price);
    let purchase = dto.purchase_price.unwrap_or(existing.purchase_price);
    let retail_cents = (retail * 100.0).round() as i64;
    let purchase_cents = (purchase * 100.0).round() as i64;
    if retail_cents < purchase_cents {
        return Err(CommandError::validation(
            "Retail price must be greater than or equal to purchase price",
        ));
    }

    medicine_repo::update(db, id, dto)?;

    let updated = medicine_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::not_found("Medicine"))?;

    let current_stock = batch_repo::get_current_stock(db, id)?;
    let mut result = MedicineDto::from(updated);
    result.current_stock = current_stock;
    Ok(result)
}

/// Deactivates a medicine (soft delete).
pub fn deactivate_medicine(db: &Connection, id: i64) -> Result<(), CommandError> {
    let _existing = medicine_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::not_found("Medicine"))?;
    medicine_repo::deactivate(db, id)?;
    Ok(())
}

/// Lists all medicines enriched with current stock.
pub fn list_medicines(db: &Connection) -> Result<Vec<MedicineListItem>, CommandError> {
    let medicines = medicine_repo::find_all(db)?;
    let mut results = Vec::new();
    for m in medicines {
        let current_stock = batch_repo::get_current_stock(db, m.id)?;
        results.push(MedicineListItem {
            id: m.id,
            name: m.name,
            generic_name: m.generic_name,
            brand_name: m.brand_name,
            category: m.category,
            unit: m.unit,
            retail_price: m.retail_price,
            purchase_price: m.purchase_price,
            current_stock,
            reorder_level: m.reorder_level,
            is_active: m.is_active,
        });
    }
    Ok(results)
}

/// Searches medicines (owner — full DTO with purchase_price).
pub fn search_medicines(db: &Connection, query: &str) -> Result<Vec<MedicineListItem>, CommandError> {
    let pattern = format!("%{}%", query);
    let medicines = medicine_repo::search(db, &pattern)?;
    let mut results = Vec::new();
    for m in medicines {
        let current_stock = batch_repo::get_current_stock(db, m.id)?;
        results.push(MedicineListItem {
            id: m.id,
            name: m.name,
            generic_name: m.generic_name,
            brand_name: m.brand_name,
            category: m.category,
            unit: m.unit,
            retail_price: m.retail_price,
            purchase_price: m.purchase_price,
            current_stock,
            reorder_level: m.reorder_level,
            is_active: m.is_active,
        });
    }
    Ok(results)
}

/// Searches medicines for pharmacist — returns DTO WITHOUT purchase_price (D-15).
/// Enforced at SERVICE layer, not just UI.
pub fn search_medicines_pharmacist(
    db: &Connection,
    query: &str,
) -> Result<Vec<MedicinePharmacistDto>, CommandError> {
    let pattern = format!("%{}%", query);
    let medicines = medicine_repo::search(db, &pattern)?;
    let mut results = Vec::new();
    for m in medicines {
        let current_stock = batch_repo::get_current_stock(db, m.id)?;
        let mut dto = MedicinePharmacistDto::from(m);
        dto.current_stock = current_stock;
        results.push(dto);
    }
    Ok(results)
}

/// Gets a single medicine by id, enriched with current stock.
pub fn get_medicine_by_id(db: &Connection, id: i64) -> Result<MedicineDto, CommandError> {
    let medicine = medicine_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::not_found("Medicine"))?;
    let current_stock = batch_repo::get_current_stock(db, id)?;
    let mut result = MedicineDto::from(medicine);
    result.current_stock = current_stock;
    Ok(result)
}
