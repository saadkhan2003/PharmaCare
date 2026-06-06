use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::*;
use crate::repository::{batch_repo, medicine_repo, sale_repo};
use crate::services::stock_ledger_service;
use crate::services::settings_service;

/// Helper: round to 2 decimal places for financial values.
fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

/// Main entry point: validates, then opens atomic transaction.
///
/// Takes `&mut Connection` because `rusqlite::Connection::transaction()` requires `&mut self`.
///
/// PHASES:
/// 1. Validate ALL items BEFORE opening transaction
/// 2. Open rusqlite::Transaction
/// 3. Server-side computation per item (FIFO allocation, server prices)
/// 4. Apply bill discount, calculate tax
/// 5. INSERT sale header
/// 6. For each allocation: INSERT sale_item + UPDATE batch + record_movement
/// 7. COMMIT — ALL or NOTHING
pub fn confirm_sale(
    db: &mut Connection,
    payload: &ConfirmSaleDto,
    user_id: i64,
    role: &str,
) -> Result<SaleReceiptDto, CommandError> {
    // --- PHASE 1: Validate ALL items BEFORE opening transaction ---
    if payload.items.is_empty() {
        return Err(CommandError::validation(
            "Sale must have at least one item",
        ));
    }

    // Validate payment method
    if !["Cash", "Card", "Credit"].contains(&payload.payment_method.as_str()) {
        return Err(CommandError::validation(&format!(
            "Invalid payment method: {}. Must be Cash, Card, or Credit",
            payload.payment_method
        )));
    }

    // Credit requires customer name (D-40 / T-03-05)
    if payload.payment_method == "Credit" && payload.customer_name.as_ref().map_or(true, |n| n.trim().is_empty()) {
        return Err(CommandError::validation(
            "Customer name is required for Credit payment",
        ));
    }

    // Load settings for tax rate and discount permission
    let settings = settings_service::get_settings(db)?;
    let discount_allowed = role == "owner" || settings.cashier_discount_enabled;

    // Validate each item BEFORE transaction
    for (i, item) in payload.items.iter().enumerate() {
        if item.quantity <= 0 {
            return Err(CommandError::validation(&format!(
                "Item {}: quantity must be positive",
                i + 1
            )));
        }

        if item.item_discount < 0.0 {
            return Err(CommandError::validation(&format!(
                "Item {}: discount cannot be negative",
                i + 1
            )));
        }

        // Validate medicine exists and is active
        let medicine = medicine_repo::find_by_id(db, item.medicine_id)?.ok_or_else(|| {
            CommandError::validation(&format!("Medicine ID {} not found", item.medicine_id))
        })?;

        if !medicine.is_active {
            return Err(CommandError::validation(&format!(
                "Medicine '{}' is deactivated and cannot be sold",
                medicine.name
            )));
        }

        // Check stock availability
        let available = stock_ledger_service::get_current_stock(db, item.medicine_id)?;
        if item.quantity > available {
            return Err(CommandError::validation(&format!(
                "Insufficient stock for '{}': requested {}, available {}",
                medicine.name, item.quantity, available
            )));
        }

        // Discount check — pharmacist without permission cannot apply discounts (D-38 / T-03-02)
        if item.item_discount > 0.0 && !discount_allowed {
            return Err(CommandError::validation(
                "Discounts are not enabled for your role",
            ));
        }
    }

    // Bill discount check
    if payload.bill_discount < 0.0 {
        return Err(CommandError::validation("Bill discount cannot be negative"));
    }
    if payload.bill_discount > 0.0 && !discount_allowed {
        return Err(CommandError::validation(
            "Bill discounts are not enabled for your role",
        ));
    }

    // --- PHASE 2: Open transaction — atomic: ALL succeed or ALL roll back ---
    let tx = db.transaction().map_err(|e| {
        CommandError::internal(&format!("Failed to start transaction: {}", e))
    })?;

    // --- PHASE 3: Server-side computation per item ---
    // Subtotal: sum of (qty * retail_price) for all items — server side only (D-35)
    let mut subtotal = 0.0_f64;
    let mut allocations: Vec<SaleItemAllocation> = Vec::new();

    for item in &payload.items {
        // Get retail_price from DB — never from frontend (D-35)
        let medicine = medicine_repo::find_by_id(&tx, item.medicine_id)?.ok_or_else(|| {
            CommandError::validation(&format!("Medicine ID {} not found", item.medicine_id))
        })?;

        let unit_price = medicine.retail_price;
        let gross_line = item.quantity as f64 * unit_price;

        // Cap item discount at gross line amount
        let item_discount = if item.item_discount > gross_line {
            gross_line
        } else {
            item.item_discount
        };

        let line_total = round2(gross_line - item_discount);

        // FIFO allocation: find non-expired batches ordered by expiry ASC
        let fifo_batches = batch_repo::find_fifo_eligible(&tx, item.medicine_id)?;

        let mut needed = item.quantity;
        for batch in &fifo_batches {
            if needed <= 0 {
                break;
            }
            let take = if batch.remaining_qty >= needed {
                needed
            } else {
                batch.remaining_qty
            };

            // Allocate proportionally: share of item discount × (take / item.quantity)
            let alloc_line_total = round2(take as f64 * unit_price);
            let alloc_discount = if item.quantity > 0 {
                round2(item_discount * (take as f64 / item.quantity as f64))
            } else {
                0.0
            };

            allocations.push(SaleItemAllocation {
                medicine_id: item.medicine_id,
                batch_id: batch.id,
                quantity: take,
                unit_price,
                purchase_cost: batch.purchase_price, // COGS snapshot (D-34)
                item_discount: alloc_discount,
                line_total: round2(alloc_line_total - alloc_discount),
            });

            needed -= take;
        }

        // Add server-computed line total to subtotal
        subtotal = round2(subtotal + line_total);
    }

    // --- PHASE 4: Apply bill discount and tax ---
    // Cap bill discount at subtotal
    let bill_discount = if payload.bill_discount > subtotal {
        subtotal
    } else {
        payload.bill_discount
    };

    let after_discount = round2(subtotal - bill_discount);

    // Tax on post-discount subtotal (D-36)
    let tax_rate = if payload.tax_enabled {
        settings.default_tax_rate
    } else {
        0.0
    };
    let tax_amount = round2(after_discount * tax_rate / 100.0);
    let total = round2(after_discount + tax_amount);

    // --- PHASE 5: INSERT sale header ---
    let sale_id = sale_repo::insert_sale(
        &tx,
        user_id,
        subtotal,
        bill_discount,
        tax_rate,
        tax_amount,
        total,
        &payload.payment_method,
        payload.customer_name.as_deref(),
    )?;

    // --- PHASE 6: For each allocation: INSERT sale_item + UPDATE batch + record_movement ---
    let mut receipt_items: Vec<SaleReceiptItemDto> = Vec::new();

    for alloc in &allocations {
        // Insert sale_items row
        sale_repo::insert_item(
            &tx,
            sale_id,
            alloc.medicine_id,
            alloc.batch_id,
            alloc.quantity,
            alloc.unit_price,
            alloc.purchase_cost,
            alloc.item_discount,
            alloc.line_total,
        )?;

        // Decrement batch remaining_qty
        batch_repo::decrement_remaining_qty(&tx, alloc.batch_id, alloc.quantity)?;

        // Record negative stock movement (D-22: StockLedgerService as single authority)
        stock_ledger_service::record_movement(
            &tx,
            "sale",
            alloc.medicine_id,
            Some(alloc.batch_id),
            -(alloc.quantity), // negative delta (stock decrease)
            "sale",
            Some(sale_id),
            None,
            user_id,
        )?;
    }

    // Build receipt items (deduplicate by medicine for display)
    {
        use std::collections::BTreeMap;

        // Collect medicine names first
        let mut medicine_names: BTreeMap<i64, String> = BTreeMap::new();
        for alloc in &allocations {
            if !medicine_names.contains_key(&alloc.medicine_id) {
                if let Ok(Some(med)) = medicine_repo::find_by_id(&tx, alloc.medicine_id) {
                    medicine_names.insert(alloc.medicine_id, med.name);
                }
            }
        }

        // Aggregate totals per medicine
        let mut agg: BTreeMap<i64, (i64, f64, f64, f64)> = BTreeMap::new();
        for alloc in &allocations {
            let entry = agg.entry(alloc.medicine_id).or_insert((0, 0.0, 0.0, 0.0));
            entry.0 += alloc.quantity;
            entry.1 += alloc.item_discount;
            entry.2 += alloc.line_total;
            // entry.3 unused (placeholder for unit_price)
        }

        for (mid, (qty, discount, line_total, _)) in &agg {
            let name = medicine_names.get(mid).cloned().unwrap_or_default();
            let unit_price = allocations.iter()
                .find(|a| a.medicine_id == *mid)
                .map(|a| a.unit_price)
                .unwrap_or(0.0);
            receipt_items.push(SaleReceiptItemDto {
                medicine_name: name,
                quantity: *qty,
                unit_price,
                item_discount: round2(*discount),
                line_total: round2(*line_total),
            });
        }
    }

    // --- PHASE 7: Commit — ALL or NOTHING ---
    tx.commit().map_err(|e| {
        CommandError::internal(&format!("Failed to commit sale transaction: {}", e))
    })?;

    Ok(SaleReceiptDto {
        sale_id,
        subtotal,
        bill_discount,
        tax_rate,
        tax_amount,
        total,
        payment_method: payload.payment_method.clone(),
        customer_name: payload.customer_name.clone(),
        item_count: payload.items.len() as i64,
        items: receipt_items,
    })
}

