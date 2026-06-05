use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::r#return::{
    CustomerReturnDto, PurchaseForReturnDto, PurchaseItemForReturnDto, ReturnReceiptDto,
    SaleForReturnDto, SaleItemForReturnDto, SupplierReturnDto, WriteOffDto,
};
use crate::repository::{batch_repo, medicine_repo, purchase_repo, returns_repo, sale_repo, supplier_repo};
use crate::services::stock_ledger_service;

/// Processes a customer return atomically.
///
/// PHASES:
/// 1. Validate ALL items BEFORE opening transaction (D-46: qty <= sold - prior returns)
/// 2. Open rusqlite::Transaction
/// 3. For each item: insert return record, restore stock if resellable, log loss if damaged/expired
/// 4. COMMIT — ALL or NOTHING
pub fn process_customer_return(
    db: &mut Connection,
    payload: &CustomerReturnDto,
    user_id: i64,
) -> Result<ReturnReceiptDto, CommandError> {
    // --- PHASE 1: Validate BEFORE transaction ---
    let _sale = sale_repo::find_by_id(db, payload.sale_id)?
        .ok_or_else(|| CommandError::not_found("Sale"))?;

    let sale_items = sale_repo::find_items_by_sale(db, payload.sale_id)?;

    if payload.items.is_empty() {
        return Err(CommandError::validation(
            "Customer return must have at least one item",
        ));
    }

    let mut total_refund = 0.0_f64;

    for (i, item) in payload.items.iter().enumerate() {
        if item.quantity <= 0 {
            return Err(CommandError::validation(&format!(
                "Item {}: quantity must be positive",
                i + 1
            )));
        }

        // Validate condition
        if !["resellable", "damaged", "expired"].contains(&item.condition.as_str()) {
            return Err(CommandError::validation(&format!(
                "Item {}: condition must be 'resellable', 'damaged', or 'expired'",
                i + 1
            )));
        }

        if item.refund_amount < 0.0 {
            return Err(CommandError::validation(&format!(
                "Item {}: refund amount cannot be negative",
                i + 1
            )));
        }

        // Find matching sale item
        let sale_item = sale_items.iter().find(|si| si.id == item.sale_item_id).ok_or_else(|| {
            CommandError::validation(&format!(
                "Item {}: sale item ID {} not found in sale",
                i + 1, item.sale_item_id
            ))
        })?;

        // Compute already returned quantity
        let prior_returns = returns_repo::find_by_sale_item(
            db,
            payload.sale_id,
            item.medicine_id,
            item.batch_id,
        )?;
        let already_returned: i64 = prior_returns.iter().map(|r| r.quantity).sum();

        // Validate D-46: qty <= sold - already returned
        let returnable = sale_item.quantity - already_returned;
        if item.quantity > returnable {
            return Err(CommandError::validation(&format!(
                "Item {}: return quantity {} exceeds returnable quantity {} (sold: {}, already returned: {})",
                i + 1, item.quantity, returnable, sale_item.quantity, already_returned
            )));
        }

        total_refund += item.refund_amount;
    }

    // --- PHASE 2: Open transaction ---
    let tx = db.transaction().map_err(|e| {
        CommandError::internal(&format!("Failed to start transaction: {}", e))
    })?;

    // --- PHASE 3: Insert returns + mutate stock ---
    let mut return_ids: Vec<i64> = Vec::new();

    for item in &payload.items {
        let return_id = returns_repo::insert(
            &tx,
            "customer",
            Some(payload.sale_id),
            item.medicine_id,
            Some(item.batch_id),
            item.quantity,
            item.reason.as_deref(),
            Some(&item.condition),
            item.refund_amount,
            user_id,
        )?;
        return_ids.push(return_id);

        if item.condition == "resellable" {
            // D-45: Restore stock to original batch
            batch_repo::increment_remaining_qty(&tx, item.batch_id, item.quantity)?;

            // Positive stock movement (stock increase)
            stock_ledger_service::record_movement(
                &tx,
                "customer_return",
                item.medicine_id,
                Some(item.batch_id),
                item.quantity, // positive delta: stock restored
                "sale",
                Some(payload.sale_id),
                Some("Resellable customer return"),
                user_id,
            )?;
        } else {
            // D-45: Damaged/expired — no stock restore, log loss with zero quantity delta
            stock_ledger_service::record_movement(
                &tx,
                "write_off",
                item.medicine_id,
                Some(item.batch_id),
                0, // zero delta: batch already deducted at sale time; this is a loss record
                "sale",
                Some(payload.sale_id),
                Some(&format!("{} customer return (loss)", item.condition)),
                user_id,
            )?;
        }
    }

    // --- PHASE 4: Commit ---
    tx.commit().map_err(|e| {
        CommandError::internal(&format!("Failed to commit customer return transaction: {}", e))
    })?;

    Ok(ReturnReceiptDto {
        return_ids,
        item_count: payload.items.len() as i64,
        total_refund,
    })
}

