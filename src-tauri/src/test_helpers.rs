use rusqlite::Connection;

use crate::migrations;

/// Creates an in-memory SQLite database with all migrations applied.
/// Used by all service-level tests.
pub fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA busy_timeout=5000;",
    )
    .expect("Failed to set PRAGMAs");
    migrations::get_migrations()
        .to_latest(&mut conn)
        .expect("Failed to run migrations");
    conn
}

/// Seeds a test owner user into the database.
pub fn seed_owner(conn: &Connection) -> i64 {
    let hash = bcrypt::hash("password123", 4).unwrap();
    conn.execute(
        "INSERT INTO users (full_name, username, password_hash, role) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params!["Test Owner", "owner", &hash, "owner"],
    )
    .expect("Failed to seed owner");
    conn.last_insert_rowid()
}

/// Seeds a test pharmacist user.
pub fn seed_pharmacist(conn: &Connection) -> i64 {
    let hash = bcrypt::hash("password123", 4).unwrap();
    conn.execute(
        "INSERT INTO users (full_name, username, password_hash, role) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params!["Test Pharmacist", "pharmacist", &hash, "pharmacist"],
    )
    .expect("Failed to seed pharmacist");
    conn.last_insert_rowid()
}

/// Seeds a test medicine and returns its id.
pub fn seed_medicine(conn: &Connection, name: &str) -> i64 {
    conn.execute(
        "INSERT INTO medicines (name, category, unit, retail_price, purchase_price) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![name, "Tablet", "Strip", 10.0, 5.0],
    )
    .expect("Failed to seed medicine");
    conn.last_insert_rowid()
}

/// Seeds a supplier and returns its id.
pub fn seed_supplier(conn: &Connection, name: &str) -> i64 {
    conn.execute(
        "INSERT INTO suppliers (company_name, contact_person, phone) VALUES (?1, ?2, ?3)",
        rusqlite::params![name, "Contact", "1234567890"],
    )
    .expect("Failed to seed supplier");
    conn.last_insert_rowid()
}
