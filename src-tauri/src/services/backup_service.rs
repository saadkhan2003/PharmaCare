use std::fs;
use std::io::{self, Write, Read};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::Local;
use flate2::{Compression, write::GzEncoder, read::GzDecoder};
use rusqlite::Connection;
use serde_json;

use crate::errors::CommandError;
use crate::models::{BackupFileInfo, BackupResult};
use crate::repository::settings_repo;

/// Number of backups to keep (BAKP-03).
const MAX_KEEP_BACKUPS: usize = 30;

/// Backup file naming prefix.
const BACKUP_PREFIX: &str = "pharmaCare_backup_";

// ── Core Backup Operations ──

/// Creates an atomic VACUUM INTO snapshot, gzips it, returns path to .gz file.
/// The snapshot is created in the app's temp directory.
/// Per D-66 (VACUUM INTO) and D-67 (gzip + naming convention).
pub fn create_snapshot(db: &Connection, backup_dir: &Path) -> Result<PathBuf, CommandError> {
    let date_str = Local::now().format("%Y-%m-%d").to_string();
    let db_name = format!("{}{}.db", BACKUP_PREFIX, date_str);
    let gz_name = format!("{}{}.db.gz", BACKUP_PREFIX, date_str);

    let db_path = backup_dir.join(&db_name);
    let gz_path = backup_dir.join(&gz_name);

    // Step 1: VACUUM INTO creates atomic snapshot (D-66)
    // Safety: path is constructed from a safe backup_dir, not user input
    let vacuum_path_str = db_path.to_string_lossy().replace("'", "''");
    let vacuum_sql = format!("VACUUM INTO '{}'", vacuum_path_str);
    db.execute_batch(&vacuum_sql)?;

    // Step 2: Gzip compress (D-67)
    let mut snapshot_file = fs::File::open(&db_path)?;
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    io::copy(&mut snapshot_file, &mut encoder)?;
    let compressed = encoder.finish()?;

    let mut gz_file = fs::File::create(&gz_path)?;
    gz_file.write_all(&compressed)?;

    // Step 3: Remove uncompressed snapshot
    fs::remove_file(&db_path)?;

    Ok(gz_path)
}

/// Uploads gzip file to Google Drive via HTTP multipart POST (D-67).
pub fn upload_to_drive(file_path: &Path, access_token: &str, file_name: &str) -> Result<(), CommandError> {
    let file_content = fs::read(file_path)?;

    let metadata = serde_json::json!({
        "name": file_name,
        "mimeType": "application/gzip"
    });

    let part_meta = reqwest::blocking::multipart::Part::text(metadata.to_string())
        .mime_str("application/json")
        .map_err(|e| CommandError::internal(&format!("Failed to create metadata part: {}", e)))?;

    let part_file = reqwest::blocking::multipart::Part::bytes(file_content)
        .file_name(file_name.to_string())
        .mime_str("application/gzip")
        .map_err(|e| CommandError::internal(&format!("Failed to create file part: {}", e)))?;

    let form = reqwest::blocking::multipart::Form::new()
        .part("metadata", part_meta)
        .part("file", part_file);

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| CommandError::internal(&format!("Failed to build HTTP client: {}", e)))?;

    let resp = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .header("Authorization", format!("Bearer {}", access_token))
        .multipart(form)
        .send()
        .map_err(|e| CommandError::internal(&format!("Drive upload request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(CommandError::internal(
            &format!("Drive upload failed ({}): {}", status, body),
        ));
    }

    Ok(())
}

/// Downloads a file from Google Drive by file ID.
pub fn download_from_drive(file_id: &str, access_token: &str, dest_path: &Path) -> Result<(), CommandError> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| CommandError::internal(&format!("Failed to build HTTP client: {}", e)))?;

    let url = format!("https://www.googleapis.com/drive/v3/files/{}?alt=media", file_id);

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .map_err(|e| CommandError::internal(&format!("Drive download request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(CommandError::internal(
            &format!("Drive download failed ({}): {}", status, body),
        ));
    }

    let bytes = resp
        .bytes()
        .map_err(|e| CommandError::internal(&format!("Failed to read download response: {}", e)))?;

    fs::write(dest_path, &bytes)?;
    Ok(())
}

