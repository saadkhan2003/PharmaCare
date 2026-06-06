use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::*;

/// Report 1: Daily Sales Summary (REPT-03)
pub fn get_daily_sales(
    db: &Connection,
    start: &str,
    end: &str,
) -> Result<Vec<DailySalesRow>, CommandError> {
    let mut stmt = db.prepare(
        "SELECT
            date(s.created_at) as sale_date,
            COUNT(DISTINCT s.id) as sale_count,
            COUNT(si.id) as item_count,
            COALESCE(SUM(si.line_total + si.item_discount), 0) as gross_sales,
            COALESCE(SUM(si.item_discount), 0) + COALESCE(MAX(s.bill_discount), 0) as total_discounts,
            COALESCE(MAX(s.tax_amount), 0) as tax_amount,
            COALESCE(SUM(si.line_total), 0) as net_sales,
            COALESCE(SUM(si.line_total - (si.purchase_cost * si.quantity)), 0) as profit
        FROM sales s
        JOIN sale_items si ON si.sale_id = s.id
        WHERE date(s.created_at) >= ?1 AND date(s.created_at) <= ?2
        GROUP BY date(s.created_at)
        ORDER BY sale_date ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![start, end], |row| {
        Ok(DailySalesRow {
            date: row.get(0)?,
            sale_count: row.get(1)?,
            item_count: row.get(2)?,
            gross_sales: row.get(3)?,
            discounts: row.get(4)?,
            tax_amount: row.get(5)?,
            net_sales: row.get(6)?,
            profit: row.get(7)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(CommandError::from)
}

/// Report 2: Monthly P&L (REPT-04)
pub fn get_monthly_pnl(
    db: &Connection,
    start: &str,
    end: &str,
) -> Result<Vec<MonthlyPnLRow>, CommandError> {
    let mut stmt = db.prepare(
        "SELECT
            strftime('%Y-%m', s.created_at) as month,
            COUNT(DISTINCT s.id) as sale_count,
            COALESCE(SUM(si.line_total), 0) as total_revenue,
            COALESCE(SUM(si.purchase_cost * si.quantity), 0) as total_cogs,
            COALESCE(SUM(si.line_total - (si.purchase_cost * si.quantity)), 0) as gross_profit,
            COALESCE((SELECT SUM(refund_amount) FROM returns
                WHERE return_type = 'customer'
                AND strftime('%Y-%m', return_date) = strftime('%Y-%m', s.created_at)), 0) as total_refunds,
            COALESCE((SELECT SUM(ABS(refund_amount)) FROM returns
                WHERE return_type = 'write_off'
                AND strftime('%Y-%m', return_date) = strftime('%Y-%m', s.created_at)), 0) as write_off_losses
        FROM sales s
        JOIN sale_items si ON si.sale_id = s.id
        WHERE strftime('%Y-%m', s.created_at) >= ?1 AND strftime('%Y-%m', s.created_at) <= ?2
        GROUP BY strftime('%Y-%m', s.created_at)
        ORDER BY month ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![start, end], |row| {
        Ok(MonthlyPnLRow {
            month: row.get(0)?,
            sale_count: row.get(1)?,
            total_revenue: row.get(2)?,
            total_cogs: row.get(3)?,
            gross_profit: row.get(4)?,
            total_refunds: row.get(5)?,
            write_off_losses: row.get(6)?,
            net_profit: row.get::<_, f64>(4)? - row.get::<_, f64>(5)? - row.get::<_, f64>(6)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(CommandError::from)
}

/// Report 3: Top Selling Medicines (REPT-05) — LIMIT 50
pub fn get_top_sellers(
    db: &Connection,
    start: &str,
    end: &str,
) -> Result<Vec<TopSellerRow>, CommandError> {
    let mut stmt = db.prepare(
        "SELECT
            m.id as medicine_id,
            m.name as medicine_name,
            m.generic_name,
            COALESCE(SUM(si.quantity), 0) as total_qty,
            COALESCE(SUM(si.line_total), 0) as total_revenue,
            COALESCE(SUM(si.line_total - (si.purchase_cost * si.quantity)), 0) as total_profit
        FROM sale_items si
        JOIN medicines m ON m.id = si.medicine_id
        JOIN sales s ON s.id = si.sale_id
        WHERE date(s.created_at) >= ?1 AND date(s.created_at) <= ?2
        GROUP BY m.id
        ORDER BY total_qty DESC
        LIMIT 50",
    )?;

    let rows = stmt.query_map(rusqlite::params![start, end], |row| {
        Ok(TopSellerRow {
            medicine_id: row.get(0)?,
            medicine_name: row.get(1)?,
            generic_name: row.get(2)?,
            total_qty: row.get::<_, i64>(3)?,
            total_revenue: row.get(4)?,
            total_profit: row.get(5)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(CommandError::from)
}

/// Report 4: Slow-Moving Stock (REPT-06)
pub fn get_slow_moving(
    db: &Connection,
    start: &str,
    end: &str,
) -> Result<Vec<SlowMovingRow>, CommandError> {
    let mut stmt = db.prepare(
        "SELECT
            m.id as medicine_id,
            m.name as medicine_name,
            m.category,
            COALESCE(SUM(b.remaining_qty), 0) as current_stock,
            COALESCE(SUM(b.remaining_qty * b.purchase_price), 0) as total_investment
        FROM medicines m
        LEFT JOIN batches b ON b.medicine_id = m.id AND b.remaining_qty > 0
        LEFT JOIN (
            SELECT si.medicine_id, SUM(si.quantity) as total_qty
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            WHERE date(s.created_at) >= ?1 AND date(s.created_at) <= ?2
            GROUP BY si.medicine_id
        ) sold ON sold.medicine_id = m.id
        WHERE m.is_active = 1
            AND (sold.total_qty IS NULL OR sold.total_qty = 0)
        GROUP BY m.id
        ORDER BY m.name ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![start, end], |row| {
        Ok(SlowMovingRow {
            medicine_id: row.get(0)?,
            medicine_name: row.get(1)?,
            category: row.get(2)?,
            current_stock: row.get::<_, i64>(3)?,
            total_investment: row.get(4)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(CommandError::from)
}

/// Report 5: Low Stock (REPT-07) — current state, no date params
pub fn get_low_stock(db: &Connection) -> Result<Vec<LowStockRow>, CommandError> {
    let mut stmt = db.prepare(
        "SELECT
            m.id as medicine_id,
            m.name as medicine_name,
            m.category,
            m.reorder_level,
            COALESCE(SUM(b.remaining_qty), 0) as current_stock,
            m.unit
        FROM medicines m
        LEFT JOIN batches b ON b.medicine_id = m.id AND b.remaining_qty > 0
        WHERE m.is_active = 1
        GROUP BY m.id
        HAVING current_stock <= m.reorder_level
        ORDER BY current_stock ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(LowStockRow {
            medicine_id: row.get(0)?,
            medicine_name: row.get(1)?,
            category: row.get(2)?,
            reorder_level: row.get(3)?,
            current_stock: row.get::<_, i64>(4)?,
            unit: row.get(5)?,
            deficit: (row.get::<_, i64>(3)? - row.get::<_, i64>(4)?).max(0),
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(CommandError::from)
}

/// Report 6: Expiry Report (REPT-08) — uses warning/critical day thresholds
pub fn get_expiry_report(
    db: &Connection,
    warning_days: i64,
    critical_days: i64,
) -> Result<Vec<ExpiryReportDetailRow>, CommandError> {
    let mut stmt = db.prepare(
        "SELECT
            b.id as batch_id,
            m.id as medicine_id,
            m.name as medicine_name,
            b.batch_code,
            b.quantity as original_qty,
            b.remaining_qty,
            b.purchase_price as unit_cost,
            b.expiry_date,
            CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) as days_remaining,
            (b.remaining_qty * b.purchase_price) as potential_loss,
            CASE
                WHEN julianday(b.expiry_date) - julianday('now') < 0 THEN 'expired'
                WHEN julianday(b.expiry_date) - julianday('now') <= ?2 THEN 'critical'
                WHEN julianday(b.expiry_date) - julianday('now') <= ?1 THEN 'warning'
                ELSE 'ok'
            END as status
        FROM batches b
        JOIN medicines m ON m.id = b.medicine_id
        WHERE b.remaining_qty > 0
            AND julianday(b.expiry_date) - julianday('now') <= ?1
        ORDER BY b.expiry_date ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![warning_days, critical_days], |row| {
        Ok(ExpiryReportDetailRow {
            batch_id: row.get(0)?,
            medicine_id: row.get(1)?,
            medicine_name: row.get(2)?,
            batch_code: row.get(3)?,
            original_qty: row.get(4)?,
            remaining_qty: row.get(5)?,
            unit_cost: row.get(6)?,
            expiry_date: row.get(7)?,
            days_remaining: row.get(8)?,
            potential_loss: row.get(9)?,
            status: row.get(10)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(CommandError::from)
}

/// Report 7: Supplier Purchase History (REPT-09)
pub fn get_supplier_purchases(
    db: &Connection,
    start: &str,
    end: &str,
) -> Result<Vec<SupplierPurchaseRow>, CommandError> {
    let mut stmt = db.prepare(
        "SELECT
            s.id as supplier_id,
            s.company_name,
            COUNT(DISTINCT p.id) as purchase_count,
            COUNT(pi.id) as item_count,
            COALESCE(SUM(p.total_cost), 0) as total_spent,
            CASE WHEN COUNT(DISTINCT p.id) > 0 THEN COALESCE(AVG(p.total_cost), 0) ELSE 0 END as avg_order_value,
            MAX(p.purchase_date) as last_purchase_date
        FROM suppliers s
        LEFT JOIN purchases p ON p.supplier_id = s.id
            AND (p.purchase_date >= ?1 AND p.purchase_date <= ?2)
        LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
        WHERE s.is_active = 1
        GROUP BY s.id
        ORDER BY total_spent DESC",
    )?;

    let rows = stmt.query_map(rusqlite::params![start, end], |row| {
        Ok(SupplierPurchaseRow {
            supplier_id: row.get(0)?,
            company_name: row.get(1)?,
            purchase_count: row.get(2)?,
            item_count: row.get(3)?,
            total_spent: row.get(4)?,
            avg_order_value: row.get(5)?,
            last_purchase_date: row.get(6)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(CommandError::from)
}

/// Report 8: Sales by User (REPT-10)
pub fn get_sales_by_user(
    db: &Connection,
    start: &str,
    end: &str,
) -> Result<Vec<SalesByUserRow>, CommandError> {
    let mut stmt = db.prepare(
        "SELECT
            u.id as user_id,
            u.full_name,
            u.role,
            COUNT(DISTINCT s.id) as sale_count,
            COUNT(si.id) as item_count,
            COALESCE(SUM(si.line_total), 0) as total_sales,
            COALESCE(SUM(si.line_total - (si.purchase_cost * si.quantity)), 0) as total_profit,
            CASE WHEN COUNT(DISTINCT s.id) > 0
                THEN COALESCE(AVG(si.line_total - (si.purchase_cost * si.quantity)), 0)
                ELSE 0
            END as avg_profit_per_sale
        FROM users u
        LEFT JOIN sales s ON s.user_id = u.id
            AND date(s.created_at) >= ?1 AND date(s.created_at) <= ?2
        LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE u.is_active = 1
        GROUP BY u.id
        ORDER BY total_sales DESC",
    )?;

    let rows = stmt.query_map(rusqlite::params![start, end], |row| {
        Ok(SalesByUserRow {
            user_id: row.get(0)?,
            full_name: row.get(1)?,
            role: row.get(2)?,
            sale_count: row.get(3)?,
            item_count: row.get(4)?,
            total_sales: row.get(5)?,
            total_profit: row.get(6)?,
            avg_profit_per_sale: row.get(7)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(CommandError::from)
}

/// Report 9: Profit Margin (REPT-11)
pub fn get_profit_margin(
    db: &Connection,
    start: &str,
    end: &str,
) -> Result<Vec<ProfitMarginRow>, CommandError> {
    let mut stmt = db.prepare(
        "SELECT
            m.id as medicine_id,
            m.name as medicine_name,
            m.category,
            COUNT(si.id) as times_sold,
            COALESCE(SUM(si.quantity), 0) as total_qty,
            COALESCE(AVG(si.unit_price), 0) as avg_sell_price,
            COALESCE(AVG(si.purchase_cost), 0) as avg_cost,
            COALESCE(AVG(si.unit_price - si.purchase_cost), 0) as avg_margin_per_unit,
            CASE WHEN COALESCE(AVG(si.purchase_cost), 0) > 0
                THEN ROUND(((AVG(si.unit_price) - AVG(si.purchase_cost)) / AVG(si.purchase_cost)) * 100, 1)
                ELSE 0
            END as margin_pct,
            COALESCE(SUM(si.line_total - (si.purchase_cost * si.quantity)), 0) as total_profit
        FROM sale_items si
        JOIN medicines m ON m.id = si.medicine_id
        JOIN sales s ON s.id = si.sale_id
        WHERE date(s.created_at) >= ?1 AND date(s.created_at) <= ?2
        GROUP BY m.id
        ORDER BY margin_pct DESC",
    )?;

    let rows = stmt.query_map(rusqlite::params![start, end], |row| {
        Ok(ProfitMarginRow {
            medicine_id: row.get(0)?,
            medicine_name: row.get(1)?,
            category: row.get(2)?,
            times_sold: row.get(3)?,
            total_qty: row.get::<_, i64>(4)?,
            avg_sell_price: row.get(5)?,
            avg_cost: row.get(6)?,
            avg_margin_per_unit: row.get(7)?,
            margin_pct: row.get(8)?,
            total_profit: row.get(9)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(CommandError::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers;

    /// Regression test for the Expiry Report SQL — ensures the query joins
    /// purchase_items correctly and selects valid columns from batches.
    #[test]
    fn test_expiry_report_runs_with_empty_db() {
        let db = test_helpers::setup_test_db();
        let rows = get_expiry_report(&db, 60, 30).expect("expiry report should not error");
        assert!(rows.is_empty(), "fresh DB should have no batches");
    }

    /// Regression test — with a seeded medicine and batch, the query must
    /// return the batch row (and not crash on the batch_code column lookup).
    #[test]
    fn test_expiry_report_returns_seeded_batch() {
        let db = test_helpers::setup_test_db();
        let med_id = test_helpers::seed_medicine(&db, "Paracetamol");

        // Insert a batch directly (no purchase/purchase_items needed for the
        // report SQL test — only batches + medicines are joined).
        db.execute(
            "INSERT INTO batches (medicine_id, purchase_id, purchase_item_id, purchase_price, quantity, remaining_qty, expiry_date, batch_code) \
             VALUES (?1, NULL, NULL, ?2, ?3, ?4, date('now', '-10 days'), 'BATCH-001')",
            rusqlite::params![med_id, 5.0, 50, 50],
        )
        .unwrap();

        let rows = get_expiry_report(&db, 60, 30).expect("expiry report should not error");
        assert_eq!(rows.len(), 1, "should return the one expired batch");
        assert_eq!(rows[0].medicine_name, "Paracetamol");
        assert_eq!(rows[0].batch_code.as_deref(), Some("BATCH-001"));
        assert_eq!(rows[0].status, "expired");
    }

    /// Regression test — opening-stock batches (no purchase_id) should still
    /// appear in the report with batch_code as a string.
    #[test]
    fn test_expiry_report_includes_opening_stock_batches() {
        let db = test_helpers::setup_test_db();
        let med_id = test_helpers::seed_medicine(&db, "Opening Stock Med");

        db.execute(
            "INSERT INTO batches (medicine_id, purchase_id, purchase_item_id, purchase_price, quantity, remaining_qty, expiry_date, batch_code) \
             VALUES (?1, NULL, NULL, ?2, ?3, ?4, date('now', '+5 days'), 'OPEN-001')",
            rusqlite::params![med_id, 5.0, 10, 10],
        )
        .unwrap();

        let rows = get_expiry_report(&db, 60, 30).expect("expiry report should not error");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].batch_code.as_deref(), Some("OPEN-001"));
        // 5 days remaining is within critical window (30) and warning window (60)
        assert_eq!(rows[0].status, "critical");
    }
}
