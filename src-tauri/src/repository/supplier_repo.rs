use rusqlite::Connection;

use crate::models::{CreateSupplierDto, Supplier, UpdateSupplierDto};

/// Inserts a new supplier. Returns the new row id.
pub fn insert(db: &Connection, dto: &CreateSupplierDto) -> Result<i64, rusqlite::Error> {
    db.execute(
        "INSERT INTO suppliers (company_name, contact_person, phone, address, payment_terms, notes) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            dto.company_name,
            dto.contact_person,
            dto.phone,
            dto.address,
            dto.payment_terms,
            dto.notes,
        ],
    )?;
    Ok(db.last_insert_rowid())
}

/// Finds a supplier by id.
pub fn find_by_id(db: &Connection, id: i64) -> Result<Option<Supplier>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, company_name, contact_person, phone, address, payment_terms, notes, is_active, created_at \
         FROM suppliers WHERE id = ?",
    )?;

    let mut rows = stmt.query_map(rusqlite::params![id], |row| {
        Ok(Supplier {
            id: row.get(0)?,
            company_name: row.get(1)?,
            contact_person: row.get(2)?,
            phone: row.get(3)?,
            address: row.get(4)?,
            payment_terms: row.get(5)?,
            notes: row.get(6)?,
            is_active: row.get::<_, i32>(7)? != 0,
            created_at: row.get(8)?,
        })
    })?;

    match rows.next() {
        Some(Ok(supplier)) => Ok(Some(supplier)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

/// Lists all suppliers ordered by company name, limited to 100.
pub fn find_all(db: &Connection) -> Result<Vec<Supplier>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, company_name, contact_person, phone, address, payment_terms, notes, is_active, created_at \
         FROM suppliers \
         ORDER BY company_name ASC \
         LIMIT 100",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(Supplier {
            id: row.get(0)?,
            company_name: row.get(1)?,
            contact_person: row.get(2)?,
            phone: row.get(3)?,
            address: row.get(4)?,
            payment_terms: row.get(5)?,
            notes: row.get(6)?,
            is_active: row.get::<_, i32>(7)? != 0,
            created_at: row.get(8)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Searches active suppliers by company_name or phone.
pub fn search(db: &Connection, pattern: &str) -> Result<Vec<Supplier>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, company_name, contact_person, phone, address, payment_terms, notes, is_active, created_at \
         FROM suppliers \
         WHERE is_active = 1 \
           AND (company_name LIKE ?1 OR phone LIKE ?1) \
         ORDER BY company_name ASC \
         LIMIT 50",
    )?;

    let rows = stmt.query_map(rusqlite::params![pattern], |row| {
        Ok(Supplier {
            id: row.get(0)?,
            company_name: row.get(1)?,
            contact_person: row.get(2)?,
            phone: row.get(3)?,
            address: row.get(4)?,
            payment_terms: row.get(5)?,
            notes: row.get(6)?,
            is_active: row.get::<_, i32>(7)? != 0,
            created_at: row.get(8)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Updates a supplier. Only non-None fields are updated.
pub fn update(db: &Connection, id: i64, dto: &UpdateSupplierDto) -> Result<(), rusqlite::Error> {
    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref v) = dto.company_name {
        sets.push(format!("company_name = ?{}", params.len() + 1));
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = dto.contact_person {
        sets.push(format!("contact_person = ?{}", params.len() + 1));
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = dto.phone {
        sets.push(format!("phone = ?{}", params.len() + 1));
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = dto.address {
        sets.push(format!("address = ?{}", params.len() + 1));
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = dto.payment_terms {
        sets.push(format!("payment_terms = ?{}", params.len() + 1));
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
        "UPDATE suppliers SET {} WHERE id = ?{}",
        sets.join(", "),
        params.len()
    );

    db.execute(&sql, rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())))?;
    Ok(())
}

/// Soft-deletes a supplier by setting is_active = 0.
pub fn deactivate(db: &Connection, id: i64) -> Result<(), rusqlite::Error> {
    db.execute(
        "UPDATE suppliers SET is_active = 0 WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

/// Checks if a supplier has any purchase records.
pub fn has_related_records(db: &Connection, id: i64) -> Result<bool, rusqlite::Error> {
    let mut stmt = db.prepare("SELECT COUNT(*) FROM purchases WHERE supplier_id = ?1")?;
    let count: i64 = stmt.query_row(rusqlite::params![id], |row| row.get(0))?;
    Ok(count > 0)
}

/// Hard deletes a supplier only if it has no related records.
pub fn hard_delete(db: &Connection, id: i64) -> Result<(), rusqlite::Error> {
    db.execute("DELETE FROM suppliers WHERE id = ?1", rusqlite::params![id])?;
    Ok(())
}