/// Copies gzip file to local backup path (USB drive per D-69).
pub fn copy_to_local(file_path: &Path, dest_dir: &Path) -> Result<(), CommandError> {
    fs::create_dir_all(dest_dir)?;

    let file_name = file_path
        .file_name()
        .ok_or_else(|| CommandError::internal("Invalid backup file path"))?;

    let dest_path = dest_dir.join(file_name);
    fs::copy(file_path, &dest_path)?;

    Ok(())
}

/// Full backup orchestration: creates snapshot -> gzips -> uploads (or local copy) -> updates settings.
pub fn run_backup(
    db: &Connection,
    settings_db: &Connection,
    should_upload: bool,
    local_path: Option<&Path>,
) -> Result<BackupResult, CommandError> {
    let backup_dir = std::env::temp_dir().join("pharmacare_backups");
    fs::create_dir_all(&backup_dir)?;

    // Create snapshot
    let gz_path = match create_snapshot(db, &backup_dir) {
        Ok(p) => p,
        Err(e) => {
            // Update settings with failure
            let _ = settings_repo::set_value(settings_db, "last_backup_status", &format!("failed: {}", e.message));
            return Err(e);
        }
    };

    let file_name = gz_path
        .file_name()
        .ok_or_else(|| CommandError::internal("Invalid backup filename"))?
        .to_string_lossy()
        .to_string();

    let path_str = gz_path.to_string_lossy().to_string();
    let mut message = String::new();

    // Upload to Drive if configured
    if should_upload {
        match settings_repo::get_string(settings_db, "google_drive_token") {
            Ok(Some(token)) => {
                // Parse token JSON to get access_token
                let token_value: serde_json::Value = serde_json::from_str(&token)
                    .map_err(|e| CommandError::internal(&format!("Failed to parse Drive token: {}", e)))?;

                let access_token = token_value["access_token"]
                    .as_str()
                    .ok_or_else(|| CommandError::internal("Drive token missing access_token"))?
                    .to_string();

                if let Err(e) = upload_to_drive(&gz_path, &access_token, &file_name) {
                    // Try refresh if 401
                    if e.message.contains("401") || e.message.contains("Unauthorized") {
                        if let Err(refresh_err) = try_refresh_token(settings_db, &token_value) {
                            message.push_str(&format!("Token refresh failed: {}. ", refresh_err.message));
                        } else if let Ok(Some(new_token)) = settings_repo::get_string(settings_db, "google_drive_token") {
                            // Retry with refreshed token
                            if let Ok(new_val) = serde_json::from_str::<serde_json::Value>(&new_token) {
                                if let Some(new_at) = new_val["access_token"].as_str().map(|s| s.to_string()) {
                                    if let Err(retry_err) = upload_to_drive(&gz_path, &new_at, &file_name) {
                                        message.push_str(&format!("Drive upload failed after refresh: {}. ", retry_err.message));
                                    } else {
                                        message.push_str("Uploaded to Drive. ");
                                    }
                                }
                            }
                        }
                    } else {
                        message.push_str(&format!("Drive upload failed: {}. ", e.message));
                    }
                } else {
                    message.push_str("Uploaded to Drive. ");
                }
            }
            Ok(None) => {
                message.push_str("Drive not connected. ");
            }
            Err(e) => {
                message.push_str(&format!("Failed to read Drive config: {}. ", e));
            }
        }
    }

    // Copy to local path if configured
    if let Some(local) = local_path {
        match copy_to_local(&gz_path, local) {
            Ok(_) => message.push_str("Copied to local folder."),
            Err(e) => message.push_str(&format!("Local copy failed: {}. ", e.message)),
        }
    }

    // Update settings with success
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let _ = settings_repo::set_value(settings_db, "last_backup_time", &now);
    let _ = settings_repo::set_value(settings_db, "last_backup_status", "success");

    // Cleanup old backups
    let _ = cleanup_old_backups(&backup_dir, MAX_KEEP_BACKUPS);

    Ok(BackupResult {
        success: true,
        message: message.trim().to_string(),
        path: path_str,
    })
}

