---
phase: 05-reports-backup-admin
plan: 01
subsystem: backend
tags: [reports, backup, settings, user-management, aggregation, oauth, drive]
requires: [phase-03, phase-04]
provides: [9-report-services, backup-restore-service, settings-write, password-change]
affects: [frontend-phase-5-wave2]
tech-stack:
  added:
    - reqwest 0.12 (blocking HTTP for Google Drive API)
    - flate2 1.0 (gzip compression for backup files)
    - tauri-plugin-shell 2 (OAuth browser URL opening)
    - @react-pdf/renderer 4.5.1 (client-side PDF generation)
  patterns:
    - Three-layer Rust: Repository → Service → Command
    - require_owner guard on every report/backup/settings-write command
    - VACUUM INTO for atomic DB snapshots
    - reqwest multipart POST for Drive file upload
    - OAuth with access_type=offline+prompt=consent for refresh tokens
key-files:
  created:
    - src-tauri/src/models/report.rs (9 report DTOs + UpdateSettingsPayload + BackupStatus/Result/FileInfo)
    - src-tauri/src/services/report_service.rs (9 SQL aggregation functions)
    - src-tauri/src/services/backup_service.rs (VACUUM INTO + gzip + Drive upload/download + restore + OAuth + auto-backup)
    - src-tauri/src/commands/report_commands.rs (9 owner-guarded report commands)
    - src-tauri/src/commands/backup_commands.rs (7 owner-guarded backup commands)
    - src/types/report.ts (TypeScript interfaces matching 9 DTOs)
  modified:
    - src-tauri/Cargo.toml (added reqwest, flate2, tauri-plugin-shell)
    - src-tauri/src/models/settings.rs (11 new fields: pharmacy info, backup config, tax toggle)
    - src-tauri/src/models/mod.rs (added report module)
    - src-tauri/src/services/settings_service.rs (added update_settings, extended get_settings)
    - src-tauri/src/services/user_service.rs (added change_password)
    - src-tauri/src/services/mod.rs (added report_service, backup_service)
    - src-tauri/src/repository/user_repo.rs (added get_password_hash, update_password_hash)
    - src-tauri/src/commands/settings_commands.rs (added update_settings)
    - src-tauri/src/commands/user_commands.rs (added change_password)
    - src-tauri/src/commands/mod.rs (added report_commands, backup_commands)
    - src-tauri/src/main.rs (registered 18 new commands + tauri-plugin-shell)
    - src-tauri/src/errors.rs (added From<io::Error> and From<reqwest::Error>)
    - src/types/settings.ts (11 new fields)
    - src/lib/tauri.ts (reports, backup, settings.update, users.changePassword)
    - package.json (added @react-pdf/renderer)
decisions:
  - "9 report DTOs defined with serde Serialize for Tauri IPC, matching TypeScript interfaces"
  - "Expiry report uses distinct name get_expiry_report_phase5 to avoid conflict with existing batch_commands version"
  - "All report/backup/settings-write commands require owner role at the command layer (T-05-01, T-05-02, T-05-03)"
  - "Password change uses require_session (not require_owner) per D-78"
  - "Backup uses VACUUM INTO for atomic snapshot + gzip compression per D-66/D-67"
  - "Restore creates pre-restore backup first, validates with PRAGMA integrity_check, then atomically swaps via VACUUM INTO"
  - "OAuth tokens stored merged with client_id/client_secret for unattended auto-refresh"
  - "Report services use COALESCE to handle NULL from aggregate functions"
metrics:
  duration: "~45 minutes"
  completed_date: "2026-06-05"
---

# Phase 5 Plan 1: Backend Infrastructure — Reports, Backup & Administration

**One-liner:** Complete Rust backend for 9 owner-only report aggregation services, VACUUM INTO + gzip + Google Drive backup/restore, settings write commands, and password change — all with TypeScript contract bindings.

## Summary

This plan delivers the entire Phase 5 backend infrastructure in a single wave. Three atomic commits:

### Task 1: Dependencies + Models + Types
- Added `reqwest` (blocking + json + multipart), `flate2`, `tauri-plugin-shell` to Cargo.toml
- Created `models/report.rs` with 9 report DTOs (`DailySalesRow`, `MonthlyPnLRow`, `TopSellerRow`, `SlowMovingRow`, `LowStockRow`, `ExpiryReportDetailRow`, `SupplierPurchaseRow`, `SalesByUserRow`, `ProfitMarginRow`) plus `UpdateSettingsPayload`, `BackupStatus`, `BackupResult`, `BackupFileInfo`
- Extended `models/settings.rs` with 11 new fields (pharmacy_name, owner_name, phone, address, logo_path, auto_backup_time, local_backup_path, last_backup_time, last_backup_status, google_drive_connected, tax_enabled_default)
- Created `src/types/report.ts` with matching TypeScript interfaces
- Extended `src/types/settings.ts` with new SettingsMap fields
- Installed `@react-pdf/renderer` npm dependency

