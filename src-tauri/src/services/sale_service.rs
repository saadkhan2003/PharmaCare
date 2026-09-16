use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::*;
use crate::repository::{batch_repo, debt_repo, medicine_repo, sale_repo};
use crate::services::stock_ledger_service;
use crate::services::settings_service;
use crate::models::pagination::PaginatedList;

/// Helper: round to 2 decimal places for financial values.
fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

/// Main entry point: validates, then opens atomic transaction.
///
/// Takes `&mut Connection` because `rusqlite::Connection::transaction()` requires `&mut self`.
///
/// PHASES:
/// 1. Validate inputs BEFORE opening transaction
/// 2. Open rusqlite::Transaction
/// 3. Re-check stock INSIDE transaction (C-3 fix) + FIFO allocation
/// 4. Apply bill discount, calculate tax
/// 5. INSERT sale header
/// 6. For each allocation: INSERT sale_item + UPDATE batch + record_movement
/// 7. Verify no under-allocation (H-8 fix)
/// 8. Commit — ALL or NOTHING
pub fn confirm_sale(
    db: &mut Connection,
    payload: &ConfirmSaleDto,
    user_id: i64,
    role: &str,
) -> Result<SaleReceiptDto, CommandError> {
    // --- PHASE 1: Validate inputs BEFORE opening transaction ---
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

    // Validate each item: medicine exists, is active, discount allowed (no stock check here — C-3)
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

    // --- PHASE 3: Re-check stock INSIDE transaction (C-3 fix) + FIFO allocation ---
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

        // Stock check INSIDE transaction (C-3 fix)
        let available = stock_ledger_service::get_current_stock(&tx, item.medicine_id)?;
        if item.quantity > available {
            return Err(CommandError::validation(&format!(
                "Insufficient stock for '{}': requested {}, available {}",
                medicine.name, item.quantity, available
            )));
        }

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

        // H-8 fix: verify full allocation — don't silently under-allocate
        if needed > 0 {
            return Err(CommandError::validation(&format!(
                "Insufficient stock for '{}' across all batches: {} units still needed",
                medicine.name, needed
            )));
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

        // Decrement batch remaining_qty (C-4 fix: check affected rows)
        let rows_affected = batch_repo::decrement_remaining_qty(&tx, alloc.batch_id, alloc.quantity)?;
        if rows_affected == 0 {
            return Err(CommandError::internal(&format!(
                "Failed to decrement stock for batch {}: insufficient remaining quantity",
                alloc.batch_id
            )));
        }

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

    // --- If Credit sale, create linked debtor and debt_items atomically ---
    if payload.payment_method == "Credit" && total > 0.0 {
        let customer_name = payload.customer_name.as_deref().unwrap_or("Credit Customer").trim();
        let phone = payload.customer_phone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());
        let due_date = payload.due_date.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                (chrono::Utc::now() + chrono::Duration::days(30)).format("%Y-%m-%d").to_string()
            });

        tx.execute(
            "INSERT INTO debtors (customer_name, phone, total_amount, paid_amount, due_date, notes, status)
             VALUES (?1, ?2, ?3, 0.0, ?4, ?5, 'pending')",
            rusqlite::params![
                customer_name,
                phone,
                total,
                due_date,
                format!("Auto-generated from POS Credit Sale #{}", sale_id),
            ],
        ).map_err(|e| CommandError::internal(&format!("Failed to record debtor: {}", e)))?;

        let debt_id = tx.last_insert_rowid();

        for item in &receipt_items {
            tx.execute(
                "INSERT INTO debt_items (debt_id, sale_id, medicine_name, quantity, amount)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![
                    debt_id,
                    sale_id,
                    item.medicine_name,
                    item.quantity,
                    item.line_total,
                ],
            ).map_err(|e| CommandError::internal(&format!("Failed to record debt item: {}", e)))?;
        }

        let _ = debt_repo::update_overdue_status(&tx);
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