/// Attempts to refresh an expired access token using the stored refresh_token.
fn try_refresh_token(
    settings_db: &Connection,
    token_value: &serde_json::Value,
) -> Result<(), CommandError> {
    let refresh_token = token_value["refresh_token"]
        .as_str()
        .ok_or_else(|| CommandError::internal("No refresh_token available"))?;

    let client_id = token_value["client_id"]
        .as_str()
        .ok_or_else(|| CommandError::internal("No client_id in token"))?;

    let client_secret = token_value["client_secret"]
        .as_str()
        .ok_or_else(|| CommandError::internal("No client_secret in token"))?;

    let new_token_json = refresh_access_token(client_id, client_secret, refresh_token)?;

    // Merge new token data with existing (preserve refresh_token if not returned)
    let mut merged = token_value.clone();
    let new_data: serde_json::Value = serde_json::from_str(&new_token_json)
        .map_err(|e| CommandError::internal(&format!("Failed to parse new token: {}", e)))?;

    if let Some(obj) = new_data.as_object() {
        for (k, v) in obj {
            merged[k] = v.clone();
        }
    }

    // Re-inject client_id and client_secret for future refreshes
    merged["client_id"] = serde_json::json!(client_id);
    merged["client_secret"] = serde_json::json!(client_secret);

    let merged_str = serde_json::to_string(&merged)
        .map_err(|e| CommandError::internal(&format!("Failed to serialize merged token: {}", e)))?;

    settings_repo::set_value(settings_db, "google_drive_token", &merged_str)?;
    Ok(())
}

// ── Restore Operations ──

/// Decompresses a gzip backup file and returns the path to the decompressed .db file.
fn decompress_backup(gz_path: &Path, dest_dir: &Path) -> Result<PathBuf, CommandError> {
    let gz_file = fs::File::open(gz_path)?;
    let mut decoder = GzDecoder::new(gz_file);
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed)?;

    let db_name = gz_path
        .file_stem()
        .ok_or_else(|| CommandError::internal("Cannot determine backup filename"))?;
    let db_path = dest_dir.join(db_name);

    fs::write(&db_path, &decompressed)?;
    Ok(db_path)
}

/// Validates a SQLite database file by running PRAGMA integrity_check.
fn validate_db(db_path: &Path) -> Result<(), CommandError> {
    let conn = Connection::open(db_path)?;
    let integrity: String = conn.query_row(
        "PRAGMA integrity_check",
        [],
        |row| row.get(0),
    )?;
    if integrity != "ok" {
        return Err(CommandError::internal(
            &format!("Database integrity check failed: {}", integrity),
        ));
    }
    Ok(())
}

/// Restores from a local gzip backup file into the live database.
/// Process:
/// 1. Decompress the .db.gz backup file
/// 2. Validate with PRAGMA integrity_check
/// 3. Create pre-restore backup of current DB (D-68, BAKP-08)
/// 4. Open the restored DB as a new connection and VACUUM INTO the live path
/// This atomically replaces the live database content while the current connection lives.
pub fn restore_from_local(
    db: &Connection,
    file_path: &Path,
    live_db_path: &Path,
    app_dir: &Path,
) -> Result<(), CommandError> {
    let temp_dir = std::env::temp_dir().join("pharmacare_restore");
    fs::create_dir_all(&temp_dir)?;

    // Step 1: Decompress
    let restored_db = decompress_backup(file_path, &temp_dir)?;

    // Step 2: Validate
    validate_db(&restored_db)?;

    // Step 3: Create pre-restore backup (D-68, BAKP-08)
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let pre_restore_name = format!("pharmacare_pre_restore_{}.db", timestamp);
    let pre_restore_path = app_dir.join(&pre_restore_name);
    let pre_restore_sql = format!(
        "VACUUM INTO '{}'",
        pre_restore_path.to_string_lossy().replace("'", "''")
    );
    db.execute_batch(&pre_restore_sql)?;

    // Step 4: Open restored DB and VACUUM INTO the live path
    let restored_conn = Connection::open(&restored_db)?;
    let live_path_str = live_db_path.to_string_lossy().replace("'", "''");
    let swap_sql = format!("VACUUM INTO '{}'", live_path_str);
    restored_conn.execute_batch(&swap_sql)?;

    Ok(())
}

