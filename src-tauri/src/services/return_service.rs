use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::*;
use crate::repository::{batch_repo, medicine_repo, purchase_repo, returns_repo, sale_repo};
use crate::services::stock_ledger_service;

/// Processes a customer return — atomic transaction.
///
/// Both roles (owner + pharmacist) can process customer returns (D-44).
/// Resellable items restore stock. Damaged/expired items log loss only.
pub fn process_customer_return(
    db: &mut Connection,
    payload: &CustomerReturnDto,
    user_id: i64,
) -> Result<ReturnReceiptDto, CommandError> {
    // ── Phase 1: Validate before transaction ──

    // 1. Load sale — must exist
    let _sale = sale_repo::find_by_id(db, payload.sale_id)?
        .ok_or_else(|| CommandError::not_found("Sale"))?;

    // 2. Load sale items
    let sale_items = sale_repo::find_items_by_sale(db, payload.sale_id)?;

    // 3. Validate each returned item
    let mut total_refund = 0.0_f64;

    for item in &payload.items {
        // a. Find matching sale item
        let sale_item = sale_items
            .iter()
            .find(|si| si.id == item.sale_item_id)
            .ok_or_else(|| {
                CommandError::validation(&format!(
                    "Sale item {} not found in sale {}",
                    item.sale_item_id, payload.sale_id
                ))
            })?;

        // b. Compute already_returned_qty
        let prior_returns = returns_repo::find_by_sale_item(db, payload.sale_id, item.medicine_id, item.batch_id)?;
        let already_returned_qty: i64 = prior_returns.iter().map(|r| r.quantity).sum();

        // c. Validate D-46: qty <= original_qty - prior returns
        let allowable = sale_item.quantity - already_returned_qty;
        if item.quantity > allowable {
            return Err(CommandError::validation(&format!(
                "Return quantity {} exceeds allowable {} for sale_item {} \
                 (original: {}, already returned: {})",
                item.quantity, allowable, item.sale_item_id, sale_item.quantity, already_returned_qty
            )));
        }

        // d. Validate condition (D-45)
        match item.condition.as_str() {
            "resellable" | "damaged" | "expired" => {}
            _ => {
                return Err(CommandError::validation(&format!(
                    "Invalid condition '{}' — must be resellable, damaged, or expired",
                    item.condition
                )));
            }
        }

        // e. Validate refund amount
        if item.refund_amount < 0.0 {
            return Err(CommandError::validation("Refund amount must be non-negative"));
        }

        total_refund += item.refund_amount;
    }

    // ── Phase 2: Open transaction ──
    let tx = db.transaction()?;

    // ── Phase 3: Insert returns + mutate stock ──
    let mut return_ids = Vec::new();
    let mut item_count = 0_i64;

    for item in &payload.items {
        let rid = returns_repo::insert(
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
        return_ids.push(rid);
        item_count += item.quantity;

        match item.condition.as_str() {
            "resellable" => {
                // Restore stock to original batch (D-45)
                batch_repo::increment_remaining_qty(&tx, item.batch_id, item.quantity)?;
                stock_ledger_service::record_movement(
                    &tx,
                    "customer_return",
                    item.medicine_id,
                    Some(item.batch_id),
                    item.quantity, // positive delta — stock restored
                    "sale",
                    Some(payload.sale_id),
                    Some("Resellable customer return"),
                    user_id,
                )?;
            }
            "damaged" | "expired" => {
                // No stock restoration — log as loss (D-45/D-54)
                // quantity_delta = 0 because batch was already deducted at sale time
                stock_ledger_service::record_movement(
                    &tx,
                    "write_off",
                    item.medicine_id,
                    Some(item.batch_id),
                    0,
                    "sale",
                    Some(payload.sale_id),
                    Some(&format!("{} customer return — no stock restore", item.condition)),
                    user_id,
                )?;
            }
            _ => unreachable!(), // validated above
        }
    }

    // ── Phase 4: Commit ──
    tx.commit()?;

    Ok(ReturnReceiptDto {
        return_ids,
        item_count,
        total_refund,
    })
}

/// Processes a supplier return — atomic transaction.
/// Owner only (D-50). Deducts stock, logs credit note.
pub fn process_supplier_return(
    db: &mut Connection,
    payload: &SupplierReturnDto,
    user_id: i64,
) -> Result<ReturnReceiptDto, CommandError> {
    // ── Phase 1: Validate before transaction ──
    let _purchase = purchase_repo::find_by_id(db, payload.purchase_id)?
        .ok_or_else(|| CommandError::not_found("Purchase"))?;

    let _purchase_items = purchase_repo::find_items_by_purchase_id(db, payload.purchase_id)?;

    // Build a map of batch_id -> batch for easy lookup
    let batches = batch_repo::find_by_purchase_id(db, payload.purchase_id)?;
    let batch_map: std::collections::HashMap<i64, &Batch> =
        batches.iter().map(|b| (b.id, b)).collect();

    for item in &payload.items {
        // Validate batch exists and belongs to this purchase
        let batch = batch_map.get(&item.batch_id).ok_or_else(|| {
            CommandError::validation(&format!(
                "Batch {} not found for purchase {}",
                item.batch_id, payload.purchase_id
            ))
        })?;

        // Validate D-51: qty <= batch.remaining_qty
        if item.quantity > batch.remaining_qty {
            return Err(CommandError::validation(&format!(
                "Return quantity {} exceeds remaining stock {} for batch {}",
                item.quantity, batch.remaining_qty, item.batch_id
            )));
        }

        // Validate credit_amount
        if item.credit_amount < 0.0 {
            return Err(CommandError::validation("Credit amount must be non-negative"));
        }
    }

    // ── Phase 2: Open transaction ──
    let tx = db.transaction()?;

    // ── Phase 3: Mutate ──
    let mut return_ids = Vec::new();
    let mut item_count = 0_i64;
    let mut total_refund = 0.0_f64;

    for item in &payload.items {
        let rid = returns_repo::insert(
            &tx,
            "supplier",
            Some(payload.purchase_id),
            item.medicine_id,
            Some(item.batch_id),
            item.quantity,
            item.reason.as_deref(),
            None, // condition=NULL for supplier returns (D-52)
            item.credit_amount,
            user_id,
        )?;
        return_ids.push(rid);
        item_count += item.quantity;
        total_refund += item.credit_amount;

        // Deduct stock (D-50)
        batch_repo::decrement_remaining_qty(&tx, item.batch_id, item.quantity)?;

        // Log stock movement — negative delta (stock decrease)
        stock_ledger_service::record_movement(
            &tx,
            "supplier_return",
            item.medicine_id,
            Some(item.batch_id),
            -(item.quantity), // negative delta
            "purchase",
            Some(payload.purchase_id),
            Some("Supplier return"),
            user_id,
        )?;
    }

    // ── Phase 4: Commit ──
    tx.commit()?;

    Ok(ReturnReceiptDto {
        return_ids,
        item_count,
        total_refund,
    })
}

/// Processes a write-off — atomic transaction.
/// Owner only (D-53). Deducts stock, logs loss.
pub fn process_write_off(
    db: &mut Connection,
    payload: &WriteOffDto,
    user_id: i64,
) -> Result<ReturnReceiptDto, CommandError> {
    // ── Phase 1: Validate before transaction ──
    for item in &payload.items {
        // Could validate batch exists via find_by_medicine, but we need the batch id
        // We'll validate remaining_qty inside the transaction via the SQL CHECK constraint.
        // Pre-check by loading the batch:
        match item.condition.as_str() {
            "expired" | "damaged" => {}
            _ => {
                return Err(CommandError::validation(&format!(
                    "Invalid condition '{}' — must be expired or damaged",
                    item.condition
                )));
            }
        }

        if item.quantity <= 0 {
            return Err(CommandError::validation("Write-off quantity must be positive"));
        }
    }

    // ── Phase 2: Open transaction ──
    let tx = db.transaction()?;

    // ── Phase 3: Mutate ──
    let mut return_ids = Vec::new();
    let mut item_count = 0_i64;

    for item in &payload.items {
        // Verify batch has enough stock (D-54)
        let batch = batch_repo::find_by_medicine(&tx, item.medicine_id)?
            .into_iter()
            .find(|b| b.id == item.batch_id)
            .ok_or_else(|| {
                CommandError::validation(&format!("Batch {} not found", item.batch_id))
            })?;

        if item.quantity > batch.remaining_qty {
            return Err(CommandError::validation(&format!(
                "Write-off quantity {} exceeds remaining stock {} for batch {}",
                item.quantity, batch.remaining_qty, item.batch_id
            )));
        }

        let rid = returns_repo::insert(
            &tx,
            "write_off",
            None, // reference_id = NULL for standalone write-off (D-53)
            item.medicine_id,
            Some(item.batch_id),
            item.quantity,
            item.reason.as_deref(),
            Some(&item.condition),
            0.0, // no refund for write-off
            user_id,
        )?;
        return_ids.push(rid);
        item_count += item.quantity;

        // Deduct from inventory (D-54)
        batch_repo::decrement_remaining_qty(&tx, item.batch_id, item.quantity)?;

        // Log loss as stock movement — negative delta (D-54)
        stock_ledger_service::record_movement(
            &tx,
            "write_off",
            item.medicine_id,
            Some(item.batch_id),
            -(item.quantity), // negative delta — stock decrease
            "write_off",
            None,
            Some(&format!("Write-off: {}", item.condition)),
            user_id,
        )?;
    }

    // ── Phase 4: Commit ──
    tx.commit()?;

    Ok(ReturnReceiptDto {
        return_ids,
        item_count,
        total_refund: 0.0,
    })
}

/// Searches for a sale by ID to display items eligible for return (D-44).
///
/// Returns the sale header + items with medicine names, already_returned_qty,
/// and returnable_qty for each item.
pub fn search_sale_for_return(
    db: &Connection,
    sale_id: i64,
) -> Result<SaleForReturnDto, CommandError> {
    let sale = sale_repo::find_by_id(db, sale_id)?
        .ok_or_else(|| CommandError::not_found("Sale"))?;

    let sale_items = sale_repo::find_items_by_sale(db, sale_id)?;

    // Build items with medicine names and return quantities
    let mut items = Vec::new();
    for si in &sale_items {
        let prior_returns =
            returns_repo::find_by_sale_item(db, sale_id, si.medicine_id, si.batch_id)?;
        let already_returned_qty: i64 = prior_returns.iter().map(|r| r.quantity).sum();
        let returnable_qty = si.quantity - already_returned_qty;

        // Get medicine name
        let medicine = medicine_repo::find_by_id(db, si.medicine_id)?;
        let medicine_name = medicine.map(|m| m.name).unwrap_or_else(|| "Unknown".into());

        items.push(SaleItemForReturnDto {
            sale_item_id: si.id,
            medicine_id: si.medicine_id,
            medicine_name,
            batch_id: si.batch_id,
            quantity: si.quantity,
            unit_price: si.unit_price,
            already_returned_qty,
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

/// Searches for a purchase by ID to display items eligible for supplier return (D-49).
///
/// Returns the purchase header + items with batch info and remaining_qty.
pub fn search_purchase_for_return(
    db: &Connection,
    purchase_id: i64,
) -> Result<PurchaseForReturnDto, CommandError> {
    // Get purchase with supplier name
    let all_purchases = purchase_repo::find_all(db)?;
    let (purchase, supplier_name) = all_purchases
        .into_iter()
        .find(|(p, _)| p.id == purchase_id)
        .ok_or_else(|| CommandError::not_found("Purchase"))?;

    let purchase_items = purchase_repo::find_items_by_purchase_id(db, purchase_id)?;
    let batches = batch_repo::find_by_purchase_id(db, purchase_id)?;

    // Build a batch map for looking up remaining_qty and expiry_date
    let batch_map: std::collections::HashMap<i64, &Batch> =
        batches.iter().map(|b| (b.id, b)).collect();

    let mut items = Vec::new();
    for pi in &purchase_items {
        let medicine = medicine_repo::find_by_id(db, pi.medicine_id)?;
        let medicine_name = medicine.map(|m| m.name).unwrap_or_else(|| "Unknown".into());

        // Find the matching batch for this purchase item
        let batch_info = pi.batch_id.and_then(|bid| batch_map.get(&bid)).copied();

        items.push(PurchaseItemForReturnDto {
            purchase_item_id: pi.id,
            medicine_id: pi.medicine_id,
            medicine_name,
            batch_id: pi.batch_id.unwrap_or(0),
            quantity: pi.quantity,
            remaining_qty: batch_info.map(|b| b.remaining_qty).unwrap_or(0),
            purchase_price: pi.purchase_price,
            expiry_date: batch_info.map(|b| b.expiry_date.clone()).unwrap_or_default(),
        });
    }

    Ok(PurchaseForReturnDto {
        id: purchase.id,
        supplier_id: purchase.supplier_id,
        supplier_name,
        purchase_date: purchase.purchase_date,
        invoice_number: purchase.invoice_number,
        items,
    })
}