/// POS-specific medicine search — excludes purchase_price always (D-30/POS-01).
/// Returns live search results with current_stock from non-expired batches.
pub fn search_medicines_pos(
    db: &Connection,
    query: &str,
) -> Result<Vec<MedicinePosDto>, CommandError> {
    let pattern = format!("%{}%", query);
    let mut stmt = db.prepare(
        "SELECT m.id, m.name, m.generic_name, m.unit, m.retail_price, \
                COALESCE((SELECT SUM(b.remaining_qty) FROM batches b \
                          WHERE b.medicine_id = m.id AND b.expiry_date > date('now')), 0) AS current_stock, \
                m.reorder_level, m.shelf_location \
         FROM medicines m \
         WHERE m.is_active = 1 \
           AND (m.name LIKE ?1 OR m.generic_name LIKE ?1 OR m.brand_name LIKE ?1) \
         ORDER BY m.name ASC \
         LIMIT 20",
    )?;

    let rows = stmt.query_map(rusqlite::params![pattern], |row| {
        Ok(MedicinePosDto {
            id: row.get(0)?,
            name: row.get(1)?,
            generic_name: row.get(2)?,
            unit: row.get(3)?,
            retail_price: row.get(4)?,
            current_stock: row.get(5)?,
            reorder_level: row.get(6)?,
            shelf_location: row.get(7)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

pub fn list_sales(db: &Connection, query: &str, start_date: &str, end_date: &str) -> Result<Vec<SaleListDto>, CommandError> {
    let end = if end_date.is_empty() {
        String::new()
    } else {
        format!("{}T23:59:59", end_date)
    };
    sale_repo::find_recent(db, query, start_date, &end).map_err(CommandError::from)
}

pub fn get_sale_detail(db: &Connection, sale_id: i64) -> Result<SaleDetailDto, CommandError> {
    let sale = sale_repo::find_by_id(db, sale_id)?
        .ok_or_else(|| CommandError::not_found("Sale"))?;
    let items = sale_repo::find_detail_items(db, sale_id)?;
    Ok(SaleDetailDto { sale, items })
}

/// Owner dashboard — full financial data. D-41/REPT-01.
pub fn get_owner_dashboard(db: &Connection) -> Result<OwnerDashboardDto, CommandError> {
    let today_sales = sale_repo::get_today_sales(db)?;
    let today_profit = sale_repo::get_today_profit(db)?;
    let month_sales = sale_repo::get_month_sales(db)?;
    let low_stock_count = sale_repo::get_low_stock_count(db)?;
    let expiry_warning_count = sale_repo::get_expiry_count(db, 60)?; // within 60 days
    let expiry_critical_count = sale_repo::get_expiry_count(db, 30)?; // within 30 days
    let top_sellers = sale_repo::get_top_sellers(db)?;

    Ok(OwnerDashboardDto {
        today_sales,
        today_profit,
        month_sales,
        low_stock_count,
        expiry_warning_count,
        expiry_critical_count,
        top_sellers,
    })
}

/// Pharmacist dashboard — no profit/margin. D-42/REPT-02.
pub fn get_pharmacist_dashboard(db: &Connection) -> Result<PharmacistDashboardDto, CommandError> {
    let today_sales = sale_repo::get_today_sales(db)?;
    let low_stock_count = sale_repo::get_low_stock_count(db)?;
    let expiry_warning_count = sale_repo::get_expiry_count(db, 60)?;
    let expiry_critical_count = sale_repo::get_expiry_count(db, 30)?;

    Ok(PharmacistDashboardDto {
        today_sales,
        low_stock_count,
        expiry_warning_count,
        expiry_critical_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers;

    #[test]
    fn test_confirm_sale_empty_cart() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let payload = ConfirmSaleDto {
            items: vec![],
            bill_discount: 0.0,
            tax_enabled: false,
            payment_method: "Cash".into(),
            customer_name: None,
        };
        let result = confirm_sale(&mut db, &payload, uid, "owner");
        assert!(result.is_err());
    }
}
