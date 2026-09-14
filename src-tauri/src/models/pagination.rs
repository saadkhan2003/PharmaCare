use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PaginatedList<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

impl<T> PaginatedList<T> {
    pub fn new(items: Vec<T>, total: i64, page: i64, per_page: i64) -> Self {
        let total_pages = if per_page > 0 { (total + per_page - 1) / per_page } else { 0 };
        PaginatedList { items, total, page, per_page, total_pages }
    }
}