/// Restores from a Google Drive backup: downloads, decompresses, validates, replaces DB.
pub fn restore_from_drive(
    db: &Connection,
    file_id: &str,
    access_token: &str,
    live_db_path: &Path,
    app_dir: &Path,
) -> Result<(), CommandError> {
    let temp_dir = std::env::temp_dir().join("pharmacare_restore");
    fs::create_dir_all(&temp_dir)?;

    // Step 1: Download from Drive
    let gz_path = temp_dir.join("drive_backup.db.gz");
    download_from_drive(file_id, access_token, &gz_path)?;

    // Step 2: Decompress
    let restored_db = decompress_backup(&gz_path, &temp_dir)?;

    // Step 3: Validate
    validate_db(&restored_db)?;

    // Step 4: Create pre-restore backup
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let pre_restore_name = format!("pharmacare_pre_restore_{}.db", timestamp);
    let pre_restore_path = app_dir.join(&pre_restore_name);
    let pre_restore_sql = format!(
        "VACUUM INTO '{}'",
        pre_restore_path.to_string_lossy().replace("'", "''")
    );
    db.execute_batch(&pre_restore_sql)?;

    // Step 5: Open restored DB and VACUUM INTO the live path
    let restored_conn = Connection::open(&restored_db)?;
    let live_path_str = live_db_path.to_string_lossy().replace("'", "''");
    let swap_sql = format!("VACUUM INTO '{}'", live_path_str);
    restored_conn.execute_batch(&swap_sql)?;

    Ok(())
}

// ── Cleanup ──

/// Cleans up backups older than 30 days (BAKP-03).
pub fn cleanup_old_backups(backup_dir: &Path, keep_count: usize) -> Result<(), CommandError> {
    let entries = fs::read_dir(backup_dir)
        .map_err(|_| CommandError::internal("Cannot read backup directory"))?;

    let mut backup_files: Vec<(PathBuf, String)> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with(BACKUP_PREFIX) && name.ends_with(".db.gz") {
                let name_owned = name.to_string();
                backup_files.push((path.clone(), name_owned));
            }
        }
    }

    // Sort by filename (which contains date) ascending — oldest first
    backup_files.sort_by(|a, b| a.1.cmp(&b.1));

    // Remove oldest if over the limit
    if backup_files.len() > keep_count {
        for (path, _) in backup_files.iter().take(backup_files.len() - keep_count) {
            let _ = fs::remove_file(path);
        }
    }

    Ok(())
}

// ── Auto-Backup Scheduling (D-65, BAKP-01) ──

/// Checks if auto-backup is due.
/// Compares current time to configured auto_backup_time and last_backup_time.
pub fn is_backup_due(db: &Connection) -> Result<bool, CommandError> {
    let last_time = settings_repo::get_string(db, "last_backup_time")?;
    let auto_time_str = settings_repo::get_string(db, "auto_backup_time")?
        .unwrap_or_else(|| "23:00".to_string());

    let now = Local::now();
    let today = now.format("%Y-%m-%d").to_string();

    // Parse configured backup time
    let auto_time = chrono::NaiveTime::parse_from_str(&auto_time_str, "%H:%M")
        .unwrap_or(chrono::NaiveTime::from_hms_opt(23, 0, 0).unwrap());

    // If last backup was today, skip
    if let Some(ref last) = last_time {
        if last.starts_with(&today) {
            return Ok(false);
        }
    }

    // If current time >= configured time, backup is due
    Ok(now.time() >= auto_time)
}

