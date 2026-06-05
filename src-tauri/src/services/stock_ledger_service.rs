use rusqlite::Connection;

use crate::errors::CommandError;
use crate::repository::{batch_repo, stock_ledger_repo};

/// Records an append-only stock movement entry.
///
/// This is the single authority for stock mutation records (D-22).
/// No other service or repository should INSERT into stock_movements
/// except through this function.
///
/// `conn` can be either a `&Connection` or `&Transaction` (both implement
/// the same methods needed by the repo layer via Deref).
///
/// `quantity_delta` is positive for stock increases (purchases, returns)
/// and negative for decreases (sales, write-offs, supplier returns).
pub fn record_movement(
    conn: &Connection,
    movement_type: &str,
    medicine_id: i64,
    batch_id: Option<i64>,
    quantity_delta: i64,
    reference_type: &str,
    reference_id: Option<i64>,
    reason: Option<&str>,
    user_id: i64,
) -> Result<(), CommandError> {
    // Validate movement_type is known
    match movement_type {
        "purchase" | "sale" | "customer_return" | "supplier_return" | "write_off" | "adjustment" => {}
        _ => {
            return Err(CommandError::validation(&format!(
                "Unknown movement_type: {}",
                movement_type
            )))
        }
    }

    stock_ledger_repo::insert_movement(
        conn,
        movement_type,
        medicine_id,
        batch_id,
        quantity_delta,
        reference_type,
        reference_id,
        reason,
        user_id,
    )?;
    Ok(())
}

/// Computes current stock for a medicine: SUM of remaining_qty of non-expired batches.
/// D-23 formula: COALESCE(SUM(remaining_qty), 0) WHERE expiry_date > date('now')
pub fn get_current_stock(db: &Connection, medicine_id: i64) -> Result<i64, CommandError> {
    let stock = batch_repo::get_current_stock(db, medicine_id)?;
    Ok(stock)
}
