use rusqlite_migration::{Migrations, M};

pub fn get_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../migrations/001_initial/up.sql")),
        M::up(include_str!("../migrations/002_medicine_catalog/up.sql")),
        M::up(include_str!("../migrations/003_sales_engine/up.sql")),
        M::up(include_str!("../migrations/004_returns/up.sql")),
        M::up(include_str!("../migrations/005_opening_stock/up.sql")),
        M::up(include_str!("../migrations/006_debt_tracking/up.sql")),
        M::up(include_str!("../migrations/007_add_batch_code/up.sql")),
        M::up(include_str!("../migrations/008_fix_batch_fk/up.sql")),
    ])
}

pub fn total_migrations() -> i64 {
    8
}