/// Periodically checks if backup is due. Runs in a background thread.
/// Checks every 60 seconds.
pub fn start_backup_timer(_app: tauri::AppHandle, db: Arc<Mutex<Connection>>) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(60));

            let should_backup = {
                let conn = match db.lock() {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                match is_backup_due(&conn) {
                    Ok(true) => true,
                    _ => false,
                }
            };

            if should_backup {
                let conn = match db.lock() {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let drive_token = settings_repo::get_string(&conn, "google_drive_token")
                    .ok()
                    .flatten();
                let local_path = settings_repo::get_string(&conn, "local_backup_path")
                    .ok()
                    .flatten()
                    .filter(|p| !p.is_empty())
                    .map(|p| PathBuf::from(p));

                if let Err(e) = run_backup(
                    &conn,
                    &conn,
                    drive_token.is_some(),
                    local_path.as_deref(),
                ) {
                    eprintln!("Auto-backup failed: {}", e.message);
                    let _ = settings_repo::set_value(
                        &conn,
                        "last_backup_status",
                        &format!("auto-backup failed: {}", e.message),
                    );
                }
            }
        }
    });
}

// ── OAuth Flow (Pattern 6) ──

/// Generates a random OAuth state parameter using UUID v4.
fn generate_state() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Exchanges authorization code for tokens via POST to Google OAuth endpoint.
pub fn exchange_code_for_token(
    client_id: &str,
    client_secret: &str,
    code: &str,
    redirect_uri: &str,
) -> Result<String, CommandError> {
    let client = reqwest::blocking::Client::new();

    let params = [
        ("code", code),
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code"),
    ];

    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .map_err(|e| CommandError::internal(&format!("Token exchange request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(CommandError::internal(
            &format!("Token exchange failed ({}): {}", status, body),
        ));
    }

    let token_json = resp
        .text()
        .map_err(|e| CommandError::internal(&format!("Failed to read token response: {}", e)))?;

    Ok(token_json)
}

/// Refreshes an expired access_token using the stored refresh_token.
pub fn refresh_access_token(
    client_id: &str,
    client_secret: &str,
    refresh_token: &str,
) -> Result<String, CommandError> {
    let client = reqwest::blocking::Client::new();

    let params = [
        ("refresh_token", refresh_token),
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("grant_type", "refresh_token"),
    ];

    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .map_err(|e| CommandError::internal(&format!("Token refresh request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(CommandError::internal(
            &format!("Token refresh failed ({}): {}", status, body),
        ));
    }

    let token_json = resp
        .text()
        .map_err(|e| CommandError::internal(&format!("Failed to read refresh response: {}", e)))?;

    Ok(token_json)
}

/// Lists backup files in Drive folder (names matching pharmaCare_backup_*).
pub fn list_drive_backups(access_token: &str) -> Result<Vec<BackupFileInfo>, CommandError> {
    let client = reqwest::blocking::Client::new();

    let query = urlencode(&format!("name contains '{}'", BACKUP_PREFIX));
    let url = format!(
        "https://www.googleapis.com/drive/v3/files?q={}&fields=files(id,name,createdTime)&orderBy=createdTime desc",
        query
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .map_err(|e| CommandError::internal(&format!("Drive list request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(CommandError::internal(
            &format!("Drive list failed ({}): {}", status, body),
        ));
    }

    let body: serde_json::Value = resp
        .json()
        .map_err(|e| CommandError::internal(&format!("Failed to parse Drive response: {}", e)))?;

    let mut backups = Vec::new();

    if let Some(files) = body["files"].as_array() {
        for file in files {
            backups.push(BackupFileInfo {
                id: file["id"].as_str().unwrap_or("").to_string(),
                name: file["name"].as_str().unwrap_or("").to_string(),
                created_time: file["createdTime"].as_str().unwrap_or("").to_string(),
            });
        }
    }

    Ok(backups)
}

// ── Helpers ──

/// Simple URL encoding for query parameters. Handles multi-byte UTF-8 (M-7 fix).
fn urlencode(s: &str) -> String {
    let mut result = String::with_capacity(s.len() * 3);
    for c in s.chars() {
        match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' | '~' => result.push(c),
            ' ' => result.push('+'),
            other => {
                let mut buf = [0u8; 4];
                let encoded = other.encode_utf8(&mut buf);
                for byte in encoded.bytes() {
                    result.push_str(&format!("%{:02X}", byte));
                }
            }
        }
    }
    result
}

