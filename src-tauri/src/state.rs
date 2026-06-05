use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::models::StoredSession;

/// Application state registered in Tauri's State<> system.
///
/// - `db`: Mutex-wrapped rusqlite Connection for single-user desktop access.
/// - `sessions`: In-memory HashMap of active sessions keyed by token UUID.
///
/// Lock ordering (db first, sessions second) must be consistent
/// across all command handlers to prevent deadlocks.
pub struct AppState {
    pub db: Mutex<Connection>,
    pub sessions: Mutex<HashMap<String, StoredSession>>,
}
