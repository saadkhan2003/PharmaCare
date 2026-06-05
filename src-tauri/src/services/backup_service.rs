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
                let settings_conn = match db.lock() {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let drive_token = settings_repo::get_string(&settings_conn, "google_drive_token")
                    .ok()
                    .flatten();
                let local_path = settings_repo::get_string(&settings_conn, "local_backup_path")
                    .ok()
                    .flatten()
                    .filter(|p| !p.is_empty())
                    .map(|p| PathBuf::from(p));

                if let Err(e) = run_backup(
                    &conn,
                    &settings_conn,
                    drive_token.is_some(),
                    local_path.as_deref(),
                ) {
                    eprintln!("Auto-backup failed: {}", e.message);
                    // Update status to failed
                    let _ = settings_repo::set_value(
                        &settings_conn,
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

/// Constructs the Google OAuth URL and returns it for the frontend to open.
pub fn start_oauth_flow(client_id: &str, _redirect_port: u16) -> Result<String, CommandError> {
    let state = generate_state();

    let redirect_uri = format!("http://localhost:{}/callback", _redirect_port);

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?\
         client_id={}&\
         redirect_uri={}&\
         response_type=code&\
         scope=https://www.googleapis.com/auth/drive.file&\
         state={}&\
         access_type=offline&\
         prompt=consent",
        urlencode(client_id),
        urlencode(&redirect_uri),
        urlencode(&state),
    );

    Ok(auth_url)
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

/// Simple URL encoding for query parameters.
fn urlencode(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            ' ' => "+".to_string(),
            other => format!("%{:02X}", other as u8),
        })
        .collect()
}