/// Decodes a URL-encoded query value.
fn urldecode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
        } else if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("00"),
                16,
            ) {
                out.push(b);
            }
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

// ── Auto-Redirect OAuth Flow ──

/// Localhost port used for the OAuth redirect. Must match the redirect URI
/// registered in the Google Cloud Console for the OAuth client.
const OAUTH_REDIRECT_PORT: u16 = 57432;

/// Redirect URI registered with Google. Must equal
/// `http://localhost:{OAUTH_REDIRECT_PORT}/callback` exactly.
const OAUTH_REDIRECT_URI: &str = "http://localhost:57432/callback";

/// Time we wait for the user to complete the browser consent step.
const OAUTH_TIMEOUT_SECS: u64 = 180;

/// Runs the full Google Drive auto-redirect OAuth flow.
///
/// 1. Starts a one-shot HTTP server on `127.0.0.1:57432/callback`.
/// 2. Calls `open_browser` with the Google consent URL.
/// 3. Waits up to `OAUTH_TIMEOUT_SECS` seconds for the redirect.
/// 4. Validates the `state` parameter and extracts the `code`.
/// 5. Returns the authorization code; caller exchanges it for tokens.
pub fn run_drive_oauth_flow<F>(client_id: &str, open_browser: F) -> Result<String, CommandError>
where
    F: FnOnce(&str),
{
    use std::io::Write as _;
    use std::net::TcpListener;
    use std::sync::mpsc;
    use std::time::Duration;

    let state = generate_state();
    let auth_url = build_oauth_url(client_id, &state);

    let listener = TcpListener::bind(("127.0.0.1", OAUTH_REDIRECT_PORT)).map_err(|e| {
        CommandError::internal(&format!(
            "Cannot bind OAuth redirect port {}: {}. Is another PharmaCare instance running?",
            OAUTH_REDIRECT_PORT, e
        ))
    })?;

    let (tx, rx) = mpsc::channel::<Result<(String, String), CommandError>>();
    let expected_state = state.clone();

    std::thread::spawn(move || {
        let result = (|| -> Result<(String, String), CommandError> {
            let (mut stream, _) = listener
                .accept()
                .map_err(|e| CommandError::internal(&format!("OAuth accept failed: {}", e)))?;
            let mut buf = [0u8; 4096];
            let n = stream
                .read(&mut buf)
                .map_err(|e| CommandError::internal(&format!("OAuth read failed: {}", e)))?;
            let request = String::from_utf8_lossy(&buf[..n]).to_string();

            let first_line = request.lines().next().unwrap_or("");
            let path = first_line.split_whitespace().nth(1).unwrap_or("");
            let query = path.strip_prefix("/callback?").unwrap_or("");

            let mut code: Option<String> = None;
            let mut got_state: Option<String> = None;
            for pair in query.split('&') {
                let mut parts = pair.splitn(2, '=');
                let k = parts.next().unwrap_or("");
                let v = urldecode(parts.next().unwrap_or(""));
                match k {
                    "code" => code = Some(v),
                    "state" => got_state = Some(v),
                    _ => {}
                }
            }

            let state_ok = got_state.as_deref() == Some(expected_state.as_str());
            let html = if state_ok && code.is_some() {
                "<!doctype html><html><head><meta charset='utf-8'><title>Connected</title>\
                 <style>body{font-family:system-ui;padding:48px;text-align:center;background:#f0f9ff;}\
                 h1{color:#15803d;}p{color:#475569;}</style></head>\
                 <body><h1>Connected to Google Drive</h1>\
                 <p>You can close this window and return to PharmaCare.</p>\
                 <script>setTimeout(()=>window.close(),1500);</script></body></html>"
            } else {
                "<!doctype html><html><head><meta charset='utf-8'><title>Error</title>\
                 <style>body{font-family:system-ui;padding:48px;text-align:center;}h1{color:#b91c1c;}</style></head>\
                 <body><h1>Connection failed</h1><p>Invalid state or missing code. Close this window and try again.</p></body></html>"
            };
            let body = html.as_bytes();
            let status = if state_ok && code.is_some() { "200 OK" } else { "400 Bad Request" };
            let response = format!(
                "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                status,
                body.len()
            );
            let _ = stream.write_all(response.as_bytes());
            let _ = stream.write_all(body);
            let _ = stream.flush();

            if !state_ok {
                return Err(CommandError::internal("OAuth state mismatch"));
            }
            Ok((code.unwrap_or_default(), expected_state))
        })();

        let _ = tx.send(result);
    });

    open_browser(&auth_url);

    match rx.recv_timeout(Duration::from_secs(OAUTH_TIMEOUT_SECS)) {
        Ok(Ok((code, _state))) if !code.is_empty() => Ok(code),
        Ok(Ok(_)) => Err(CommandError::internal("OAuth callback returned no code")),
        Ok(Err(e)) => Err(e),
        Err(_) => Err(CommandError::internal(&format!(
            "OAuth consent timed out after {} seconds",
            OAUTH_TIMEOUT_SECS
        ))),
    }
}