/// Processes a supplier return atomically.
///
/// PHASES:
/// 1. Validate purchase exists and each item qty <= batch.remaining_qty (D-51)
/// 2. Open transaction
/// 3. Insert return records, decrement batch, log negative stock movement
/// 4. Commit
pub fn process_supplier_return(
    db: &mut Connection,
    payload: &SupplierReturnDto,
    user_id: i64,
) -> Result<ReturnReceiptDto, CommandError> {
    // --- PHASE 1: Validate BEFORE transaction ---
    let _purchase = purchase_repo::find_by_id(db, payload.purchase_id)?
        .ok_or_else(|| CommandError::not_found("Purchase"))?;

    if payload.items.is_empty() {
        return Err(CommandError::validation(
            "Supplier return must have at least one item",
        ));
    }

    let mut total_credit = 0.0_f64;

    for (i, item) in payload.items.iter().enumerate() {
        if item.quantity <= 0 {
            return Err(CommandError::validation(&format!(
                "Item {}: quantity must be positive",
                i + 1
            )));
        }

        if item.credit_amount < 0.0 {
            return Err(CommandError::validation(&format!(
                "Item {}: credit amount cannot be negative",
                i + 1
            )));
        }

        // Load batch — must exist and have enough stock (D-51)
        let batches = batch_repo::find_by_medicine(db, item.medicine_id)?;
        let batch = batches.iter().find(|b| b.id == item.batch_id).ok_or_else(|| {
            CommandError::validation(&format!(
                "Item {}: batch ID {} not found for medicine ID {}",
                i + 1, item.batch_id, item.medicine_id
            ))
        })?;

        if item.quantity > batch.remaining_qty {
            return Err(CommandError::validation(&format!(
                "Item {}: return quantity {} exceeds batch remaining stock {}",
                i + 1, item.quantity, batch.remaining_qty
            )));
        }

        // Verify batch belongs to this purchase
        let batch_purchase_id = batch.purchase_id.unwrap_or(0);
        if batch_purchase_id != payload.purchase_id {
            return Err(CommandError::validation(&format!(
                "Item {}: batch ID {} does not belong to purchase ID {}",
                i + 1, item.batch_id, payload.purchase_id
            )));
        }

        total_credit += item.credit_amount;
    }

    // --- PHASE 2: Open transaction ---
    let tx = db.transaction().map_err(|e| {
        CommandError::internal(&format!("Failed to start transaction: {}", e))
    })?;

    // --- PHASE 3: Insert returns + mutate stock ---
    let mut return_ids: Vec<i64> = Vec::new();

    for item in &payload.items {
        let return_id = returns_repo::insert(
            &tx,
            "supplier",
            Some(payload.purchase_id),
            item.medicine_id,
            Some(item.batch_id),
            item.quantity,
            item.reason.as_deref(),
            None, // condition is NULL for supplier returns (D-52)
            item.credit_amount,
            user_id,
        )?;
        return_ids.push(return_id);

        // D-50: Deduct stock
        batch_repo::decrement_remaining_qty(&tx, item.batch_id, item.quantity)?;

        // Negative stock movement (stock decrease)
        stock_ledger_service::record_movement(
            &tx,
            "supplier_return",
            item.medicine_id,
            Some(item.batch_id),
            -(item.quantity), // negative delta: stock leaving
            "purchase",
            Some(payload.purchase_id),
            Some("Supplier return"),
            user_id,
        )?;
    }

    // --- PHASE 4: Commit ---
    tx.commit().map_err(|e| {
        CommandError::internal(&format!("Failed to commit supplier return transaction: {}", e))
    })?;

    Ok(ReturnReceiptDto {
        return_ids,
        item_count: payload.items.len() as i64,
        total_refund: total_credit,
    })
}

