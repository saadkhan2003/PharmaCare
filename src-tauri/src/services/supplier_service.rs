use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::{CreateSupplierDto, SupplierDto, UpdateSupplierDto};
use crate::repository::supplier_repo;

/// Creates a new supplier. Validates company_name is not empty.
pub fn create_supplier(
    db: &Connection,
    dto: &CreateSupplierDto,
) -> Result<SupplierDto, CommandError> {
    if dto.company_name.trim().is_empty() {
        return Err(CommandError::validation("Company name is required"));
    }

    let id = supplier_repo::insert(db, dto)?;
    let supplier = supplier_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::internal("Supplier created but not found"))?;
    Ok(SupplierDto::from(supplier))
}

/// Updates an existing supplier.
pub fn update_supplier(
    db: &Connection,
    id: i64,
    dto: &UpdateSupplierDto,
) -> Result<SupplierDto, CommandError> {
    let _existing = supplier_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::not_found("Supplier"))?;

    supplier_repo::update(db, id, dto)?;

    let updated = supplier_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::not_found("Supplier"))?;
    Ok(SupplierDto::from(updated))
}

/// Deactivates a supplier (soft delete).
pub fn deactivate_supplier(db: &Connection, id: i64) -> Result<(), CommandError> {
    let _existing = supplier_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::not_found("Supplier"))?;
    supplier_repo::deactivate(db, id)?;
    Ok(())
}

/// Lists all suppliers.
pub fn list_suppliers(db: &Connection) -> Result<Vec<SupplierDto>, CommandError> {
    let suppliers = supplier_repo::find_all(db)?;
    Ok(suppliers.into_iter().map(SupplierDto::from).collect())
}

/// Searches suppliers by name or phone.
pub fn search_suppliers(db: &Connection, query: &str) -> Result<Vec<SupplierDto>, CommandError> {
    let pattern = format!("%{}%", query);
    let suppliers = supplier_repo::search(db, &pattern)?;
    Ok(suppliers.into_iter().map(SupplierDto::from).collect())
}