/// Builds the Google OAuth consent URL.
fn build_oauth_url(client_id: &str, state: &str) -> String {
    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?\
         client_id={}&\
         redirect_uri={}&\
         response_type=code&\
         scope=https://www.googleapis.com/auth/drive.file&\
         state={}&\
         access_type=offline&\
         prompt=consent",
        urlencode(client_id),
        urlencode(OAUTH_REDIRECT_URI),
        urlencode(state),
    )
}

/// Reads the OAuth client credentials from environment variables.
/// Returns a clear error if they are missing.
pub fn read_oauth_client() -> Result<(String, String), CommandError> {
    let client_id = std::env::var("GOOGLE_OAUTH_CLIENT_ID")
        .map_err(|_| CommandError::internal(
            "GOOGLE_OAUTH_CLIENT_ID is not set. Build the app with this env var (see README)."
        ))?;
    let client_secret = std::env::var("GOOGLE_OAUTH_CLIENT_SECRET")
        .map_err(|_| CommandError::internal(
            "GOOGLE_OAUTH_CLIENT_SECRET is not set. Build the app with this env var (see README)."
        ))?;
    if client_id.trim().is_empty() || client_secret.trim().is_empty() {
        return Err(CommandError::internal("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are empty"));
    }
    Ok((client_id, client_secret))
}

/// Exchanges the auth code for tokens and stores them in settings.
/// Returns the merged token JSON (including client credentials for refresh).
pub fn complete_and_store_drive_token(
    db: &Connection,
    client_id: &str,
    client_secret: &str,
    auth_code: &str,
) -> Result<(), CommandError> {
    let token_json = exchange_code_for_token(
        client_id,
        client_secret,
        auth_code,
        OAUTH_REDIRECT_URI,
    )?;

    let mut token_value: serde_json::Value = serde_json::from_str(&token_json)
        .map_err(|e| CommandError::internal(&format!("Failed to parse token: {}", e)))?;

    if let Some(obj) = token_value.as_object_mut() {
        obj.insert("client_id".to_string(), serde_json::json!(client_id));
        obj.insert("client_secret".to_string(), serde_json::json!(client_secret));
    }

    let merged_json = serde_json::to_string(&token_value)
        .map_err(|e| CommandError::internal(&format!("Failed to serialize token: {}", e)))?;

    settings_repo::set_value(db, "google_drive_token", &merged_json)?;
    Ok(())
}