pub fn list_sales(
    db: &Connection,
    query: &str,
    start_date: &str,
    end_date: &str,
    page: i64,
    per_page: i64,
) -> Result<PaginatedList<SaleListDto>, CommandError> {
    let end = if end_date.is_empty() {
        String::new()
    } else {
        format!("{}T23:59:59", end_date)
    };
    let offset = (page - 1) * per_page;
    let (items, total) = sale_repo::find_recent(db, query, start_date, &end, offset, per_page)
        .map_err(CommandError::from)?;
    Ok(PaginatedList::new(items, total, page, per_page))
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

    /// Helper: seed a medicine with a batch and return (medicine_id, batch_id).
    fn seed_med_with_batch(db: &rusqlite::Connection, name: &str, price: f64, qty: i64) -> (i64, i64) {
        let mid = test_helpers::seed_medicine(db, name);
        // Update the medicine to set the desired retail_price
        db.execute(
            "UPDATE medicines SET retail_price = ?1 WHERE id = ?2",
            rusqlite::params![price, mid],
        ).unwrap();
        let batch_id = crate::repository::batch_repo::insert(
            db, mid, None, None, price * 0.5, qty, qty, "2099-12-31", Some("BATCH-001"),
        ).unwrap();
        (mid, batch_id)
    }

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
            customer_phone: None,
            due_date: None,
        };
        let result = confirm_sale(&mut db, &payload, uid, "owner");
        assert!(result.is_err());
    }

    #[test]
    fn test_confirm_sale_single_item() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);

        let payload = ConfirmSaleDto {
            items: vec![ConfirmSaleItemDto { medicine_id: mid, quantity: 5, item_discount: 0.0 }],
            bill_discount: 0.0,
            tax_enabled: false,
            payment_method: "Cash".into(),
            customer_name: None,
            customer_phone: None,
            due_date: None,
        };
        let receipt = confirm_sale(&mut db, &payload, uid, "owner").unwrap();
        assert_eq!(receipt.item_count, 1);
        assert!((receipt.subtotal - 50.0).abs() < 0.01);
        assert!((receipt.total - 50.0).abs() < 0.01);

        // Stock should be decremented
        let stock = crate::services::stock_ledger_service::get_current_stock(&db, mid).unwrap();
        assert_eq!(stock, 45);
    }

    #[test]
    fn test_confirm_sale_multiple_items() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid1, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);
        let (mid2, _) = seed_med_with_batch(&db, "Ibuprofen", 20.0, 30);

        let payload = ConfirmSaleDto {
            items: vec![
                ConfirmSaleItemDto { medicine_id: mid1, quantity: 3, item_discount: 0.0 },
                ConfirmSaleItemDto { medicine_id: mid2, quantity: 2, item_discount: 0.0 },
            ],
            bill_discount: 0.0,
            tax_enabled: false,
            payment_method: "Cash".into(),
            customer_name: None,
            customer_phone: None,
            due_date: None,
        };
        let receipt = confirm_sale(&mut db, &payload, uid, "owner").unwrap();
        // 3*10 + 2*20 = 70
        assert!((receipt.subtotal - 70.0).abs() < 0.01);
        assert_eq!(receipt.item_count, 2);
    }

    #[test]
    fn test_confirm_sale_with_discount() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);

        let payload = ConfirmSaleDto {
            items: vec![ConfirmSaleItemDto { medicine_id: mid, quantity: 10, item_discount: 5.0 }],
            bill_discount: 0.0,
            tax_enabled: false,
            payment_method: "Cash".into(),
            customer_name: None,
            customer_phone: None,
            due_date: None,
        };
        let receipt = confirm_sale(&mut db, &payload, uid, "owner").unwrap();
        // 10*10 = 100 subtotal, 5.0 item discount => line_total = 95
        assert!((receipt.subtotal - 95.0).abs() < 0.01);
    }

    #[test]
    fn test_confirm_sale_with_tax() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);

        let payload = ConfirmSaleDto {
            items: vec![ConfirmSaleItemDto { medicine_id: mid, quantity: 10, item_discount: 0.0 }],
            bill_discount: 0.0,
            tax_enabled: true,
            payment_method: "Cash".into(),
            customer_name: None,
            customer_phone: None,
            due_date: None,
        };
        let receipt = confirm_sale(&mut db, &payload, uid, "owner").unwrap();
        // subtotal=100, tax_rate defaults to 0.0 in fresh DB => tax_amount=0, total=100
        assert!((receipt.subtotal - 100.0).abs() < 0.01);
        assert!((receipt.tax_amount - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_confirm_sale_with_tax_rate() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);

        // Set tax rate to 10%
        crate::repository::settings_repo::set_value(&db, "default_tax_rate", "10.0").unwrap();

        let payload = ConfirmSaleDto {
            items: vec![ConfirmSaleItemDto { medicine_id: mid, quantity: 10, item_discount: 0.0 }],
            bill_discount: 0.0,
            tax_enabled: true,
            payment_method: "Cash".into(),
            customer_name: None,
            customer_phone: None,
            due_date: None,
        };
        let receipt = confirm_sale(&mut db, &payload, uid, "owner").unwrap();
        // subtotal=100, tax=10% => tax_amount=10, total=110
        assert!((receipt.subtotal - 100.0).abs() < 0.01);
        assert!((receipt.tax_amount - 10.0).abs() < 0.01);
        assert!((receipt.total - 110.0).abs() < 0.01);
    }

    #[test]
    fn test_confirm_sale_insufficient_stock() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 5);

        let payload = ConfirmSaleDto {
            items: vec![ConfirmSaleItemDto { medicine_id: mid, quantity: 10, item_discount: 0.0 }],
            bill_discount: 0.0,
            tax_enabled: false,
            payment_method: "Cash".into(),
            customer_name: None,
            customer_phone: None,
            due_date: None,
        };
        let result = confirm_sale(&mut db, &payload, uid, "owner");
        assert!(result.is_err());
    }

    #[test]
    fn test_confirm_sale_deactivated_medicine() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);

        // Deactivate the medicine
        crate::repository::medicine_repo::deactivate(&db, mid).unwrap();

        let payload = ConfirmSaleDto {
            items: vec![ConfirmSaleItemDto { medicine_id: mid, quantity: 1, item_discount: 0.0 }],
            bill_discount: 0.0,
            tax_enabled: false,
            payment_method: "Cash".into(),
            customer_name: None,
            customer_phone: None,
            due_date: None,
        };
        let result = confirm_sale(&mut db, &payload, uid, "owner");
        assert!(result.is_err());
    }

    #[test]
    fn test_confirm_sale_zero_quantity() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);

        let payload = ConfirmSaleDto {
            items: vec![ConfirmSaleItemDto { medicine_id: mid, quantity: 0, item_discount: 0.0 }],
            bill_discount: 0.0,
            tax_enabled: false,
            payment_method: "Cash".into(),
            customer_name: None,
            customer_phone: None,
            due_date: None,
        };
        let result = confirm_sale(&mut db, &payload, uid, "owner");
        assert!(result.is_err());
    }

    #[test]
    fn test_pos_search_returns_correct_results() {
        let db = test_helpers::setup_test_db();
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);
        // Another medicine that shouldn't match
        seed_med_with_batch(&db, "Ibuprofen", 20.0, 30);

        let results = search_medicines_pos(&db, "Pan").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, mid);
        assert_eq!(results[0].name, "Panadol");
        assert_eq!(results[0].current_stock, 50);
        assert!((results[0].retail_price - 10.0).abs() < 0.01);
    }

    #[test]
    fn test_confirm_sale_with_bill_discount() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);

        let payload = ConfirmSaleDto {
            items: vec![ConfirmSaleItemDto { medicine_id: mid, quantity: 10, item_discount: 0.0 }],
            bill_discount: 20.0,
            tax_enabled: false,
            payment_method: "Cash".into(),
            customer_name: None,
            customer_phone: None,
            due_date: None,
        };
        let receipt = confirm_sale(&mut db, &payload, uid, "owner").unwrap();
        // subtotal=100, bill_discount=20 => total=80
        assert!((receipt.bill_discount - 20.0).abs() < 0.01);
        assert!((receipt.total - 80.0).abs() < 0.01);
    }

    #[test]
    fn test_confirm_sale_invalid_payment_method() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);

        let payload = ConfirmSaleDto {
            items: vec![ConfirmSaleItemDto { medicine_id: mid, quantity: 1, item_discount: 0.0 }],
            bill_discount: 0.0,
            tax_enabled: false,
            payment_method: "Bitcoin".into(),
            customer_name: None,
            customer_phone: None,
            due_date: None,
        };
        let result = confirm_sale(&mut db, &payload, uid, "owner");
        assert!(result.is_err());
    }

    #[test]
    fn test_confirm_sale_credit_requires_customer() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);

        let payload = ConfirmSaleDto {
            items: vec![ConfirmSaleItemDto { medicine_id: mid, quantity: 1, item_discount: 0.0 }],
            bill_discount: 0.0,
            tax_enabled: false,
            payment_method: "Credit".into(),
            customer_name: None,
            customer_phone: None,
            due_date: None,
        };
        let result = confirm_sale(&mut db, &payload, uid, "owner");
        assert!(result.is_err());
    }

    #[test]
    fn test_confirm_sale_credit_creates_debtor_and_items() {
        let mut db = test_helpers::setup_test_db();
        let uid = test_helpers::seed_owner(&db);
        let (mid, _) = seed_med_with_batch(&db, "Panadol", 10.0, 50);

        let payload = ConfirmSaleDto {
            items: vec![ConfirmSaleItemDto { medicine_id: mid, quantity: 2, item_discount: 0.0 }],
            bill_discount: 0.0,
            tax_enabled: false,
            payment_method: "Credit".into(),
            customer_name: Some("Credit Customer A".into()),
            customer_phone: Some("03001234567".into()),
            due_date: Some("2028-12-31".into()),
        };
        let receipt = confirm_sale(&mut db, &payload, uid, "owner").unwrap();
        assert_eq!(receipt.payment_method, "Credit");

        // Verify debtor was inserted
        let debtor: (String, Option<String>, f64, String) = db.query_row(
            "SELECT customer_name, phone, total_amount, status FROM debtors WHERE customer_name = ?1",
            rusqlite::params!["Credit Customer A"],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        ).expect("debtor record");

        assert_eq!(debtor.0, "Credit Customer A");
        assert_eq!(debtor.1.as_deref(), Some("03001234567"));
        assert!((debtor.2 - 20.0).abs() < 0.01);
        assert_eq!(debtor.3, "pending");

        // Verify debt_items was inserted
        let (qty, amt): (i64, f64) = db.query_row(
            "SELECT quantity, amount FROM debt_items WHERE sale_id = ?1",
            rusqlite::params![receipt.sale_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).expect("debt_items record");

        assert_eq!(qty, 2);
        assert!((amt - 20.0).abs() < 0.01);
    }
}