/// Processes a write-off atomically (expired/damaged stock not returned to supplier).
///
/// PHASES:
/// 1. Validate each item qty <= batch.remaining_qty, condition is expired/damaged
/// 2. Open transaction
/// 3. Insert return records, decrement batch, log negative stock movement
/// 4. Commit
pub fn process_write_off(
    db: &mut Connection,
    payload: &WriteOffDto,
    user_id: i64,
) -> Result<ReturnReceiptDto, CommandError> {
    // --- PHASE 1: Validate BEFORE transaction ---
    if payload.items.is_empty() {
        return Err(CommandError::validation(
            "Write-off must have at least one item",
        ));
    }

    for (i, item) in payload.items.iter().enumerate() {
        if item.quantity <= 0 {
            return Err(CommandError::validation(&format!(
                "Item {}: quantity must be positive",
                i + 1
            )));
        }

        if !["expired", "damaged"].contains(&item.condition.as_str()) {
            return Err(CommandError::validation(&format!(
                "Item {}: condition must be 'expired' or 'damaged'",
                i + 1
            )));
        }

        // Load batch and validate stock
        let batches = batch_repo::find_by_medicine(db, item.medicine_id)?;
        let batch = batches.iter().find(|b| b.id == item.batch_id).ok_or_else(|| {
            CommandError::validation(&format!(
                "Item {}: batch ID {} not found for medicine ID {}",
                i + 1, item.batch_id, item.medicine_id
            ))
        })?;

        if item.quantity > batch.remaining_qty {
            return Err(CommandError::validation(&format!(
                "Item {}: write-off quantity {} exceeds batch remaining stock {}",
                i + 1, item.quantity, batch.remaining_qty
            )));
        }
    }

    // --- PHASE 2: Open transaction ---
    let tx = db.transaction().map_err(|e| {
        CommandError::internal(&format!("Failed to start transaction: {}", e))
    })?;

    // --- PHASE 3: Insert returns + mutate stock ---
    let mut return_ids: Vec<i64> = Vec::new();

    for item in &payload.items {
        let return_id = returns_repo::insert(
            &tx,
            "write_off",
            None, // reference_id = NULL for standalone write-off (D-53)
            item.medicine_id,
            Some(item.batch_id),
            item.quantity,
            item.reason.as_deref(),
            Some(&item.condition),
            0.0, // refund_amount = 0 for write-off (D-53)
            user_id,
        )?;
        return_ids.push(return_id);

        // D-54: Deduct stock
        batch_repo::decrement_remaining_qty(&tx, item.batch_id, item.quantity)?;

        // Negative stock movement — loss logged as stock_movement (D-54)
        stock_ledger_service::record_movement(
            &tx,
            "write_off",
            item.medicine_id,
            Some(item.batch_id),
            -(item.quantity), // negative delta: stock destroyed
            "write_off",
            None,
            Some(&format!("Write-off: {}", item.condition)),
            user_id,
        )?;
    }

    // --- PHASE 4: Commit ---
    tx.commit().map_err(|e| {
        CommandError::internal(&format!("Failed to commit write-off transaction: {}", e))
    })?;

    Ok(ReturnReceiptDto {
        return_ids,
        item_count: payload.items.len() as i64,
        total_refund: 0.0,
    })
}

