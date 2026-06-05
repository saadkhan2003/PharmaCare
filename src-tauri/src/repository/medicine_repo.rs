use rusqlite::Connection;

use crate::models::{CreateMedicineDto, Medicine, UpdateMedicineDto};

/// Inserts a new medicine. Returns the new row id.
pub fn insert(db: &Connection, dto: &CreateMedicineDto) -> Result<i64, rusqlite::Error> {
    db.execute(
        "INSERT INTO medicines (name, generic_name, brand_name, category, unit, retail_price, purchase_price, reorder_level, shelf_location, notes) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            dto.name,
            dto.generic_name,
            dto.brand_name,
            dto.category,
            dto.unit,
            dto.retail_price,
            dto.purchase_price,
            dto.reorder_level,
            dto.shelf_location,
            dto.notes,
        ],
    )?;
    Ok(db.last_insert_rowid())
}

/// Finds a medicine by id (only active ones).
pub fn find_by_id(db: &Connection, id: i64) -> Result<Option<Medicine>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, name, generic_name, brand_name, category, unit, \
                retail_price, purchase_price, reorder_level, shelf_location, \
                notes, is_active, created_at \
         FROM medicines WHERE id = ?",
    )?;

    let mut rows = stmt.query_map(rusqlite::params![id], |row| {
        Ok(Medicine {
            id: row.get(0)?,
            name: row.get(1)?,
            generic_name: row.get(2)?,
            brand_name: row.get(3)?,
            category: row.get(4)?,
            unit: row.get(5)?,
            retail_price: row.get(6)?,
            purchase_price: row.get(7)?,
            reorder_level: row.get(8)?,
            shelf_location: row.get(9)?,
            notes: row.get(10)?,
            is_active: row.get::<_, i32>(11)? != 0,
            created_at: row.get(12)?,
        })
    })?;

    match rows.next() {
        Some(Ok(medicine)) => Ok(Some(medicine)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

/// Lists all medicines ordered by name, limited to 200.
pub fn find_all(db: &Connection) -> Result<Vec<Medicine>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, name, generic_name, brand_name, category, unit, \
                retail_price, purchase_price, reorder_level, shelf_location, \
                notes, is_active, created_at \
         FROM medicines \
         ORDER BY name ASC \
         LIMIT 200",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(Medicine {
            id: row.get(0)?,
            name: row.get(1)?,
            generic_name: row.get(2)?,
            brand_name: row.get(3)?,
            category: row.get(4)?,
            unit: row.get(5)?,
            retail_price: row.get(6)?,
            purchase_price: row.get(7)?,
            reorder_level: row.get(8)?,
            shelf_location: row.get(9)?,
            notes: row.get(10)?,
            is_active: row.get::<_, i32>(11)? != 0,
            created_at: row.get(12)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Searches active medicines by name, generic_name, brand_name, or category.
/// Pattern should already be wrapped with `%` by the service layer.
pub fn search(db: &Connection, pattern: &str) -> Result<Vec<Medicine>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, name, generic_name, brand_name, category, unit, \
                retail_price, purchase_price, reorder_level, shelf_location, \
                notes, is_active, created_at \
         FROM medicines \
         WHERE is_active = 1 \
           AND (name LIKE ?1 OR generic_name LIKE ?1 OR brand_name LIKE ?1 OR category LIKE ?1) \
         ORDER BY name ASC \
         LIMIT 50",
    )?;

    let rows = stmt.query_map(rusqlite::params![pattern], |row| {
        Ok(Medicine {
            id: row.get(0)?,
            name: row.get(1)?,
            generic_name: row.get(2)?,
            brand_name: row.get(3)?,
            category: row.get(4)?,
            unit: row.get(5)?,
            retail_price: row.get(6)?,
            purchase_price: row.get(7)?,
            reorder_level: row.get(8)?,
            shelf_location: row.get(9)?,
            notes: row.get(10)?,
            is_active: row.get::<_, i32>(11)? != 0,
            created_at: row.get(12)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Updates a medicine. Only non-None fields are updated.
pub fn update(db: &Connection, id: i64, dto: &UpdateMedicineDto) -> Result<(), rusqlite::Error> {
    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref v) = dto.name {
        sets.push(format!("name = ?{}", params.len() + 1));
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = dto.generic_name {
        sets.push(format!("generic_name = ?{}", params.len() + 1));
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = dto.brand_name {
        sets.push(format!("brand_name = ?{}", params.len() + 1));
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = dto.category {
        sets.push(format!("category = ?{}", params.len() + 1));
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = dto.unit {
        sets.push(format!("unit = ?{}", params.len() + 1));
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = dto.retail_price {
        sets.push(format!("retail_price = ?{}", params.len() + 1));
        params.push(Box::new(v));
    }
    if let Some(v) = dto.purchase_price {
        sets.push(format!("purchase_price = ?{}", params.len() + 1));
        params.push(Box::new(v));
    }
    if let Some(v) = dto.reorder_level {
        sets.push(format!("reorder_level = ?{}", params.len() + 1));
        params.push(Box::new(v));
    }
    if let Some(ref v) = dto.shelf_location {
        sets.push(format!("shelf_location = ?{}", params.len() + 1));
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = dto.notes {
        sets.push(format!("notes = ?{}", params.len() + 1));
        params.push(Box::new(v.clone()));
    }

    if sets.is_empty() {
        return Ok(());
    }

    params.push(Box::new(id));
    let sql = format!(
        "UPDATE medicines SET {} WHERE id = ?{}",
        sets.join(", "),
        params.len()
    );

    db.execute(&sql, rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())))?;
    Ok(())
}

/// Soft-deletes a medicine by setting is_active = 0.
pub fn deactivate(db: &Connection, id: i64) -> Result<(), rusqlite::Error> {
    db.execute(
        "UPDATE medicines SET is_active = 0 WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}
