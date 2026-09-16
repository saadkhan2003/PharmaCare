use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::{
    CreateMedicineDto, CsvImportResult, MedicineDto, MedicineListItem, MedicinePharmacistDto,
    PaginatedList, UpdateMedicineDto,
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
            let opening_code = format!("OPEN-{}", id);
            let batch_id = batch_repo::insert(db, id, None, None, dto.purchase_price, qty, qty, expiry, Some(&opening_code))?;
            stock_ledger_service::record_movement(
                db,
                "purchase",
                id,
                Some(batch_id),
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

/// Imports medicines from a CSV string. Returns import summary.
pub fn import_medicines_csv(
    db: &Connection,
    csv_data: &str,
    user_id: i64,
) -> Result<CsvImportResult, CommandError> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(csv_data.as_bytes());

    let raw_headers = match rdr.headers() {
        Ok(h) => h.clone(),
        Err(e) => return Err(CommandError::validation(&format!("Invalid CSV headers: {}", e))),
    };

    let headers: Vec<String> = raw_headers
        .iter()
        .map(|h| h.trim().replace(['_', ' ', '-'], "").to_lowercase())
        .collect();

    let find_col_idx = |aliases: &[&str]| -> Option<usize> {
        for alias in aliases {
            let norm = alias.replace(['_', ' ', '-'], "").to_lowercase();
            if let Some(pos) = headers.iter().position(|h| h == &norm) {
                return Some(pos);
            }
        }
        None
    };

    let name_idx = find_col_idx(&["name", "medicinename", "medicine", "drugname", "itemname", "item"]);
    if name_idx.is_none() {
        return Err(CommandError::validation(
            "Missing required column: 'name' or 'medicine_name'"
        ));
    }
    let name_col = name_idx.unwrap();

    let generic_col = find_col_idx(&["genericname", "generic", "formula"]);
    let brand_col = find_col_idx(&["brandname", "brand", "manufacturer", "company"]);
    let category_col = find_col_idx(&["category", "type"]);
    let unit_col = find_col_idx(&["unit", "dosageunit", "packaging", "pack"]);
    let purchase_price_col = find_col_idx(&["purchaseprice", "costprice", "buyprice", "cost", "buyingprice"]);
    let retail_price_col = find_col_idx(&["retailprice", "saleprice", "sellingprice", "price", "mrp"]);
    let reorder_col = find_col_idx(&["reorderlevel", "minstock", "minimumstock", "alertlevel"]);
    let shelf_col = find_col_idx(&["shelflocation", "shelf", "rack", "location"]);
    let notes_col = find_col_idx(&["notes", "note", "description"]);

    let get_field = |row: &csv::StringRecord, col_opt: Option<usize>| -> String {
        col_opt.and_then(|idx| row.get(idx)).unwrap_or("").trim().to_string()
    };

    let clean_numeric = |val: &str| -> Option<f64> {
        let filtered: String = val.chars().filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',').collect();
        let normalized = filtered.replace(',', ".");
        normalized.parse::<f64>().ok()
    };

    let normalize_category = |cat: &str| -> String {
        let lower = cat.trim().to_lowercase();
        match lower.as_str() {
            "tablet" | "tablets" | "tab" | "tabs" | "cap" | "capsule" | "capsules" => "Tablet".to_string(),
            "syrup" | "syrups" | "suspension" | "solution" | "liquid" | "drop" | "drops" => "Syrup".to_string(),
            "injection" | "injections" | "inj" | "infusion" | "iv" => "Injection".to_string(),
            "otc" | "overthecounter" => "OTC".to_string(),
            "prescription" | "rx" => "Prescription".to_string(),
            _ => "Tablet".to_string(),
        }
    };

    let normalize_unit = |unit: &str| -> String {
        let lower = unit.trim().to_lowercase();
        match lower.as_str() {
            "strip" | "strips" => "Strip".to_string(),
            "bottle" | "bottles" => "Bottle".to_string(),
            "vial" | "vials" | "ampoule" | "ampoules" => "Vial".to_string(),
            "box" | "boxes" | "pack" | "packet" => "Box".to_string(),
            "sachet" | "sachets" => "Sachet".to_string(),
            _ => "Strip".to_string(),
        }
    };

    let mut imported: i64 = 0;
    let mut skipped: i64 = 0;
    let mut errors: Vec<String> = Vec::new();

    for result in rdr.records() {
        let row = match result {
            Ok(r) => r,
            Err(e) => {
                skipped += 1;
                errors.push(format!("Row parse error: {}", e));
                continue;
            }
        };

        // Skip completely empty lines
        if row.iter().all(|f| f.trim().is_empty()) {
            continue;
        }

        let name = row.get(name_col).unwrap_or("").trim().to_string();
        if name.is_empty() {
            continue;
        }

        // Check if medicine already exists in database
        if let Ok(Some(existing)) = medicine_repo::find_by_name(db, &name) {
            skipped += 1;
            errors.push(format!("Skipped '{}': already exists in catalog (ID #{})", name, existing.id));
            continue;
        }

        let raw_category = get_field(&row, category_col);
        let category = if raw_category.is_empty() { "Tablet".to_string() } else { normalize_category(&raw_category) };

        let raw_unit = get_field(&row, unit_col);
        let unit = if raw_unit.is_empty() { "Strip".to_string() } else { normalize_unit(&raw_unit) };

        let raw_purchase = get_field(&row, purchase_price_col);
        let raw_retail = get_field(&row, retail_price_col);

        let mut purchase_price = clean_numeric(&raw_purchase).unwrap_or(0.0);
        let mut retail_price = clean_numeric(&raw_retail).unwrap_or(0.0);

        if retail_price <= 0.0 && purchase_price > 0.0 {
            retail_price = (purchase_price * 1.20).round();
        } else if purchase_price <= 0.0 && retail_price > 0.0 {
            purchase_price = (retail_price * 0.80).round();
        }

        if retail_price < purchase_price {
            retail_price = purchase_price;
        }

        let raw_reorder = get_field(&row, reorder_col);
        let reorder_level: Option<i64> = clean_numeric(&raw_reorder).map(|n| n as i64);

        let generic_name = get_field(&row, generic_col);
        let brand_name = get_field(&row, brand_col);
        let shelf_location = get_field(&row, shelf_col);
        let notes = get_field(&row, notes_col);

        let dto = CreateMedicineDto {
            name,
            generic_name: if generic_name.is_empty() { None } else { Some(generic_name) },
            brand_name: if brand_name.is_empty() { None } else { Some(brand_name) },
            category,
            unit,
            retail_price,
            purchase_price,
            reorder_level,
            shelf_location: if shelf_location.is_empty() { None } else { Some(shelf_location) },
            notes: if notes.is_empty() { None } else { Some(notes) },
            initial_stock: None,
            initial_expiry_date: None,
        };

        match create_medicine(db, &dto, user_id) {
            Ok(_) => imported += 1,
            Err(e) => {
                skipped += 1;
                errors.push(format!("Skipped '{}': {}", dto.name, e.message));
            }
        }
    }

    Ok(CsvImportResult {
        imported,
        skipped,
        errors,
    })
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

/// Hard deletes a medicine if it has no related records.
pub fn delete_medicine(db: &Connection, id: i64) -> Result<(), CommandError> {
    let _existing = medicine_repo::find_by_id(db, id)?
        .ok_or_else(|| CommandError::not_found("Medicine"))?;
    if medicine_repo::has_related_records(db, id)? {
        return Err(CommandError::validation(
            "Cannot delete: this medicine has stock batches. Deactivate it instead.",
        ));
    }
    medicine_repo::hard_delete(db, id)?;
    Ok(())
}

pub fn list_medicines(db: &Connection, page: i64, per_page: i64) -> Result<PaginatedList<MedicineListItem>, CommandError> {
    let offset = (page - 1) * per_page;
    let (medicines, total) = medicine_repo::find_all(db, offset, per_page)?;
    let mut items = Vec::new();
    for m in medicines {
        let current_stock = batch_repo::get_current_stock(db, m.id)?;
        items.push(MedicineListItem {
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
    Ok(PaginatedList::new(items, total, page, per_page))
}

pub fn search_medicines(db: &Connection, query: &str, page: i64, per_page: i64) -> Result<PaginatedList<MedicineListItem>, CommandError> {
    let pattern = format!("%{}%", query);
    let offset = (page - 1) * per_page;
    let (medicines, total) = medicine_repo::search(db, &pattern, offset, per_page)?;
    let mut items = Vec::new();
    for m in medicines {
        let current_stock = batch_repo::get_current_stock(db, m.id)?;
        items.push(MedicineListItem {
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
    Ok(PaginatedList::new(items, total, page, per_page))
}

pub fn search_medicines_pharmacist(
    db: &Connection,
    query: &str,
    page: i64,
    per_page: i64,
) -> Result<PaginatedList<MedicinePharmacistDto>, CommandError> {
    let pattern = format!("%{}%", query);
    let offset = (page - 1) * per_page;
    let (medicines, total) = medicine_repo::search(db, &pattern, offset, per_page)?;
    let mut items = Vec::new();
    for m in medicines {
        let current_stock = batch_repo::get_current_stock(db, m.id)?;
        let mut dto = MedicinePharmacistDto::from(m);
        dto.current_stock = current_stock;
        items.push(dto);
    }
    Ok(PaginatedList::new(items, total, page, per_page))
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers;

    #[test]
    fn test_create_medicine_validation() {
        let db = test_helpers::setup_test_db();
        let dto = CreateMedicineDto {
            name: "Test Med".into(),
            generic_name: None,
            brand_name: None,
            category: "Tablet".into(),
            unit: "Strip".into(),
            retail_price: 5.0,
            purchase_price: 10.0,
            reorder_level: None,
            shelf_location: None,
            notes: None,
            initial_stock: None,
            initial_expiry_date: None,
        };
        let result = create_medicine(&db, &dto, 1);
        assert!(result.is_err());
    }

    #[test]
    fn test_create_medicine_with_initial_stock() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Panadol".into(),
            generic_name: None,
            brand_name: None,
            category: "Tablet".into(),
            unit: "Strip".into(),
            retail_price: 10.0,
            purchase_price: 5.0,
            reorder_level: Some(10),
            shelf_location: None,
            notes: None,
            initial_stock: Some(100),
            initial_expiry_date: Some("2027-12-31".into()),
        };
        let result = create_medicine(&db, &dto, uid).unwrap();
        assert_eq!(result.name, "Panadol");
        assert_eq!(result.current_stock, 100);
    }

    #[test]
    fn test_list_medicines() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Test Med".into(), generic_name: None, brand_name: None,
            category: "Tablet".into(), unit: "Strip".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: Some(10), shelf_location: None, notes: None,
            initial_stock: None, initial_expiry_date: None,
        };
        create_medicine(&db, &dto, uid).unwrap();
        let result = list_medicines(&db, 1, 50).unwrap();
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].name, "Test Med");
        assert_eq!(result.total, 1);
    }

    #[test]
    fn test_pharmacist_dto_hides_purchase_price() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Panadol".into(), generic_name: None, brand_name: None,
            category: "Tablet".into(), unit: "Strip".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: Some(10), shelf_location: None, notes: None,
            initial_stock: None, initial_expiry_date: None,
        };
        create_medicine(&db, &dto, uid).unwrap();
        let results = search_medicines_pharmacist(&db, "Panadol", 1, 50).unwrap();
        assert_eq!(results.items.len(), 1);
        assert_eq!(results.items[0].name, "Panadol");
    }

    #[test]
    fn test_create_medicine_invalid_category() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Bad Med".into(), generic_name: None, brand_name: None,
            category: "InvalidCat".into(), unit: "Strip".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: None, shelf_location: None, notes: None,
            initial_stock: None, initial_expiry_date: None,
        };
        assert!(create_medicine(&db, &dto, uid).is_err());
    }

    #[test]
    fn test_create_medicine_invalid_unit() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Bad Med".into(), generic_name: None, brand_name: None,
            category: "Tablet".into(), unit: "InvalidUnit".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: None, shelf_location: None, notes: None,
            initial_stock: None, initial_expiry_date: None,
        };
        assert!(create_medicine(&db, &dto, uid).is_err());
    }

    fn default_update_dto() -> UpdateMedicineDto {
        UpdateMedicineDto {
            name: None, generic_name: None, brand_name: None,
            category: None, unit: None, retail_price: None,
            purchase_price: None, reorder_level: None,
            shelf_location: None, notes: None,
        }
    }

    #[test]
    fn test_update_medicine() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Panadol".into(), generic_name: None, brand_name: None,
            category: "Tablet".into(), unit: "Strip".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: Some(10), shelf_location: None, notes: None,
            initial_stock: None, initial_expiry_date: None,
        };
        let med = create_medicine(&db, &dto, uid).unwrap();

        let mut update = default_update_dto();
        update.name = Some("Panadol Extra".into());
        update.retail_price = Some(15.0);
        let updated = update_medicine(&db, med.id, &update).unwrap();
        assert_eq!(updated.name, "Panadol Extra");
        assert!((updated.retail_price - 15.0).abs() < 0.01);
    }

    #[test]
    fn test_update_medicine_not_found() {
        let db = test_helpers::setup_test_db();
        let update = default_update_dto();
        assert!(update_medicine(&db, 999, &update).is_err());
    }

    #[test]
    fn test_update_medicine_price_validation() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Panadol".into(), generic_name: None, brand_name: None,
            category: "Tablet".into(), unit: "Strip".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: Some(10), shelf_location: None, notes: None,
            initial_stock: None, initial_expiry_date: None,
        };
        let med = create_medicine(&db, &dto, uid).unwrap();

        let mut update = default_update_dto();
        update.retail_price = Some(2.0);
        // retail_price 2.0 < purchase_price 5.0 => error
        assert!(update_medicine(&db, med.id, &update).is_err());
    }

    #[test]
    fn test_deactivate_medicine() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Panadol".into(), generic_name: None, brand_name: None,
            category: "Tablet".into(), unit: "Strip".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: Some(10), shelf_location: None, notes: None,
            initial_stock: None, initial_expiry_date: None,
        };
        let med = create_medicine(&db, &dto, uid).unwrap();
        deactivate_medicine(&db, med.id).unwrap();

        // find_by_id returns the row but is_active should be false
        let fetched = get_medicine_by_id(&db, med.id).unwrap();
        assert!(!fetched.is_active);
    }

    #[test]
    fn test_deactivate_medicine_not_found() {
        let db = test_helpers::setup_test_db();
        assert!(deactivate_medicine(&db, 999).is_err());
    }

    #[test]
    fn test_search_medicines() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Panadol".into(), generic_name: Some("Paracetamol".into()), brand_name: None,
            category: "Tablet".into(), unit: "Strip".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: Some(10), shelf_location: None, notes: None,
            initial_stock: None, initial_expiry_date: None,
        };
        create_medicine(&db, &dto, uid).unwrap();

        let results = search_medicines(&db, "Para", 1, 50).unwrap();
        assert_eq!(results.items.len(), 1);
        assert_eq!(results.items[0].name, "Panadol");

        let results = search_medicines(&db, "Ibuprofen", 1, 50).unwrap();
        assert_eq!(results.items.len(), 0);
    }

    #[test]
    fn test_search_medicines_excludes_inactive() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Panadol".into(), generic_name: None, brand_name: None,
            category: "Tablet".into(), unit: "Strip".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: Some(10), shelf_location: None, notes: None,
            initial_stock: None, initial_expiry_date: None,
        };
        let med = create_medicine(&db, &dto, uid).unwrap();
        deactivate_medicine(&db, med.id).unwrap();

        let results = search_medicines(&db, "Panadol", 1, 50).unwrap();
        assert_eq!(results.items.len(), 0);
    }

    #[test]
    fn test_delete_medicine_no_records() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Delete Me".into(), generic_name: None, brand_name: None,
            category: "Tablet".into(), unit: "Strip".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: Some(10), shelf_location: None, notes: None,
            initial_stock: None, initial_expiry_date: None,
        };
        let med = create_medicine(&db, &dto, uid).unwrap();
        delete_medicine(&db, med.id).unwrap();

        let result = get_medicine_by_id(&db, med.id);
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_medicine_with_records_fails() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Has Stock".into(), generic_name: None, brand_name: None,
            category: "Tablet".into(), unit: "Strip".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: Some(10), shelf_location: None, notes: None,
            initial_stock: Some(50), initial_expiry_date: None,
        };
        let med = create_medicine(&db, &dto, uid).unwrap();
        // Has a batch from initial_stock => should fail
        assert!(delete_medicine(&db, med.id).is_err());
    }

    #[test]
    fn test_get_medicine_by_id() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let dto = CreateMedicineDto {
            name: "Panadol".into(), generic_name: Some("Paracetamol".into()), brand_name: None,
            category: "Tablet".into(), unit: "Strip".into(),
            retail_price: 10.0, purchase_price: 5.0,
            reorder_level: Some(10), shelf_location: Some("A1".into()), notes: None,
            initial_stock: Some(100), initial_expiry_date: Some("2027-12-31".into()),
        };
        let med = create_medicine(&db, &dto, uid).unwrap();

        let fetched = get_medicine_by_id(&db, med.id).unwrap();
        assert_eq!(fetched.name, "Panadol");
        assert_eq!(fetched.current_stock, 100);
        assert_eq!(fetched.shelf_location.as_deref(), Some("A1"));
    }
}
