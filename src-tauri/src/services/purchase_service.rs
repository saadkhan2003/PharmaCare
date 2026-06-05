use crate::errors::CommandError;
use crate::models::{
    CreatePurchaseDto, PurchaseDetailDto, PurchaseItemDto, PurchaseListDto, PurchaseReceiptDto,
};
use crate::repository::{batch_repo, medicine_repo, purchase_repo, supplier_repo};
use crate::services::stock_ledger_service;
use rusqlite::Connection;

/// Records a purchase — the primary stock-increase pathway (D-22).
///
/// This is the atomic transaction orchestrator:
/// 1. Validates ALL items BEFORE opening the transaction
/// 2. Opens a single `rusqlite::Transaction`
/// 3. Inserts purchase header
/// 4. For each item: inserts purchase_item, creates batch, links batch_id, records stock movement
/// 5. Updates total_cost (server-side recalculation — never trusts frontend)
/// 6. Commits — ALL succeed or ALL roll back
///
/// Takes `&mut Connection` because `rusqlite::Connection::transaction()` requires `&mut self`.
/// Callers (command handlers) pass `&mut *db` from their `MutexGuard<Connection>`.
pub fn record_purchase(
    db: &mut Connection,
    payload: &CreatePurchaseDto,
    user_id: i64,
) -> Result<PurchaseReceiptDto, CommandError> {
    // --- PHASE 1: Validate ALL items BEFORE opening transaction ---
    if payload.items.is_empty() {
        return Err(CommandError::validation(
            "Purchase must have at least one item",
        ));
    }
    if payload.supplier_id <= 0 {
        return Err(CommandError::validation("Invalid supplier"));
    }
    if !["Paid", "Pending", "Partial"].contains(&payload.payment_status.as_str()) {
        return Err(CommandError::validation("Invalid payment status"));
    }

    for (i, item) in payload.items.iter().enumerate() {
        if item.quantity <= 0 {
            return Err(CommandError::validation(&format!(
                "Item {}: quantity must be positive",
                i + 1
            )));
        }
        if item.purchase_price < 0.0 {
            return Err(CommandError::validation(&format!(
                "Item {}: purchase price cannot be negative",
                i + 1
            )));
        }
        // Validate medicine exists and is active
        let medicine = medicine_repo::find_by_id(db, item.medicine_id)?.ok_or_else(|| {
            CommandError::not_found(&format!("Medicine ID {}", item.medicine_id))
        })?;
        if !medicine.is_active {
            return Err(CommandError::validation(&format!(
                "Medicine '{}' is deactivated and cannot be purchased",
                medicine.name
            )));
        }
    }

    // --- PHASE 2: Open transaction — atomic: ALL succeed or ALL roll back ---
    let tx = db.transaction().map_err(|e| {
        CommandError::internal(&format!("Failed to start transaction: {}", e))
    })?;

    // --- PHASE 3: Calculate total cost server-side (never trust frontend) ---
    let total_cost: f64 = payload
        .items
        .iter()
        .map(|i| i.quantity as f64 * i.purchase_price)
        .sum();

    // --- PHASE 4: Insert purchase header ---
    let purchase_id = purchase_repo::insert_purchase(
        &tx,
        payload.supplier_id,
        payload.invoice_number.as_deref(),
        &payload.purchase_date,
        total_cost,
        &payload.payment_status,
        payload.notes.as_deref(),
        user_id,
    )?;

    // --- PHASE 5: For each item: insert purchase_item + batch + stock_movement ---
    for item in &payload.items {
        let line_cost = item.quantity as f64 * item.purchase_price;

        let item_id = purchase_repo::insert_item(
            &tx,
            purchase_id,
            item.medicine_id,
            item.quantity,
            item.purchase_price,
            &item.expiry_date,
            line_cost,
        )?;

        let batch_id = batch_repo::insert(
            &tx,
            item.medicine_id,
            Some(purchase_id),
            Some(item_id), // purchase_item_id
            item.purchase_price,
            item.quantity,  // quantity
            item.quantity,  // remaining_qty = quantity (D-20)
            &item.expiry_date,
        )?;

        // Link purchase_item to batch for traceability
        purchase_repo::update_item_batch_id(&tx, item_id, batch_id)?;

        // Record positive stock movement (D-22: StockLedgerService as single authority)
        // Pass &tx here — Transaction implements Deref<Target=Connection>, so this works.
        stock_ledger_service::record_movement(
            &tx,
            "purchase",
            item.medicine_id,
            Some(batch_id),
            item.quantity, // positive delta (stock increase)
            "purchase",
            Some(purchase_id),
            None, // reason (not needed for purchase)
            user_id,
        )?;
    }

    // --- PHASE 6: Update purchase total_cost (recalculated from actual inserts) ---
    purchase_repo::update_purchase_total(&tx, purchase_id, total_cost)?;

    // --- PHASE 7: Commit — ALL or NOTHING ---
    tx.commit().map_err(|e| {
        CommandError::internal(&format!("Failed to commit purchase transaction: {}", e))
    })?;

    Ok(PurchaseReceiptDto {
        purchase_id,
        total_cost,
        item_count: payload.items.len() as i64,
    })
}

/// Lists all purchases with supplier name and item count.
pub fn list_purchases(db: &Connection) -> Result<Vec<PurchaseListDto>, CommandError> {
    let purchases = purchase_repo::find_all(db)?;
    let mut dtos = Vec::new();
    for (purchase, supplier_name) in purchases {
        let item_count = purchase_repo::get_item_count(db, purchase.id)?;
        dtos.push(PurchaseListDto {
            id: purchase.id,
            supplier_name,
            invoice_number: purchase.invoice_number,
            purchase_date: purchase.purchase_date,
            total_cost: purchase.total_cost.unwrap_or(0.0),
            payment_status: purchase.payment_status,
            item_count,
            created_at: purchase.created_at,
        });
    }
    Ok(dtos)
}

/// Gets a single purchase with all items and medicine names.
pub fn get_purchase_detail(
    db: &Connection,
    purchase_id: i64,
) -> Result<PurchaseDetailDto, CommandError> {
    let purchase = purchase_repo::find_by_id(db, purchase_id)?
        .ok_or_else(|| CommandError::not_found("Purchase"))?;

    let items_raw = purchase_repo::find_items_by_purchase_id(db, purchase_id)?;
    let mut items = Vec::new();
    for item in items_raw {
        let medicine = medicine_repo::find_by_id(db, item.medicine_id)?
            .ok_or_else(|| CommandError::not_found("Medicine"))?;
        items.push(PurchaseItemDto {
            id: item.id,
            medicine_id: item.medicine_id,
            medicine_name: medicine.name,
            quantity: item.quantity,
            purchase_price: item.purchase_price,
            line_cost: item.line_cost,
            expiry_date: item.expiry_date,
            batch_id: item.batch_id,
        });
    }

    // Get supplier name
    let supplier = supplier_repo::find_by_id(db, purchase.supplier_id)?
        .ok_or_else(|| CommandError::not_found("Supplier"))?;

    Ok(PurchaseDetailDto {
        id: purchase.id,
        supplier_id: purchase.supplier_id,
        supplier_name: supplier.company_name,
        invoice_number: purchase.invoice_number,
        purchase_date: purchase.purchase_date,
        total_cost: purchase.total_cost.unwrap_or(0.0),
        payment_status: purchase.payment_status,
        notes: purchase.notes,
        created_by: format!("User {}", purchase.user_id),
        created_at: purchase.created_at,
        items,
    })
}
