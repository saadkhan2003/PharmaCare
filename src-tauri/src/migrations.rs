use rusqlite_migration::{Migrations, M};

/// Returns the ordered list of schema migrations for PharmaCare.
///
/// Migrations are executed at app startup in `main.rs` setup.
/// Each migration is embedded at compile time via `include_str!`,
/// preventing SQL injection in DDL.
pub fn get_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../migrations/001_initial/up.sql")),
        M::up(include_str!("../migrations/002_medicine_catalog/up.sql")),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Validates that all migrations are internally consistent
    /// (no duplicate versions, valid SQL syntax).
    #[test]
    fn migrations_are_valid() {
        let m = get_migrations();
        assert!(m.validate().is_ok());
    }
}
