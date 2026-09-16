use std::path::PathBuf;
use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

fn get_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../../migrations/001_initial/up.sql")),
        M::up(include_str!("../../migrations/002_medicine_catalog/up.sql")),
        M::up(include_str!("../../migrations/003_sales_engine/up.sql")),
        M::up(include_str!("../../migrations/004_returns/up.sql")),
        M::up(include_str!("../../migrations/005_opening_stock/up.sql")),
        M::up(include_str!("../../migrations/006_debt_tracking/up.sql")),
        M::up(include_str!("../../migrations/007_add_batch_code/up.sql")),
        M::up(include_str!("../../migrations/008_fix_batch_fk/up.sql")),
        M::up(include_str!("../../migrations/009_supplier_debts/up.sql")),
        M::up(include_str!("../../migrations/010_speed_indexes/up.sql")),
    ])
}

fn resolve_db_path() -> PathBuf {
    if let Some(arg) = std::env::args().nth(1) {
        return PathBuf::from(arg);
    }
    if let Ok(env_path) = std::env::var("PHARMACARE_DB_PATH") {
        return PathBuf::from(env_path);
    }
    if let Some(home) = std::env::var_os("HOME") {
        let mut p = PathBuf::from(home);
        p.push(".local/share/com.pharmacare.app/pharmacare.db");
        return p;
    }
    PathBuf::from("pharmacare.db")
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db_path = resolve_db_path();
    println!(">>> Target SQLite database: {:?}", db_path);

    // 1. Remove existing database files
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(format!("{}-wal", db_path.display()));
    let _ = std::fs::remove_file(format!("{}-shm", db_path.display()));
    println!(">>> Cleared previous database and WAL files.");

    // 2. Open connection & PRAGMAs
    let mut conn = Connection::open(&db_path)?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA busy_timeout=5000;
         PRAGMA synchronous=NORMAL;",
    )?;

    // 3. Apply all migrations
    let migrations = get_migrations();
    migrations.to_latest(&mut conn)?;
    println!(">>> Applied all 10 schema migrations.");

    // 4. Seed Users
    let admin_hash = bcrypt::hash("admin123", 4)?;
    let owner_hash = bcrypt::hash("password123", 4)?;
    let pharm_hash = bcrypt::hash("pharmacist123", 4)?;

    conn.execute(
        "INSERT INTO users (full_name, username, password_hash, role, is_active) VALUES (?1, ?2, ?3, ?4, 1)",
        rusqlite::params!["Dr. Saad Khan (Owner)", "admin", &admin_hash, "owner"],
    )?;
    let owner_id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO users (full_name, username, password_hash, role, is_active) VALUES (?1, ?2, ?3, ?4, 1)",
        rusqlite::params!["PharmaCare Owner", "owner", &owner_hash, "owner"],
    )?;

    conn.execute(
        "INSERT INTO users (full_name, username, password_hash, role, is_active) VALUES (?1, ?2, ?3, ?4, 1)",
        rusqlite::params!["Ali Raza (Pharmacist)", "pharmacist", &pharm_hash, "pharmacist"],
    )?;
    let pharmacist_id = conn.last_insert_rowid();
    println!(">>> Seeded users: admin/admin123, owner/password123, pharmacist/pharmacist123");

    // 5. Seed Settings
    let settings = [
        ("setup_complete", "true"),
        ("pharmacy_name", "PharmaCare Health Solutions"),
        ("owner_name", "Dr. Saad Khan"),
        ("owner_email", "admin@pharmacare.org"),
        ("phone", "+92 300 1234567"),
        ("address", "Main Boulevard, DHA Phase 5, Lahore"),
        ("currency_symbol", "Rs."),
        ("default_tax_rate", "5.0"),
        ("cashier_discount_enabled", "true"),
        ("expiry_warning_days", "60"),
        ("expiry_critical_days", "30"),
        ("default_reorder_level", "15"),
    ];
    for (k, v) in settings {
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![k, v],
        )?;
    }
    println!(">>> Seeded pharmacy settings and configuration.");

    // 6. Seed Suppliers
    let suppliers = [
        ("GSK Pakistan Ltd", "Tariq Mehmood", "0300-8412345", "Korangi Industrial Area, Karachi", "Net 30"),
        ("Abbott Laboratories", "Salman Farooq", "0321-9876543", "Landhi, Karachi", "Net 15"),
        ("Sami Pharmaceuticals", "Imran Hashmi", "0333-5551234", "F-23 Site, Karachi", "Net 30"),
        ("Getz Pharma", "Kashif Javed", "0312-4445566", "29-30/27, Korangi, Karachi", "Net 45"),
        ("Novartis Pharma Pakistan", "Asim Munir", "0345-7778899", "Gulberg III, Lahore", "Net 30"),
    ];

    for (comp, contact, phone, addr, terms) in suppliers {
        conn.execute(
            "INSERT INTO suppliers (company_name, contact_person, phone, address, payment_terms, is_active) VALUES (?1, ?2, ?3, ?4, ?5, 1)",
            rusqlite::params![comp, contact, phone, addr, terms],
        )?;
    }
    println!(">>> Seeded 5 pharmaceutical suppliers.");

    // 7. Seed Medicines & Batches
    // Format: (name, generic, brand, category, unit, retail_price, purchase_price, reorder_level, shelf, stock, expiry_offset_days)
    let medicines = [
        ("Panadol 500mg", "Paracetamol", "GSK", "Tablet", "Strip", 35.0, 25.0, 20, "A1-01", 120, 720),
        ("Panadol Extra", "Paracetamol + Caffeine", "GSK", "Tablet", "Strip", 50.0, 38.0, 20, "A1-02", 90, 680),
        ("Brufen 400mg", "Ibuprofen", "Abbott", "Tablet", "Strip", 45.0, 32.0, 25, "A1-03", 85, 600),
        ("Augmentin 625mg", "Co-Amoxiclav", "GSK", "Tablet", "Strip", 280.0, 210.0, 20, "A2-01", 4, 360), // Low stock demo!
        ("Arinac Forte", "Ibuprofen + Pseudoephedrine", "Abbott", "Tablet", "Strip", 65.0, 48.0, 20, "A2-02", 75, 540),
        ("Disprin 300mg", "Aspirin", "Reckitt", "Tablet", "Strip", 25.0, 18.0, 15, "A2-03", 150, 800),
        ("Nexium 40mg", "Esomeprazole", "AstraZeneca", "Tablet", "Strip", 320.0, 240.0, 15, "B1-01", 60, 500),
        ("Omepral 20mg", "Omeprazole", "Sami", "Tablet", "Strip", 95.0, 70.0, 15, "B1-02", 110, 650),
        ("Lipitor 20mg", "Atorvastatin", "Pfizer", "Tablet", "Strip", 380.0, 290.0, 15, "B2-01", 3, 400), // Low stock demo!
        ("Concor 5mg", "Bisoprolol", "Merck", "Tablet", "Strip", 185.0, 140.0, 15, "B2-02", 45, 520),
        ("Glucophage 500mg", "Metformin", "Merck", "Tablet", "Strip", 75.0, 55.0, 20, "B3-01", 140, 700),
        ("Softin 10mg", "Loratadine", "Sami", "Tablet", "Strip", 85.0, 62.0, 15, "B3-02", 5, 480), // Low stock demo!
        ("Flagyl 400mg", "Metronidazole", "Sanofi", "Tablet", "Strip", 40.0, 28.0, 20, "A3-01", 95, 620),
        ("Ciproxin 500mg", "Ciprofloxacin", "Bayer", "Tablet", "Strip", 220.0, 165.0, 15, "A3-02", 55, 580),
        ("Zyrtec 10mg", "Cetirizine", "GSK", "Tablet", "Strip", 90.0, 68.0, 15, "A3-03", 80, 600),

        // Syrups
        ("Calpol Suspension", "Paracetamol", "GSK", "Syrup", "Bottle", 95.0, 72.0, 15, "S1-01", 40, 18), // Critical Expiry (<30 days)!
        ("Hydryllin Syrup", "Aminophylline Compound", "Searle", "Syrup", "Bottle", 110.0, 85.0, 20, "S1-02", 55, 450),
        ("Brufen Syrup 120ml", "Ibuprofen", "Abbott", "Syrup", "Bottle", 105.0, 80.0, 15, "S1-03", 60, 500),
        ("Cac-1000 Plus", "Calcium + Vitamin C", "GSK", "Syrup", "Bottle", 220.0, 170.0, 10, "S2-01", 35, 380),
        ("Gravinate Syrup", "Dimenhydrinate", "Searle", "Syrup", "Bottle", 80.0, 60.0, 15, "S2-02", 30, 48), // Warning Expiry (<60 days)!
        ("Sancos Syrup", "Dextromethorphan", "Novartis", "Syrup", "Bottle", 130.0, 98.0, 15, "S2-03", 50, 420),

        // Injections
        ("Toradol 30mg/ml", "Ketorolac", "Roche", "Injection", "Vial", 140.0, 105.0, 10, "INJ-01", 30, 400),
        ("Rocephin 1g", "Ceftriaxone", "Roche", "Injection", "Vial", 450.0, 350.0, 10, "INJ-02", 25, 450),
        ("Dicloran 75mg", "Diclofenac Sodium", "Sami", "Injection", "Vial", 60.0, 42.0, 20, "INJ-03", 60, 500),

        // OTC
        ("Strepsils Honey & Lemon", "Amylmetacresol", "Reckitt", "OTC", "Box", 180.0, 135.0, 15, "OTC-01", 50, 52), // Warning Expiry (<60 days)!
        ("Dettol Antiseptic 250ml", "Chloroxylenol", "Reckitt", "OTC", "Bottle", 290.0, 220.0, 10, "OTC-02", 40, 750),
        ("Polyfax Skin Ointment", "Polymyxin B + Bacitracin", "GSK", "OTC", "Box", 75.0, 55.0, 25, "OTC-03", 100, 650),
        ("Voltral Emulgel 20g", "Diclofenac Diethylamine", "Novartis", "OTC", "Box", 160.0, 120.0, 15, "OTC-04", 45, 580),
        ("ORS Sachet Lemon", "Oral Rehydration Salts", "Searle", "OTC", "Sachet", 20.0, 14.0, 50, "OTC-05", 250, 800),

        // Prescription
        ("Rivotril 2mg", "Clonazepam", "Roche", "Prescription", "Strip", 160.0, 115.0, 10, "RX-01", 40, 550),
        ("Lexotanil 3mg", "Bromazepam", "Roche", "Prescription", "Strip", 190.0, 140.0, 10, "RX-02", 35, 600),
    ];

    let today = chrono::Utc::now();

    for (name, generic, brand, cat, unit, ret_price, pur_price, reorder, shelf, stock, offset_days) in medicines {
        conn.execute(
            "INSERT INTO medicines (name, generic_name, brand_name, category, unit, retail_price, purchase_price, reorder_level, shelf_location, is_active)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1)",
            rusqlite::params![name, generic, brand, cat, unit, ret_price, pur_price, reorder, shelf],
        )?;
        let med_id = conn.last_insert_rowid();

        let expiry = today + chrono::Duration::days(offset_days);
        let expiry_str = expiry.format("%Y-%m-%d").to_string();
        let batch_code = format!("BATCH-{:04}", med_id * 17);

        conn.execute(
            "INSERT INTO batches (medicine_id, batch_code, purchase_price, expiry_date, quantity, remaining_qty)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![med_id, batch_code, pur_price, expiry_str, stock, stock],
        )?;
        let batch_id = conn.last_insert_rowid();

        // Record stock movement for opening stock
        conn.execute(
            "INSERT INTO stock_movements (movement_type, medicine_id, batch_id, quantity_delta, reference_type, user_id)
             VALUES ('opening_stock', ?1, ?2, ?3, 'opening_stock', ?4)",
            rusqlite::params![med_id, batch_id, stock, owner_id],
        )?;
    }
    println!(">>> Seeded 31 medicines with batches (including Low Stock & Expiry alert batches).");

    // 8. Seed Purchases & Supplier Debts
    // Purchase 1: GSK (Paid)
    let p1_date = (today - chrono::Duration::days(12)).format("%Y-%m-%d").to_string();
    conn.execute(
        "INSERT INTO purchases (supplier_id, invoice_number, purchase_date, total_cost, payment_status, notes, user_id)
         VALUES (1, 'INV-GSK-2026-01', ?1, 14500.0, 'Paid', 'Delivered by GSK cold chain transport', ?2)",
        rusqlite::params![p1_date, owner_id],
    )?;
    let p1_id = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO purchase_items (purchase_id, medicine_id, quantity, purchase_price, expiry_date, line_cost)
         VALUES (?1, 1, 300, 25.0, '2028-06-30', 7500.0), (?1, 4, 30, 210.0, '2027-12-31', 6300.0), (?1, 19, 4, 170.0, '2027-09-30', 680.0)",
        rusqlite::params![p1_id],
    )?;

    // Purchase 2: Abbott (Partial - Rs. 10,000 paid of Rs. 28,000)
    let p2_date = (today - chrono::Duration::days(5)).format("%Y-%m-%d").to_string();
    let p2_due = (today + chrono::Duration::days(20)).format("%Y-%m-%d").to_string();
    conn.execute(
        "INSERT INTO purchases (supplier_id, invoice_number, purchase_date, total_cost, payment_status, notes, user_id)
         VALUES (2, 'INV-ABT-2026-88', ?1, 28000.0, 'Partial', 'Remaining Rs. 18,000 due in 20 days', ?2)",
        rusqlite::params![p2_date, owner_id],
    )?;
    let p2_id = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO purchase_items (purchase_id, medicine_id, quantity, purchase_price, expiry_date, line_cost)
         VALUES (?1, 3, 500, 32.0, '2028-04-30', 16000.0), (?1, 5, 250, 48.0, '2027-11-30', 12000.0)",
        rusqlite::params![p2_id],
    )?;
    conn.execute(
        "INSERT INTO supplier_debts (purchase_id, supplier_id, total_amount, paid_amount, status, due_date, notes)
         VALUES (?1, 2, 28000.0, 10000.0, 'Partial', ?2, 'Invoice INV-ABT-2026-88 partial payment')",
        rusqlite::params![p2_id, p2_due],
    )?;

    // Purchase 3: Getz Pharma (Pending - Rs. 16,500 full pending)
    let p3_date = (today - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    let p3_due = (today + chrono::Duration::days(30)).format("%Y-%m-%d").to_string();
    conn.execute(
        "INSERT INTO purchases (supplier_id, invoice_number, purchase_date, total_cost, payment_status, notes, user_id)
         VALUES (4, 'INV-GTZ-2026-104', ?1, 16500.0, 'Pending', 'Invoice due on Net 30 terms', ?2)",
        rusqlite::params![p3_date, owner_id],
    )?;
    let p3_id = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO supplier_debts (purchase_id, supplier_id, total_amount, paid_amount, status, due_date, notes)
         VALUES (?1, 4, 16500.0, 0.0, 'Pending', ?2, 'Invoice INV-GTZ-2026-104 pending')",
        rusqlite::params![p3_id, p3_due],
    )?;
    println!(">>> Seeded 3 purchases with supplier debts.");

    // 9. Seed 7 Days of Sales History for rich Charts and Reports
    for day_offset in (0..=6).rev() {
        let sale_time = today - chrono::Duration::days(day_offset);
        let date_str = sale_time.format("%Y-%m-%d %H:%M:%S").to_string();

        // 3 to 5 sales per day
        let num_sales = match day_offset {
            0 => 4,
            1 => 6,
            2 => 5,
            3 => 4,
            4 => 5,
            5 => 4,
            _ => 3,
        };

        for s_idx in 0..num_sales {
            let payment_method = match (day_offset, s_idx) {
                (0, 3) => "Credit",
                (_, 0) => "Card",
                _ => "Cash",
            };
            let customer_name = if payment_method == "Credit" {
                Some("Haji Muhammad Aslam")
            } else if s_idx % 2 == 0 {
                Some("Walk-in Patient")
            } else {
                None
            };

            let subtotal = 1200.0 + (s_idx as f64 * 350.0) + (day_offset as f64 * 180.0);
            let bill_discount = if s_idx == 1 { 50.0 } else { 0.0 };
            let tax_rate = 5.0;
            let tax_amount = (subtotal - bill_discount) * 0.05;
            let total = subtotal - bill_discount + tax_amount;

            conn.execute(
                "INSERT INTO sales (user_id, subtotal, bill_discount, tax_rate, tax_amount, total, payment_method, customer_name, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                rusqlite::params![pharmacist_id, subtotal, bill_discount, tax_rate, tax_amount, total, payment_method, customer_name, date_str],
            )?;
            let sale_id = conn.last_insert_rowid();

            // Insert 2 sale items
            conn.execute(
                "INSERT INTO sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, purchase_cost, item_discount, line_total)
                 VALUES (?1, 1, 1, 10, 35.0, 25.0, 0.0, 350.0),
                        (?1, 3, 3, 5, 45.0, 32.0, 0.0, 225.0)",
                rusqlite::params![sale_id],
            )?;

            // If Credit sale, link into debtors
            if payment_method == "Credit" {
                let credit_due = (today + chrono::Duration::days(30)).format("%Y-%m-%d").to_string();
                conn.execute(
                    "INSERT INTO debtors (customer_name, phone, total_amount, paid_amount, due_date, notes, status, created_at)
                     VALUES (?1, '0301-4455667', ?2, 0.0, ?3, 'Auto-generated from POS Credit Sale', 'pending', ?4)",
                    rusqlite::params![customer_name, total, credit_due, date_str],
                )?;
                let debt_id = conn.last_insert_rowid();
                conn.execute(
                    "INSERT INTO debt_items (debt_id, sale_id, medicine_name, quantity, amount)
                     VALUES (?1, ?2, 'Panadol 500mg', 10, 350.0), (?1, ?2, 'Brufen 400mg', 5, 225.0)",
                    rusqlite::params![debt_id, sale_id],
                )?;
            }
        }
    }
    println!(">>> Seeded 7 days of sales history with Cash, Card, and Credit transactions.");

    // 10. Seed Customer Debts (Pending, Overdue, and Paid)
    let past_due = (today - chrono::Duration::days(8)).format("%Y-%m-%d").to_string();
    let future_due = (today + chrono::Duration::days(14)).format("%Y-%m-%d").to_string();

    // Pending Debt
    conn.execute(
        "INSERT INTO debtors (customer_name, phone, total_amount, paid_amount, due_date, notes, status)
         VALUES ('Malik Tariq', '0322-9988771', 4500.0, 1500.0, ?1, 'Regular customer - partial payment received', 'pending')",
        rusqlite::params![future_due],
    )?;
    let d2 = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO debt_items (debt_id, medicine_name, quantity, amount)
         VALUES (?1, 'Nexium 40mg', 10, 3200.0), (?1, 'Disprin 300mg', 20, 500.0)",
        rusqlite::params![d2],
    )?;

    // Overdue Debt (Demonstrates overdue badge alert!)
    conn.execute(
        "INSERT INTO debtors (customer_name, phone, total_amount, paid_amount, due_date, notes, status)
         VALUES ('Sheikh Zahid', '0333-1122334', 3200.0, 0.0, ?1, 'Overdue payment - reminder call made', 'overdue')",
        rusqlite::params![past_due],
    )?;
    let d3 = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO debt_items (debt_id, medicine_name, quantity, amount)
         VALUES (?1, 'Augmentin 625mg', 8, 2240.0), (?1, 'Arinac Forte', 10, 650.0)",
        rusqlite::params![d3],
    )?;

    // Paid Debt
    conn.execute(
        "INSERT INTO debtors (customer_name, phone, total_amount, paid_amount, due_date, notes, status)
         VALUES ('Chaudhry Naveed', '0300-5566778', 1800.0, 1800.0, ?1, 'Fully settled in cash', 'paid')",
        rusqlite::params![future_due],
    )?;
    let d4 = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO debt_items (debt_id, medicine_name, quantity, amount)
         VALUES (?1, 'Panadol Extra', 20, 1000.0), (?1, 'Softin 10mg', 10, 800.0)",
        rusqlite::params![d4],
    )?;
    println!(">>> Seeded customer debtors (pending, overdue, and paid).");

    // 11. Seed Customer Return & Write-Off
    let yesterday_str = (today - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    conn.execute(
        "INSERT INTO returns (return_type, reference_id, medicine_id, batch_id, quantity, refund_amount, reason, processed_by, return_date)
         VALUES ('customer', 1, 21, 21, 1, 130.0, 'Customer bought wrong syrup sealed pack', ?1, ?2)",
        rusqlite::params![pharmacist_id, yesterday_str],
    )?;

    conn.execute(
        "INSERT INTO returns (return_type, reference_id, medicine_id, batch_id, quantity, refund_amount, reason, processed_by, return_date)
         VALUES ('write_off', NULL, 22, 22, 2, 210.0, 'Accidental vial breakage during stock audit', ?1, ?2)",
        rusqlite::params![owner_id, yesterday_str],
    )?;
    println!(">>> Seeded return and write-off records.");

    println!("\n========================================================");
    println!("  PHARMACARE FRESH DEMO DATABASE READY!");
    println!("  Location: {:?}", db_path);
    println!("  Login Credentials:");
    println!("    1. Owner:      admin      / admin123");
    println!("    2. Owner alt:  owner      / password123");
    println!("    3. Pharmacist: pharmacist / pharmacist123");
    println!("========================================================\n");

    Ok(())
}
