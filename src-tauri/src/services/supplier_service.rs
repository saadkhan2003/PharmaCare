use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::{CreateSupplierDto, SupplierDto, UpdateSupplierDto};
use crate::repository::supplier_repo;
fn get_supplier_debt(db: &Connection, supplier_id: i64) -> f64 {
    db.query_row(
        "SELECT COALESCE(SUM(total_amount - paid_amount), 0.0) FROM supplier_debts WHERE supplier_id = ?1 AND status != 'Paid'",
        rusqlite::params![supplier_id],
        |r| r.get(0),
    ).unwrap_or(0.0)
}


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
    let mut dto = SupplierDto::from(supplier);
    dto.outstanding_debt = get_supplier_debt(db, id);
    Ok(dto)
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
    let mut dto = SupplierDto::from(updated);
    dto.outstanding_debt = get_supplier_debt(db, id);
    Ok(dto)
}

/// Deactivates a supplier (soft delete).
pub fn deactivate_supplier(db: &Connection, id: i64) -> Result<(), CommandError> {
    let _existing = supplier_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::not_found("Supplier"))?;
    supplier_repo::deactivate(db, id)?;
    Ok(())
}

/// Hard deletes a supplier if it has no purchase records.
pub fn delete_supplier(db: &Connection, id: i64) -> Result<(), CommandError> {
    let _existing = supplier_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::not_found("Supplier"))?;
    if supplier_repo::has_related_records(db, id)? {
        return Err(CommandError::validation(
            "Cannot delete: this supplier has purchase records. Deactivate it instead.",
        ));
    }
    supplier_repo::hard_delete(db, id)?;
    Ok(())
}

/// Lists all suppliers with live outstanding debt.
pub fn list_suppliers(db: &Connection) -> Result<Vec<SupplierDto>, CommandError> {
    let suppliers = supplier_repo::find_all(db)?;
    let mut dtos = Vec::new();
    for s in suppliers {
        let debt = get_supplier_debt(db, s.id);
        let mut dto = SupplierDto::from(s);
        dto.outstanding_debt = debt;
        dtos.push(dto);
    }
    Ok(dtos)
}

/// Searches suppliers by name or phone with live outstanding debt.
pub fn search_suppliers(db: &Connection, query: &str) -> Result<Vec<SupplierDto>, CommandError> {
    let pattern = format!("%{}%", query);
    let suppliers = supplier_repo::search(db, &pattern)?;
    let mut dtos = Vec::new();
    for s in suppliers {
        let debt = get_supplier_debt(db, s.id);
        let mut dto = SupplierDto::from(s);
        dto.outstanding_debt = debt;
        dtos.push(dto);
    }
    Ok(dtos)
}
