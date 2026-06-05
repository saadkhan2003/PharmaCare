use rusqlite::Connection;

/// Inserts an append-only stock movement record.
///
/// `conn` can be either a `&Connection` or `&Transaction` (both implement
/// the same methods needed via Deref).
pub fn insert_movement(
    conn: &Connection,
    movement_type: &str,
    medicine_id: i64,
    batch_id: Option<i64>,
    quantity_delta: i64,
    reference_type: &str,
    reference_id: Option<i64>,
    reason: Option<&str>,
    user_id: i64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO stock_movements (movement_type, medicine_id, batch_id, quantity_delta, reference_type, reference_id, reason, user_id) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            movement_type,
            medicine_id,
            batch_id,
            quantity_delta,
            reference_type,
            reference_id,
            reason,
            user_id,
        ],
    )?;
    Ok(())
}