/// Non-mutating query helper: loads sale header + items with medicine names,
/// computes already_returned_qty per item, and provides returnable_qty.
///
/// Supports D-44: search by sale ID for customer return.
pub fn search_sale_for_return(
    db: &Connection,
    sale_id: i64,
) -> Result<SaleForReturnDto, CommandError> {
    let sale = sale_repo::find_by_id(db, sale_id)?
        .ok_or_else(|| CommandError::not_found("Sale"))?;

    let sale_items = sale_repo::find_items_by_sale(db, sale_id)?;

    let mut items: Vec<SaleItemForReturnDto> = Vec::new();
    for si in &sale_items {
        let medicine_name = medicine_repo::find_by_id(db, si.medicine_id)?
            .map(|m| m.name)
            .unwrap_or_default();

        // Compute already returned qty for this sale item
        let prior_returns = returns_repo::find_by_sale_item(db, sale_id, si.medicine_id, si.batch_id)?;
        let already_returned: i64 = prior_returns.iter().map(|r| r.quantity).sum();
        let returnable_qty = si.quantity - already_returned;

        items.push(SaleItemForReturnDto {
            sale_item_id: si.id,
            medicine_id: si.medicine_id,
            medicine_name,
            batch_id: si.batch_id,
            quantity: si.quantity,
            unit_price: si.unit_price,
            already_returned_qty: already_returned,
            returnable_qty,
        });
    }

    Ok(SaleForReturnDto {
        id: sale.id,
        created_at: sale.created_at,
        payment_method: sale.payment_method,
        total: sale.total,
        customer_name: sale.customer_name,
        items,
    })
}

/// Non-mutating query helper: loads purchase header + items + supplier + batches.
///
/// Supports D-49: supplier return by batch lookup.
pub fn search_purchase_for_return(
    db: &Connection,
    purchase_id: i64,
) -> Result<PurchaseForReturnDto, CommandError> {
    let purchase = purchase_repo::find_by_id(db, purchase_id)?
        .ok_or_else(|| CommandError::not_found("Purchase"))?;

    let supplier = supplier_repo::find_by_id(db, purchase.supplier_id)?
        .ok_or_else(|| CommandError::not_found("Supplier"))?;

    // Load batches for this purchase (only those with remaining stock)
    let batches = batch_repo::find_by_purchase_id(db, purchase_id)?;

    let purchase_items = purchase_repo::find_items_by_purchase_id(db, purchase_id)?;

    let mut items: Vec<PurchaseItemForReturnDto> = Vec::new();
    for pi in &purchase_items {
        let medicine_name = medicine_repo::find_by_id(db, pi.medicine_id)?
            .map(|m| m.name)
            .unwrap_or_default();

        // Find the matching batch
        let batch = batches.iter().find(|b| {
            b.purchase_item_id.map_or(false, |pii| pii == pi.id) || b.medicine_id == pi.medicine_id
        });

        if let Some(batch) = batch {
            items.push(PurchaseItemForReturnDto {
                purchase_item_id: pi.id,
                medicine_id: pi.medicine_id,
                medicine_name,
                batch_id: batch.id,
                quantity: pi.quantity,
                remaining_qty: batch.remaining_qty,
                purchase_price: pi.purchase_price,
                expiry_date: pi.expiry_date.clone(),
            });
        }
    }

    Ok(PurchaseForReturnDto {
        id: purchase.id,
        supplier_id: purchase.supplier_id,
        supplier_name: supplier.company_name,
        purchase_date: purchase.purchase_date,
        invoice_number: purchase.invoice_number,
        items,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers;

    #[test]
    fn test_search_sale_for_return_not_found() {
        let db = test_helpers::setup_test_db();
        let result = search_sale_for_return(&db, 999);
        assert!(result.is_err());
    }

    #[test]
    fn test_process_customer_return_invalid_sale() {
        let db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let mut db_mut = db;
        let dto = CustomerReturnDto {
            sale_id: 999,
            items: vec![],
        };
        let result = process_customer_return(&mut db_mut, &dto, uid);
        assert!(result.is_err());
    }
}