### Task 2: Services
- **report_service.rs**: 9 SQL aggregation functions with COALESCE for NULL-safe aggregations over sales, sale_items, batches, medicines, returns, purchases, purchase_items, suppliers, users
- **backup_service.rs**: Full backup/restore lifecycle — VACUUM INTO atomic snapshot, gzip compression via flate2, Google Drive multipart upload/download via reqwest, local folder copy, restore with pre-restore backup + integrity validation + atomic swap, OAuth flow (state generation, code exchange, token refresh), auto-backup scheduling, 30-day cleanup
- **settings_service.rs**: Extended get_settings to read 11 new keys, added update_settings that writes only non-None fields
- **user_service.rs**: Added change_password with bcrypt verify + re-hash at cost 12
- **user_repo.rs**: Added get_password_hash, update_password_hash

### Task 3: Commands + main.rs + TypeScript bindings
- **report_commands.rs**: 9 commands with require_owner guard for each report type
- **backup_commands.rs**: 7 commands (trigger_backup, restore_backup, connect_drive, disconnect_drive, complete_drive_connect, list_drive_backups, get_backup_status) — all require_owner
- **settings_commands.rs**: Added update_settings with require_owner
- **user_commands.rs**: Added change_password with require_session
- **main.rs**: Registered all 18 new commands + tauri-plugin-shell plugin
- **errors.rs**: Added From<io::Error> and From<reqwest::Error> conversions
- **tauri.ts**: Extended with `reports.*`, `backup.*`, `settings.update`, `users.changePassword`

## Commit History

| Commit | Hash | Description |
|--------|------|-------------|
| Task 1 | 4446f15 | Rust deps, report DTOs, settings model extension, TypeScript types |
| Task 2 | c67e315 | Rust services for reports, backup, settings, password change |
| Task 3 | 2ed896f | Rust commands, main.rs registration, TS API bindings |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed f64 unwrap_or compilation errors in report_service.rs**
- **Found during:** Task 2 verification (cargo build)
- **Issue:** `row.get::<_, f64>(N)?` returns `f64` directly (not `Option<f64>`), so `.unwrap_or(0.0)` doesn't compile
- **Fix:** Changed SQL to use `COALESCE(... , 0)` so values are never NULL, then used direct `row.get::<_, f64>(N)?` without unwrap_or. Also changed total_qty to use `i64` type directly with COALESCE
- **Files modified:** `src-tauri/src/services/report_service.rs`
- **Commit:** 2ed896f

**2. [Rule 1 - Bug] Fixed backup_service.rs compilation errors**
- **Found during:** Task 3 verification (cargo build)
- **Issues:**
  - `upload_to_drive` parameter name shadowed the function name (renamed to `should_upload`)
  - `CommandError` doesn't implement Display (used `.message` accessor instead)
  - `serde_json::from_str` returns `Result`, not `Option` (fixed chaining)
  - Path borrow/move conflict in cleanup (added `.clone()`)
- **Files modified:** `src-tauri/src/services/backup_service.rs`, `src-tauri/src/errors.rs`
- **Commit:** 2ed896f

**3. [Rule 1 - Bug] Missing use tauri::Manager in backup_commands.rs**
- **Found during:** cargo build
- **Issue:** `.path()` method on `AppHandle` requires `Manager` trait in scope
- **Fix:** Added `use tauri::{State, Manager}`
- **Files modified:** `src-tauri/src/commands/backup_commands.rs`
- **Commit:** 2ed896f

**4. [Rule 3 - Blocking] Restore flow needed proper DB swap via VACUUM INTO**
- **Found during:** Implementation review
- **Issue:** Original restore approach returned a path and relied on the command to do file copy, but file copy doesn't work with WAL locks
- **Fix:** Restructured restore_from_local and restore_from_drive to open the restored DB as a separate connection and use VACUUM INTO for atomic swap
- **Files modified:** `src-tauri/src/services/backup_service.rs`, `src-tauri/src/commands/backup_commands.rs`
- **Commit:** 2ed896f

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: restore-swap-atomic | backup_service.rs | Restore uses VACUUM INTO from the restored DB connection to atomically replace the live database — pre-restore backup created first to prevent data loss |

## Success Criteria

- [x] All 9 report DTOs defined in Rust with matching TypeScript interfaces
- [x] All 9 report aggregation functions in report_service with correct SQL
- [x] All 9 report commands with require_owner guard
- [x] backup_service with create_snapshot (VACUUM INTO + gzip), upload_to_drive (multipart POST), copy_to_local, run_backup orchestration, restore (with pre-restore), OAuth flow, auto-backup timer
- [x] settings_service.update_settings writes all keys to settings table
- [x] user_service.change_password with bcrypt verify + re-hash
- [x] user_repo.get_password_hash and update_password_hash
- [x] All 18 new commands registered in main.rs invoke_handler
- [x] tauri-plugin-shell registered
- [x] tauri.ts has reports, backup, settings.update, users.changePassword namespaces
- [x] cargo build passes

## Self-Check: PASSED

All files verified present and all commit hashes confirmed in git log.
