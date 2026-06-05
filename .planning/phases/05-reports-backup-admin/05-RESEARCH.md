# Phase 5: Reports, Backup & Administration - Research

**Researched:** 2026-06-05
**Domain:** Report aggregation, PDF export, Google Drive OAuth backup/restore, VACUUM INTO snapshots, settings UI, user management completion
**Confidence:** HIGH

## Summary

Phase 5 is the largest phase in the project, delivering the full owner analytics suite (9 report types with PDF export), Google Drive backup/restore with VACUUM INTO, settings UI tabs (pharmacy info, financial, inventory, backup), and user management completion (password change). It depends on all prior phases being complete — Phase 3 for sale data, Phase 4 for return/correction data.

**Primary recommendation:** Build in dependency order: (1) report aggregation services in Rust, (2) report frontend pages with Recharts + @react-pdf/renderer, (3) backup service with VACUUM INTO + gzip + Google Drive HTTP upload, (4) settings UI tabs (reuse existing read commands, add write commands), (5) password change feature, (6) sidebar/report nav wiring.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-57**: Reports are read-only aggregations over sale_items, returns, batches, purchases. All data is pre-existing in the database — no new data models needed.
- **D-58**: Each report is a Rust service function that returns a typed DTO. Frontend renders as table + Recharts chart + PDF export.
- **D-59**: PDF export uses @react-pdf/renderer (client-side, no server). Report data fetched via Tauri command, then rendered to PDF in the React layer.
- **D-60**: Reports are date-range filterable. Default range: last 30 days. All use UTC dates from the database.
- **D-61**: Profit calculations: `SUM(line_total) - SUM(purchase_cost * quantity)` per sale item. Refunds subtracted from revenue. Write-offs tracked as separate loss column.
- **D-62**: Top sellers by quantity and revenue. Slow-moving = items with zero sales in the selected date range.
- **D-63**: Reports viewable only by Owner role. Blocked at the command layer.
- **D-64**: Google Drive backup uses OAuth 2.0 via a background Rust thread. Token stored in a settings key (Google tokens are JSON). Backup triggered by a Tauri command, not a cron job (desktop app).
- **D-65**: Auto-backup scheduling: when the app is open at the configured time (default 11 PM), trigger backup. If app is closed, backup runs on next launch if the scheduled time has passed.
- **D-66**: Backup uses `VACUUM INTO 'path'` for a consistent snapshot — copies the live database atomically without needing the Backup API. Simpler than Online Backup API for a single-user desktop app.
- **D-67**: Uploaded to Google Drive via a simple HTTP multipart upload. Files named `pharmaCare_backup_YYYY-MM-DD.db.gz`. Gzip-compressed before upload.
- **D-68**: Restore: owner selects a backup → app creates a pre-restore backup → downloads from Drive → decompresses → replaces the database → restarts the app.
- **D-69**: Local folder backup: configurable path (USB drive). Same `VACUUM INTO` + gzip, just copy to local path instead of uploading.
- **D-70**: Backup status stored in settings: `last_backup_time`, `last_backup_status`. Dashboard reads these for the backup status widget.
- **D-71**: Missed backup detection: if `last_backup_time` is more than 3 days ago, show warning on dashboard.
- **D-72**: Settings UI is a single page with tabbed sections: Pharmacy Info, Financial, Inventory, Backup.
- **D-73**: Settings values stored in the existing `settings` key-value table. Read/write through settings_service (commands already exist for reads — add write commands).
- **D-74**: Pharmacy Info: name, owner name, phone, address, logo path.
- **D-75**: Financial: default tax rate (%), tax enabled toggle, cashier discount toggle, currency symbol.
- **D-76**: Inventory: default reorder level, expiry warning threshold (days), expiry critical threshold (days).
- **D-77**: Backup: Google Drive connect/disconnect, auto-backup time, local folder path, manual backup now, manual restore.
- **D-78**: User management screen already exists (Phase 1) — verify it's complete and connected. Add password change functionality for the current user.

### The Agent's Discretion
- Report PDF layout and design
- Settings page tab layout
- Google Drive OAuth token exchange details
- Backup status dashboard widget design
- Specific Recharts chart types for each report

### Deferred Ideas (OUT OF SCOPE)
- None — this is the final phase for v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REPT-03 | Daily Sales Summary report (date-filterable, PDF export) | SQL aggregation over `sales` + `sale_items` grouped by date, @react-pdf/renderer PDF |
| REPT-04 | Monthly P&L report (PDF export) | `SUM(line_total) - SUM(purchase_cost*quantity)` per month, refunds from `returns` subtracted, write-offs in loss column |
| REPT-05 | Top Selling Medicines report (PDF export) | `GROUP BY medicine_id` with `SUM(quantity)` and `SUM(line_total)` over date range |
| REPT-06 | Slow-Moving Stock report (PDF export) | Medicines with zero sales in date range + current stock level |
| REPT-07 | Low Stock report (PDF export) | `batches.remaining_qty <= medicines.reorder_level` with current stock |
| REPT-08 | Expiry report (PDF export) | `batches` ordered by `expiry_date ASC` with days remaining calculation |
| REPT-09 | Supplier Purchase History report (PDF export) | `purchases` joined to `suppliers` and `purchase_items` grouped by supplier |
| REPT-10 | Sales by User report (PDF export) | `sales` grouped by `user_id` with total amounts and count |
| REPT-11 | Profit Margin report (PDF export) | Per-medicine margin: `AVG(line_total - purchase_cost*quantity)` over date range |
| REPT-12 | All reports date-range filterable | Every report service function accepts `start_date`/`end_date` params |
| REPT-13 | Purchase prices and profit visible to Owner role only | `require_owner` guard on every report command |
| BAKP-01 | Nightly auto-backup at 11 PM | App-time check: if `last_backup_time` older than scheduled time and app is open, trigger; on launch, check if 11 PM passed today |
| BAKP-02 | Owner can trigger manual backup anytime | `trigger_backup` Tauri command with `require_owner` |
| BAKP-03 | Backups named pharmaCare_backup_YYYY-MM-DD.db; last 30 kept | Naming: `format!("pharmaCare_backup_{}.db.gz", date)`; cleanup: list `backup_` files, delete oldest beyond 30 |
| BAKP-04 | Dashboard shows last backup status | Settings keys `last_backup_time` and `last_backup_status` displayed in backup widget |
| BAKP-05 | Missed-backup warning after 3 days without backup | Frontend compares `last_backup_time` to now; if >3 days, show warning banner on dashboard |
| BAKP-06 | Owner can restore from backup with confirmation warning | `restore_backup` command that validates backup, creates pre-restore backup, replaces DB, restarts app |
| BAKP-07 | Optional local-folder/USB backup alongside Drive upload | Same VACUUM INTO + gzip pipeline, copy to configurable local path instead of HTTP upload |
| BAKP-08 | Pre-restore backup created before any restore | Before replacing DB, call `VACUUM INTO 'pharmacare_pre_restore_<timestamp>.db'` |
| BAKP-09 | Backup uses SQLite-safe snapshot (VACUUM INTO) | `VACUUM INTO 'path'` creates an atomic snapshot without Online Backup API |
| SETT-07 | Owner connects/disconnects Google Drive for backup | Settings write commands for `google_drive_token` (JSON); connect triggers OAuth flow, disconnect clears token |
| SETT-08 | Owner configures auto-backup time | Settings key `auto_backup_time` stored as "HH:MM" string |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Report data aggregation | API / Backend (Rust) | — | SQL aggregation over sale/purchase/return data; owner-only RBAC enforced at command layer |
| Report table + chart display | Browser / Client (React) | — | Recharts + shadcn Table render fetched report data |
| PDF generation | Browser / Client (React) | — | @react-pdf/renderer runs client-side; fetches data via Tauri IPC then renders |
| Backup snapshot creation | Database / Storage (SQLite) | API / Backend (Rust) | VACUUM INTO runs in Rust with db lock; BackupService orchestrates |
| Gzip compression | API / Backend (Rust) | — | flate2 crate compresses the .db file before upload |
| Google Drive upload | API / Backend (Rust) | — | reqwest blocking HTTP client; Drive API multipart upload |
| Google Drive OAuth | API / Backend (Rust) | Frontend (browser open) | Rust spawns localhost redirect server; React opens browser via Tauri shell plugin |
| Settings reads | API / Backend (Rust) | — | Existing `get_settings` command returns SettingsMap |
| Settings writes | API / Backend (Rust) | — | New `update_settings` command with `require_owner` guard |
| Auto-backup scheduling | API / Backend (Rust) | — | App startup check + periodic timer in Tauri setup |
| Backup status tracking | API / Backend (Rust) | Browser / Client (React) | Rust writes `last_backup_time`/`last_backup_status` to settings; UI reads via `get_settings` |
| Backup status widget | Browser / Client (React) | — | Dashboard component reads settings and shows status/warning |
| Password change | API / Backend (Rust) | — | `change_password` command with `require_session`, bcrypt verify + re-hash |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-pdf/renderer | 4.5.1 | Client-side PDF document generation | D-59; only viable React PDF library; works entirely in browser |
| recharts | 3.8.1 | Report chart rendering | Already installed (Phase 3 dashboard); reused for report visualization |
| reqwest | 0.12.x | HTTP client for Google Drive API | Most popular Rust HTTP crate; blocking client for synchronous backup flow |
| flate2 | 1.0.x | Gzip compression of backup files | Pure Rust gzip; integrates with `std::io::Write` for streaming compression |
| serde_json | 1.0 | Google OAuth token serialization | Already installed; used to serialize/deserialize Drive token JSON in settings |
| chrono | 0.4 | Date arithmetic for reports and backup scheduling | Already installed; used for date range filtering and backup time comparison |
| tauri-plugin-shell | 2.x | Open browser URL for OAuth redirect | Required to open the Google OAuth URL in the user's default browser |
| sha2 / hmac | 0.10 / 0.12 | (Optional) PKCE for OAuth if needed | For enhanced OAuth security; may not be needed if localhost redirect server is sufficient |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rand | 0.8 | Generate OAuth state parameter | When starting Google Drive OAuth flow |
| base64 | 0.22 | Base64-encode OAuth verifier | For PKCE if implemented |
| uuid | 1.x | Unique backup filenames | Already installed; used for pre-restore backup naming |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer | jsPDF (manual) | @react-pdf uses declarative React components; jsPDF requires imperative drawing and is harder to maintain |
| reqwest blocking | ureq | Both are fine; reqwest has broader ecosystem and better TLS support for Google Drive HTTPS |
| VACUUM INTO | SQLite Online Backup API | VACUUM INTO is simpler (one SQL call); Online Backup API allows streaming during app use but is overkill for single-user desktop |
| flate2 | gzip CLI call via std::process | flate2 is cross-platform, doesn't depend on external gzip binary, and integrates with Rust I/O streams |

**Installation:**
```bash
# Frontend
npm install @react-pdf/renderer

# Rust backend — add to Cargo.toml
# reqwest = { version = "0.12", features = ["blocking", "json", "multipart"] }
# flate2 = "1.0"
# tauri-plugin-shell = "2"
```

**Version verification:**
```bash
npm view @react-pdf/renderer version
# → 4.5.1 (verified 2026-06-05)

# Check Rust crate versions at docs.rs
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          React Frontend                             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Reports Page  │  │ Settings Page│  │ Dashboard (backup widget)│  │
│  │              │  │              │  │                          │  │
│  │ · DateRange   │  │ · Tabbed:    │  │ · Last backup time       │  │
│  │ · Recharts    │  │   Pharmacy   │  │ · Missed backup warning  │  │
│  │ · shadcn Table│  │   Financial  │  │ · Backup now button      │  │
│  │ · PDF export  │  │   Inventory  │  └──────────────────────────┘  │
│  │   button     │  │   Backup     │                                 │
│  └──────┬───────┘  └──────┬───────┘                                 │
│         │                  │                                          │
│    ┌────▼──────────────────▼────┐                                    │
│    │      tauri.ts API layer    │                                    │
│    │  (all invoke() calls)      │                                    │
│    └───────────┬───────────────┘                                    │
└────────────────┼────────────────────────────────────────────────────┘
                 │ Tauri IPC (invoke)
    ┌────────────▼────────────────────────────────────────────┐
    │                    Rust Backend                          │
    │                                                         │
    │  ┌────────────────────────────────────────────────────┐ │
    │  │           Command Layer (with guards)               │ │
    │  │  require_owner(generate_report)                    │ │
    │  │  require_session(change_password)                  │ │
    │  │  require_owner(trigger_backup)                     │ │
    │  │  require_owner(update_settings)                    │ │
    │  └──────────┬────────────┬─────────────┬──────────────┘ │
    │             │            │             │                 │
    │  ┌──────────▼──┐ ┌──────▼──────┐ ┌────▼──────────────┐ │
    │  │  Report     │ │BackupService │ │ SettingsService  │ │
    │  │  Service    │ │             │ │                  │ │
    │  │  · daily    │ │ · VACUUM    │ │ · get_* (exist)  │ │
    │  │  · monthly  │ │   INTO      │ │ · set_value      │ │
    │  │  · top_sell │ │ · gzip      │ │                  │ │
    │  │  · slow     │ │ · Drive     │ └────────┬─────────┘ │
    │  │  · low_stock│ │   upload    │          │            │
    │  │  · expiry   │ │ · local     │          │            │
    │  │  · supplier │ │   folder    │          │            │
    │  │  · by_user  │ · restore     │          │            │
    │  │  · margin   │ └─────────────┘          │            │
    │  └─────────────┘                          │            │
    │         │                                 │            │
    │         ▼                                 ▼            │
    │  ┌──────────────────────────────────────────────────┐ │
    │  │              Repository Layer                     │ │
    │  │  settings_repo::get_string / set_value            │ │
    │  │  (SQL aggregates via db.prepare + query_map)      │ │
    │  └──────────────────────┬───────────────────────────┘ │
    └─────────────────────────┼─────────────────────────────┘
                              │
                              ▼
                  ┌─────────────────────┐
                  │   SQLite Database    │
                  │  (pharmacare.db)     │
                  │                     │
                  │ Tables queried:     │
                  │ sales, sale_items,  │
                  │ batches, medicines, │
                  │ returns, purchases, │
                  │ purchase_items,     │
                  │ suppliers, users,   │
                  │ settings,           │
                  │ stock_movements     │
                  └─────────────────────┘
```

### Backup Flow Diagram
```
Manual Backup (trigger_backup command):
  ┌─────────────────────────────────────────────────────────┐
  │ 1. Lock database mutex (state.db.lock())                │
  │ 2. VACUUM INTO temp/pharmaCare_backup_YYYY-MM-DD.db    │
  │    (atomic snapshot — no WAL issues)                   │
  │ 3. Release database lock                               │
  │ 4. Open snapshot file, wrap in gzip encoder (flate2)   │
  │ 5. Write to temp/pharmaCare_backup_YYYY-MM-DD.db.gz    │
  │ 6. Delete uncompressed snapshot file                    │
  │ 7. Upload .db.gz to Google Drive via multipart POST     │
  │    (OR copy to local folder path)                      │
  │ 8. Update settings: last_backup_time, last_backup_status│
  │ 9. Cleanup: delete backups older than 30 days           │
  │ 10. Return { success: true, message, path }             │
  └─────────────────────────────────────────────────────────┘

Restore Flow:
  ┌─────────────────────────────────────────────────────────┐
  │ 1. Owner selects backup file (Drive or local)           │
  │ 2. Download from Drive (or open local file)             │
  │ 3. Decompress gzip to .db                               │
  │ 4. Validate: run "PRAGMA integrity_check" on restored   │
  │ 5. Lock database, create pre-restore backup             │
  │    VACUUM INTO 'pharmacare_pre_restore_TIMESTAMP.db'   │
  │ 6. Close current connection                             │
  │ 7. Copy restored file over pharmacare.db                │
  │ 8. App.restart() — Tauri process restart                │
  └─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src-tauri/src/
├── commands/
│   ├── mod.rs                          # add report_commands, backup_commands
│   ├── report_commands.rs              # NEW: 9 report Tauri commands
│   ├── backup_commands.rs              # NEW: trigger_backup, restore_backup, list_backups, connect_drive, disconnect_drive
│   ├── settings_commands.rs            # MODIFY: add update_settings, change_password
│   └── ...existing commands
├── services/
│   ├── mod.rs                          # add report_service, backup_service
│   ├── report_service.rs               # NEW: 9 aggregation functions
│   ├── backup_service.rs               # NEW: VACUUM INTO, gzip, Drive upload, restore
│   ├── settings_service.rs             # MODIFY: add set_value, write typed settings
│   └── ...existing services
├── models/
│   ├── mod.rs                          # add report.rs
│   ├── report.rs                       # NEW: 9 report DTO structs
│   ├── settings.rs                     # MODIFY: extend SettingsMap with new fields
│   └── ...existing models
├── repository/
│   └── settings_repo.rs                # MODIFY: set_value already exists

src/
├── pages/
│   ├── ReportsPage.tsx                 # NEW: Report listing + detail view
│   ├── SettingsPage.tsx                # NEW: Tabbed settings page
│   ├── UsersPage.tsx                   # MODIFY: Add password change
│   └── ...existing pages
├── components/
│   ├── reports/                        # NEW: report components
│   │   ├── ReportList.tsx
│   │   ├── DailySalesReport.tsx
│   │   ├── MonthlyPnLReport.tsx
│   │   ├── TopSellersReport.tsx
│   │   ├── SlowMovingReport.tsx
│   │   ├── LowStockReport.tsx
│   │   ├── ExpiryReport.tsx
│   │   ├── SupplierPurchaseReport.tsx
│   │   ├── SalesByUserReport.tsx
│   │   ├── ProfitMarginReport.tsx
│   │   ├── PDFDocument.tsx
│   │   └── DateRangePicker.tsx
│   ├── settings/                       # NEW: settings tab components
│   │   ├── PharmacyInfoTab.tsx
│   │   ├── FinancialTab.tsx
│   │   ├── InventoryTab.tsx
│   │   └── BackupTab.tsx
│   └── ...existing components
├── lib/
│   ├── tauri.ts                        # MODIFY: Add reports + backup + settings write methods
│   └── pdf/                            # NEW: PDF document generators
│       ├── CommonStyles.ts
│       ├── DailySalesPDF.tsx
│       ├── MonthlyPnLPDF.tsx
│       └── ... per-report PDF documents
└── types/
    ├── settings.ts                     # MODIFY: extend SettingsMap
    ├── report.ts                       # NEW: report DTO types
    └── ...existing types
```

### Pattern 1: Report Aggregation Service
**What:** Each report is a Rust function that runs SQL aggregations over the database and returns a typed DTO. All reports accept `start_date` + `end_date` strings.

**When to use:** For every report type (REPT-03 through REPT-11). Follows the existing service pattern.

**Example:**
```rust
// Source: Derived from existing report_service pattern in codebase [ASSUMED]
use chrono::NaiveDate;
use rusqlite::Connection;
use serde::Serialize;

/// Daily Sales Summary report DTO
#[derive(Debug, Serialize)]
pub struct DailySalesRow {
    pub date: String,
    pub sale_count: i64,
    pub item_count: i64,
    pub gross_sales: f64,
    pub discounts: f64,
    pub tax_amount: f64,
    pub net_sales: f64,
    pub profit: f64,
}

/// Aggregates daily sales within a date range. Owner-only data.
pub fn get_daily_sales_report(
    db: &Connection,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<DailySalesRow>, CommandError> {
    let mut stmt = db.prepare(
        "SELECT
            date(s.created_at) as sale_date,
            COUNT(DISTINCT s.id) as sale_count,
            COUNT(si.id) as item_count,
            SUM(si.line_total + si.item_discount) as gross_sales,
            SUM(si.item_discount) + s.bill_discount as total_discount,
            SUM(s.tax_amount) as tax_amount,
            SUM(si.line_total) as net_sales,
            SUM(si.line_total - (si.purchase_cost * si.quantity)) as profit
        FROM sales s
        JOIN sale_items si ON si.sale_id = s.id
        WHERE date(s.created_at) >= ?1 AND date(s.created_at) <= ?2
        GROUP BY date(s.created_at)
        ORDER BY sale_date ASC"
    )?;

    let rows = stmt.query_map(rusqlite::params![start_date, end_date], |row| {
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
```

### Pattern 2: Report Tauri Command
**What:** Standard `require_owner` guard → lock db → call service → return DTO.

**When to use:** For every report command. Follows existing command pattern from `medicine_commands.rs`.

**Example:**
```rust
// Source: Derived from existing command pattern in codebase [ASSUMED]
#[tauri::command]
pub fn get_daily_sales_report(
    state: State<'_, AppState>,
    session_token: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<DailySalesRow>, CommandError> {
    let _session = require_owner(&state, &session_token)?; // D-63: Owner only
    let db = state.db.lock()?;
    report_service::get_daily_sales_report(&db, &start_date, &end_date)
}
```

### Pattern 3: @react-pdf/renderer PDF Document
**What:** Declarative React PDF components using `Document`, `Page`, `View`, `Text`, `StyleSheet`.

**When to use:** For every report's PDF export button. PDF rendered client-side, triggered on button click.

**Example:**
```tsx
// Source: react-pdf.org/components [CITED]
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  header: { fontSize: 16, marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 10, marginBottom: 15, textAlign: 'center', color: '#666' },
  table: { width: '100%' },
  tableRow: { flexDirection: 'row' },
  tableHeader: { backgroundColor: '#f0f0f0', fontWeight: 'bold' },
  tableCell: { flex: 1, padding: 4, borderBottomWidth: 1, borderBottomColor: '#ddd' },
});

export function DailySalesPDF({ data, startDate, endDate, pharmacyName }: {
  data: DailySalesRow[];
  startDate: string;
  endDate: string;
  pharmacyName: string;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.header}>{pharmacyName}</Text>
        <Text style={styles.subtitle}>Daily Sales Report: {startDate} to {endDate}</Text>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCell}>Date</Text>
            <Text style={styles.tableCell}>Sales</Text>
            <Text style={styles.tableCell}>Items</Text>
            <Text style={styles.tableCell}>Gross</Text>
            <Text style={styles.tableCell}>Discounts</Text>
            <Text style={styles.tableCell}>Tax</Text>
            <Text style={styles.tableCell}>Net</Text>
            <Text style={styles.tableCell}>Profit</Text>
          </View>
          {data.map((row, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.tableCell}>{row.date}</Text>
              <Text style={styles.tableCell}>{row.sale_count}</Text>
              <Text style={styles.tableCell}>{row.item_count}</Text>
              <Text style={styles.tableCell}>{row.gross_sales.toFixed(2)}</Text>
              <Text style={styles.tableCell}>{row.discounts.toFixed(2)}</Text>
              <Text style={styles.tableCell}>{row.tax_amount.toFixed(2)}</Text>
              <Text style={styles.tableCell}>{row.net_sales.toFixed(2)}</Text>
              <Text style={styles.tableCell}>{row.profit.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
```

### Pattern 4: PDF Download Link Trigger
**What:** Use `PDFDownloadLink` from @react-pdf to trigger browser download.

**When to use:** In report detail views that have a "Download PDF" button.

**Example:**
```tsx
// Source: react-pdf.org/components [CITED]
import { PDFDownloadLink } from '@react-pdf/renderer';

// In React component:
<PDFDownloadLink
  document={<DailySalesPDF data={reportData} startDate={startDate} endDate={endDate} pharmacyName={pharmacyName} />}
  fileName={`daily_sales_${startDate}_to_${endDate}.pdf`}
>
  {({ blob, url, loading, error }) =>
    loading ? 'Generating PDF...' : 'Download PDF'
  }
</PDFDownloadLink>
```

### Pattern 5: VACUUM INTO Backup (Rust)
**What:** Uses SQLite's VACUUM INTO to atomically snapshot the database, then gzips the file.

**When to use:** Every backup operation (manual, auto, pre-restore).

**Example:**
```rust
// Source: sqlite.org/lang_vacuum.html [CITED]
use flate2::{Compression, write::GzEncoder};
use std::fs::File;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

pub fn create_snapshot(db: &Connection, dest_path: &Path) -> Result<PathBuf, CommandError> {
    // Step 1: VACUUM INTO creates atomic snapshot (D-66)
    let vacuum_path = dest_path.with_extension("db");
    let vacuum_sql = format!("VACUUM INTO '{}'", vacuum_path.display());
    db.execute_batch(&vacuum_sql)?;

    // Step 2: Gzip compress (D-67)
    let gz_path = dest_path.with_extension("db.gz");
    let mut gz_file = File::create(&gz_path)?;
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    let mut snapshot = File::open(&vacuum_path)?;
    io::copy(&mut snapshot, &mut encoder)?;
    let compressed = encoder.finish()?;
    gz_file.write_all(&compressed)?;

    // Step 3: Remove uncompressed snapshot
    std::fs::remove_file(&vacuum_path)?;

    Ok(gz_path)
}
```

### Pattern 6: Google Drive OAuth for Tauri Desktop
**What:** Three-step OAuth flow: open browser → localhost redirect server → store token.

**When to use:** When the owner clicks "Connect Google Drive" in Backup settings tab.

**Flow:**
```
1. Frontend calls connect_drive() Tauri command
2. Rust generates state param, constructs OAuth URL:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=XXXX&
     redirect_uri=http://localhost:57432/callback&
     response_type=code&
     scope=https://www.googleapis.com/auth/drive.file&
     state=<random_state>&
     access_type=offline
3. Rust spawns a lightweight HTTP server on localhost:57432
4. Rust returns the OAuth URL to frontend
5. Frontend opens URL via window.open() or Tauri shell plugin
6. User authenticates in browser, grants Drive.file scope
7. Google redirects to http://localhost:57432/callback?code=XXXX&state=YYYY
8. Rust HTTP server captures the authorization code
9. Rust exchanges code for tokens via POST to accounts.google.com/o/oauth2/token
   Body: { code, client_id, client_secret, redirect_uri, grant_type: "authorization_code" }
10. Rust stores { access_token, refresh_token, expires_at } as JSON in settings key "google_drive_token"
11. Rust shuts down the localhost server
12. Frontend polls or receives result: "connected"
```

**Key considerations:**
- `access_type=offline` is REQUIRED to get a refresh_token for unattended auto-backup
- `scope=https://www.googleapis.com/auth/drive.file` limits Drive access to files created by the app
- Redirect URI must be `http://localhost:57432/callback` (not `https`, not a different port)
- Token stored in settings table as JSON string — acceptable for single-user desktop app per D-64
- For auto-backup: on app start, check if refresh_token is available and valid, if access_token expired, refresh it

### Pattern 7: Google Drive Upload (Rust)
**What:** HTTP multipart upload to Google Drive using reqwest blocking client.

**When to use:** After gzip compression is complete, upload to Drive.

**Example:**
```rust
// Source: developers.google.com/drive/api/guides/manage-uploads [CITED]
use reqwest::blocking::multipart;

fn upload_to_drive(
    file_path: &Path,
    access_token: &str,
    file_name: &str,
) -> Result<(), CommandError> {
    let file_content = std::fs::read(file_path)?;
    let file_body = reqwest::blocking::Body::from(file_content);

    let metadata = serde_json::json!({
        "name": file_name,
        "mimeType": "application/gzip"
    });

    let part_meta = multipart::Part::text(metadata.to_string())
        .mime_str("application/json")?;
    let part_file = multipart::Part::bytes(file_content.to_vec())
        .file_name(file_name.to_string())
        .mime_str("application/gzip")?;

    let form = multipart::Form::new()
        .part("metadata", part_meta)
        .part("file", part_file);

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;

    let resp = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .header("Authorization", format!("Bearer {}", access_token))
        .multipart(form)
        .send()?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(CommandError::internal(
            &format!("Drive upload failed ({}): {}", status, body)
        ));
    }

    Ok(())
}
```

### Anti-Patterns to Avoid
- **SQL injection in VACUUM INTO path:** Never interpolate user input directly into `VACUUM INTO 'path'`. Validate/sanitize the path or use a safe temp directory.
- **Blocking the main thread during backup:** Use `tauri::async_runtime::spawn_blocking` for long-running backup operations (upload, compression) so the UI doesn't freeze.
- **Exposing report data without owner guard:** Every report command MUST call `require_owner` — the frontend nav hide is not sufficient (D-63 enforcement).
- **Storing Drive token in plaintext SQLite without refresh handling:** Token storage in settings is per D-64 but must handle refresh_token expiry gracefully.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom PDF writer with pdfkit | @react-pdf/renderer v4.5.1 | Declarative React components, handles pagination, fonts, table layout, downloads |
| Gzip compression | Shell out to gzip CLI | flate2 crate | Cross-platform, pure Rust, integrates with I/O traits, no external dependency |
| HTTP client for Drive | Raw TCP sockets | reqwest blocking | Handles TLS, multipart, redirects, timeouts — production-grade HTTP client |
| OAuth token exchange | Manual HTTP + URL parsing | reqwest + localhost HTTP server | reqwest handles the POST to Google; std TCP listener handles redirect capture (simple enough not to need a crate) |
| Date/time arithmetic | Manual string parsing | chrono crate | Already installed; NaiveDate, Duration, parsing from "HH:MM" format |
| SQLite atomic snapshot | File copy with WAL checkpoint | VACUUM INTO | Built into SQLite, single SQL statement, guarantees consistent snapshot without WAL file concern |
| Browser URL open | Custom Win32 ShellExecute | tauri-plugin-shell 2.x | Official Tauri plugin, cross-platform, handles permissions |

**Key insight:** The backup pipeline has 4 distinct stages that each have well-established library solutions. Trying to combine them into fewer steps (e.g., reading the DB file while it's live, or using an external gzip binary) introduces failure modes that the libraries already handle correctly.

## Common Pitfalls

### Pitfall 1: VACUUM INTO Path Injection
**What goes wrong:** User-input paths (from local folder backup setting) passed directly to `VACUUM INTO` could cause SQL injection or directory traversal.
**Why it happens:** VACUUM INTO accepts a string literal, not a bound parameter.
**How to avoid:** Always validate user input paths. Use `Path::new()` to canonicalize and ensure they resolve to an allowed directory. Sanitize with `is_absolute()` and reject path separators in filename components.
**Warning signs:** Error messages about "no such directory" or paths with `..` segments.

### Pitfall 2: Drive Upload Blocks UI Thread
**What goes wrong:** The backup upload takes 5-30 seconds for a multi-MB database, freezing the Tauri window.
**Why it happens:** `reqwest::blocking` blocks the current thread; if called on the main thread, the UI freezes.
**How to avoid:** Use `tauri::async_runtime::spawn_blocking(move || { ... })` to offload the blocking backup work to a thread pool. Return a progress channel to the frontend.
**Warning signs:** Window becomes unresponsive during backup.

### Pitfall 3: OAuth Refresh Token Expiry
**What goes wrong:** After 7 days without user interaction, Google's refresh token may expire (if not used with `access_type=offline` and `prompt=consent`).
**Why it happens:** Google's OAuth policy for installed apps.
**How to avoid:** Pass `access_type=offline` AND `prompt=consent` on the initial auth URL (forces a new refresh token). On token refresh failure, clear the stored token and prompt the user to re-authenticate.
**Warning signs:** `401 Unauthorized` responses from Drive API on auto-backup.

### Pitfall 4: Restore Failure Leaves App Broken
**What goes wrong:** If the restore operation fails mid-way (disk full, corrupted backup), the app could be left with no working database.
**Why it happens:** The restore flow replaces the current database file — an incomplete replacement breaks the app.
**How to avoid:** Implement the pre-restore backup (D-68) as the FIRST step. Validate the backup integrity with `PRAGMA integrity_check` before attempting the swap. Use an atomic rename after writing the full restored file.
**Warning signs:** Incomplete downloads, disk space errors, corrupted backup files.

### Pitfall 5: Report Aggregation Perf Over Large Date Ranges
**What goes wrong:** Querying all sale_items over a multi-year range without indexes can be slow on large datasets.
**Why it happens:** The `sale_items` table has no index on `sale_id`'s date, requiring a full scan.
**How to avoid:** Add a composite index on `sale_items(sale_id, medicine_id)` if not present. The existing `idx_sales_date` on sales table covers date filtering; ensure joins use it. For initial v1 scope (single pharmacy, likely <50k sales), this is not a concern.
**Warning signs:** Reports taking >3 seconds to load.

### Pitfall 6: @react-pdf Font Loading in Tauri
**What goes wrong:** @react-pdf/renderer tries to fetch fonts via HTTP by default, which fails in a desktop app without internet.
**Why it happens:** Helvetica is the built-in PDF font. Custom fonts require `Font.register()` with a local path.
**How to avoid:** Stick with `Helvetica` (standard PDF font, no registration needed). If custom fonts are desired, embed the .ttf file in the app's `src-tauri/assets/` and register it with `Font.register({ family: 'Inter', src: '/fonts/Inter.ttf' })` before rendering.
**Warning signs:** Font loading errors in browser console, PDF text renders as boxes.

## SQL Aggregation Patterns for 9 Report Types

### Report Schema Reference
All reports query these tables (existing schema from migrations 001-004):

```sql
sales:          id, user_id, subtotal, bill_discount, tax_rate, tax_amount, total, payment_method, customer_name, created_at
sale_items:     id, sale_id, medicine_id, batch_id, quantity, unit_price, purchase_cost, item_discount, line_total
batches:        id, medicine_id, purchase_id, purchase_price, quantity, remaining_qty, expiry_date, received_date
medicines:      id, name, generic_name, brand_name, category, unit, retail_price, purchase_price, reorder_level, is_active
returns:        id, return_type, reference_id, medicine_id, batch_id, quantity, reason, condition, refund_amount, processed_by, return_date
purchases:      id, supplier_id, invoice_number, purchase_date, total_cost, payment_status, user_id, created_at
purchase_items: id, purchase_id, medicine_id, quantity, purchase_price, expiry_date, batch_id, line_cost
suppliers:      id, company_name, contact_person, phone, payment_terms, is_active
users:          id, full_name, username, role, is_active
```

### Report 1: Daily Sales Summary (REPT-03)
```sql
SELECT
  date(s.created_at) as sale_date,
  COUNT(DISTINCT s.id) as sale_count,
  COUNT(si.id) as item_count,
  SUM(si.line_total + si.item_discount) as gross_sales,
  SUM(si.item_discount) + MAX(s.bill_discount) as total_discounts,
  MAX(s.tax_amount) as tax_amount,
  SUM(si.line_total) as net_sales,
  SUM(si.line_total - (si.purchase_cost * si.quantity)) as profit
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
WHERE date(s.created_at) >= ?1 AND date(s.created_at) <= ?2
GROUP BY date(s.created_at)
ORDER BY sale_date ASC
```
**DTO fields:** date, sale_count, item_count, gross_sales, discounts, tax_amount, net_sales, profit
**Chart:** Recharts BarChart — date as X, net_sales + profit as dual bars

### Report 2: Monthly P&L (REPT-04)
```sql
SELECT
  strftime('%Y-%m', s.created_at) as month,
  COUNT(DISTINCT s.id) as sale_count,
  SUM(si.line_total) as total_revenue,
  SUM(si.purchase_cost * si.quantity) as total_cogs,
  SUM(si.line_total - (si.purchase_cost * si.quantity)) as gross_profit,
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
ORDER BY month ASC
```
**DTO fields:** month, sale_count, total_revenue, total_cogs, gross_profit, total_refunds, write_off_losses, net_profit (computed: gross_profit - total_refunds - write_off_losses)
**Chart:** Recharts composite — revenue bar, profit line, refunds/losses as negative bars

### Report 3: Top Selling Medicines (REPT-05)
```sql
SELECT
  m.id as medicine_id,
  m.name as medicine_name,
  m.generic_name,
  SUM(si.quantity) as total_qty,
  SUM(si.line_total) as total_revenue,
  SUM(si.line_total - (si.purchase_cost * si.quantity)) as total_profit
FROM sale_items si
JOIN medicines m ON m.id = si.medicine_id
JOIN sales s ON s.id = si.sale_id
WHERE date(s.created_at) >= ?1 AND date(s.created_at) <= ?2
GROUP BY m.id
ORDER BY total_qty DESC
LIMIT 50
```
**DTO fields:** medicine_id, medicine_name, generic_name, total_qty, total_revenue, total_profit
**Chart:** Recharts BarChart — horizontal bars, top 10 by quantity

### Report 4: Slow-Moving Stock (REPT-06)
```sql
SELECT
  m.id as medicine_id,
  m.name as medicine_name,
  m.category,
  b.purchase_price,
  b.retail_price,
  COALESCE(SUM(b.remaining_qty), 0) as current_stock,
  COALESCE(sold.total_qty, 0) as sold_in_period
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
ORDER BY m.name ASC
```
**DTO fields:** medicine_id, medicine_name, category, current_stock, total_investment, days_since_last_sale
**Chart:** Table only — stock value column highlights tied-up capital

### Report 5: Low Stock (REPT-07)
```sql
SELECT
  m.id as medicine_id,
  m.name as medicine_name,
  m.category,
  m.reorder_level,
  COALESCE(SUM(b.remaining_qty), 0) as current_stock,
  m.unit
FROM medicines m
LEFT JOIN batches b ON b.medicine_id = m.id AND b.remaining_qty > 0  -- only non-empty batches
WHERE m.is_active = 1
  AND COALESCE(SUM(b.remaining_qty), 0) <= m.reorder_level
GROUP BY m.id
ORDER BY current_stock ASC
```
**DTO fields:** medicine_id, medicine_name, category, reorder_level, current_stock, unit, deficit (reorder_level - current_stock)
**Chart:** Table with color-coded rows — red where stock is 0, yellow where below reorder

### Report 6: Expiry Report (REPT-08)
```sql
SELECT
  b.id as batch_id,
  m.id as medicine_id,
  m.name as medicine_name,
  b.batch_code,
  b.quantity as original_qty,
  b.remaining_qty,
  b.purchase_price as unit_cost,
  b.expiry_date,
  CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) as days_remaining,
  (b.remaining_qty * b.purchase_price) as potential_loss
FROM batches b
JOIN medicines m ON m.id = b.medicine_id
WHERE b.remaining_qty > 0
  AND julianday(b.expiry_date) - julianday('now') <= ?1  -- warning threshold
ORDER BY b.expiry_date ASC
```
**DTO fields:** batch_id, medicine_name, original_qty, remaining_qty, unit_cost, expiry_date, days_remaining, potential_loss, status (critical/warning/ok)
**Chart:** Recharts BarChart — grouped by month, color-coded (red=expired/critical, yellow=warning, green=ok)

### Report 7: Supplier Purchase History (REPT-09)
```sql
SELECT
  s.id as supplier_id,
  s.company_name,
  COUNT(DISTINCT p.id) as purchase_count,
  COUNT(pi.id) as item_count,
  COALESCE(SUM(p.total_cost), 0) as total_spent,
  COALESCE(AVG(p.total_cost), 0) as avg_order_value,
  MAX(p.purchase_date) as last_purchase_date
FROM suppliers s
LEFT JOIN purchases p ON p.supplier_id = s.id
LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
WHERE s.is_active = 1
  AND (p.purchase_date IS NULL OR (p.purchase_date >= ?1 AND p.purchase_date <= ?2))
GROUP BY s.id
ORDER BY total_spent DESC
```
**DTO fields:** supplier_id, company_name, purchase_count, item_count, total_spent, avg_order_value, last_purchase_date
**Chart:** Table + optional horizontal bar for total_spent comparison

### Report 8: Sales by User (REPT-10)
```sql
SELECT
  u.id as user_id,
  u.full_name,
  u.role,
  COUNT(DISTINCT s.id) as sale_count,
  COUNT(si.id) as item_count,
  SUM(si.line_total) as total_sales,
  SUM(si.line_total - (si.purchase_cost * si.quantity)) as total_profit,
  COALESCE(AVG(si.line_total - (si.purchase_cost * si.quantity)), 0) as avg_profit_per_sale
FROM users u
LEFT JOIN sales s ON s.user_id = u.id AND date(s.created_at) >= ?1 AND date(s.created_at) <= ?2
LEFT JOIN sale_items si ON si.sale_id = s.id
WHERE u.is_active = 1
GROUP BY u.id
ORDER BY total_sales DESC
```
**DTO fields:** user_id, full_name, role, sale_count, item_count, total_sales, total_profit, avg_profit_per_sale
**Chart:** Recharts BarChart — user as X, total_sales and total_profit as grouped bars

### Report 9: Profit Margin (REPT-11)
```sql
SELECT
  m.id as medicine_id,
  m.name as medicine_name,
  m.category,
  COUNT(si.id) as times_sold,
  SUM(si.quantity) as total_qty,
  AVG(si.unit_price) as avg_sell_price,
  AVG(si.purchase_cost) as avg_cost,
  AVG(si.unit_price - si.purchase_cost) as avg_margin_per_unit,
  CASE WHEN AVG(si.purchase_cost) > 0
    THEN ROUND(((AVG(si.unit_price) - AVG(si.purchase_cost)) / AVG(si.purchase_cost)) * 100, 1)
    ELSE 0
  END as margin_pct,
  SUM(si.line_total - (si.purchase_cost * si.quantity)) as total_profit
FROM sale_items si
JOIN medicines m ON m.id = si.medicine_id
JOIN sales s ON s.id = si.sale_id
WHERE date(s.created_at) >= ?1 AND date(s.created_at) <= ?2
GROUP BY m.id
ORDER BY margin_pct DESC
```
**DTO fields:** medicine_id, medicine_name, category, times_sold, total_qty, avg_sell_price, avg_cost, avg_margin_per_unit, margin_pct, total_profit
**Chart:** Recharts BarChart — medicine names on X, margin_pct as sorted bars + total_profit overlay

## Code Examples

### Settings Write Command (adding to existing pattern)
```rust
// Source: Extending existing settings_commands.rs pattern [ASSUMED]

#[derive(Debug, Deserialize)]
pub struct UpdateSettingsPayload {
    // Pharmacy Info
    pub pharmacy_name: Option<String>,
    pub owner_name: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub logo_path: Option<String>,
    // Financial
    pub default_tax_rate: Option<f64>,
    pub tax_enabled_default: Option<bool>,
    pub cashier_discount_enabled: Option<bool>,
    pub currency_symbol: Option<String>,
    // Inventory
    pub default_reorder_level: Option<i64>,
    pub expiry_warning_days: Option<i64>,
    pub expiry_critical_days: Option<i64>,
    // Backup
    pub auto_backup_time: Option<String>,
    pub local_backup_path: Option<String>,
}

#[tauri::command]
pub fn update_settings(
    state: State<'_, AppState>,
    session_token: String,
    payload: UpdateSettingsPayload,
) -> Result<(), CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    // Apply each non-None field
    settings_service::update_settings(&db, &payload)
}
```

### Backup Service — Auto-Backup Schedule Check (app startup)
```rust
// Source: D-65 pattern [ASSUMED]
use chrono::{Local, NaiveTime};

/// Checks if backup is due: called on app startup and periodically.
/// Returns true if backup should run now.
pub fn is_backup_due(db: &Connection) -> Result<bool, CommandError> {
    let last_time = settings_repo::get_string(db, "last_backup_time")?;
    let auto_time_str = settings_repo::get_string(db, "auto_backup_time")?
        .unwrap_or_else(|| "23:00".to_string());

    let now = Local::now();
    let today = now.format("%Y-%m-%d").to_string();

    // Parse configured backup time
    let auto_time = NaiveTime::parse_from_str(&auto_time_str, "%H:%M")
        .unwrap_or(NaiveTime::from_hms_opt(23, 0, 0).unwrap());

    // If last backup was today, skip
    if let Some(ref last) = last_time {
        if last.starts_with(&today) {
            return Ok(false);
        }
    }

    // If current time >= configured time, backup is due
    Ok(now.time() >= auto_time)
}

/// Periodic timer spawned in Tauri setup. Checks every 60 seconds.
pub fn start_backup_timer(app: tauri::AppHandle, db: Arc<Mutex<Connection>>) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(60));
            // Check time, trigger backup if due
            // Note: actual implementation needs AppState access
        }
    });
}
```

### Password Change Command
```rust
// Source: Extending user pattern [ASSUMED]
#[tauri::command]
pub fn change_password(
    state: State<'_, AppState>,
    session_token: String,
    current_password: String,
    new_password: String,
) -> Result<(), CommandError> {
    let session = require_session(&state, &session_token)?;

    if new_password.len() < 6 {
        return Err(CommandError::validation("New password must be at least 6 characters"));
    }

    let db = state.db.lock()?;

    // Verify current password
    let stored_hash = user_repo::get_password_hash(&db, session.user_id)?
        .ok_or_else(|| CommandError::not_found("User"))?;

    if !bcrypt::verify(&current_password, &stored_hash).map_err(|e|
        CommandError::internal(&format!("Password verification error: {}", e))
    )? {
        return Err(CommandError::validation("Current password is incorrect"));
    }

    // Hash and update
    let new_hash = bcrypt::hash(&new_password, bcrypt::DEFAULT_COST)
        .map_err(|e| CommandError::internal(&format!("Failed to hash password: {}", e)))?;

    user_repo::update_password_hash(&db, session.user_id, &new_hash)?;

    Ok(())
}
```

## Settings UI Data Flow

### Extended SettingsMap model
```rust
// Source: Extending existing models/settings.rs [ASSUMED]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsMap {
    // Existing fields
    pub default_tax_rate: f64,
    pub cashier_discount_enabled: bool,
    pub expiry_warning_days: i64,
    pub expiry_critical_days: i64,
    pub default_reorder_level: i64,
    pub currency_symbol: String,
    // NEW: Pharmacy Info
    pub pharmacy_name: String,
    pub owner_name: String,
    pub phone: String,
    pub address: String,
    pub logo_path: String,
    // NEW: Backup
    pub auto_backup_time: String,
    pub local_backup_path: String,
    pub last_backup_time: Option<String>,
    pub last_backup_status: Option<String>,
    pub google_drive_connected: bool,
    // NEW: Financial
    pub tax_enabled_default: bool,
}
```

**Settings write flow:** Frontend form → `update_settings(payload)` Tauri command → `require_owner` guard → `settings_service::update_settings()` → `settings_repo::set_value()` per key → return success.

**Key-value approach:** Each setting is stored individually: `INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)`. The payload DTO uses `Option<T>` for each field so callers send only changed values.

### Settings Tab Components
Each tab is a self-contained form component:
- **PharmacyInfoTab.tsx:** Text inputs for pharmacy_name, owner_name, phone, address; file upload for logo_path
- **FinancialTab.tsx:** Number input for default_tax_rate, toggles for tax_enabled_default and cashier_discount_enabled, text for currency_symbol
- **InventoryTab.tsx:** Number inputs for default_reorder_level, expiry_warning_days, expiry_critical_days
- **BackupTab.tsx:** Drive connect/disconnect button (shows status), auto_backup_time time picker, local_backup_path folder selector, "Backup Now" and "Restore" buttons

### Existing Settings Read Path (verified working)
The existing `get_settings` command calls `settings_service::get_settings()` which reads all keys individually with defaults. **This is already working in production.** The Phase 5 work extends it: more keys in SettingsMap, plus the `update_settings` write command.

## Frontend Routing & Sidebar Additions

### New Routes (in App.tsx)
```tsx
{session.role === 'owner' && (
  <>
    <Route path="/reports" element={<ReportsPage session={session} />} />
    <Route path="/settings" element={<SettingsPage session={session} />} />
  </>
)}
```

### New Sidebar Items (in Sidebar.tsx)
```tsx
const navItems: NavItem[] = [
  // ... existing items ...
  { title: 'Reports', url: '/reports', icon: BarChart3, roles: ['owner'] },
  { title: 'Settings', url: '/settings', icon: Settings, roles: ['owner'] },
];
```

### Reports Page Layout
The ReportsPage is a master-detail view:
1. **Left sidebar:** Report type list (9 items grouped into categories: Sales, Stock, Financial)
2. **Main area:** Date range picker (default: last 30 days) + report table + Recharts chart + "Download PDF" button
3. Each report type selected loads its specific data from the backend
4. The PDF download uses `PDFDownloadLink` wrapping the specific PDF document component

## Build Order

**Wave 1: Backend foundation (parallelizable)**
1. Extend `models/settings.rs` with all new settings fields (pharmacy info, backup, financial toggles)
2. Extend `models/report.rs` with all 9 report DTOs + `UpdateSettingsPayload`
3. Create `services/report_service.rs` with all 9 aggregation functions
4. Extend `services/settings_service.rs` with `update_settings` function
5. Add `services/user_service.rs::change_password` function

**Wave 2: Commands (parallelizable)**
6. Create `commands/report_commands.rs` with all 9 owner-guarded commands
7. Create `commands/backup_commands.rs`: trigger_backup, restore_backup, connect_drive, disconnect_drive, list_drive_backups
8. Extend `commands/settings_commands.rs` with `update_settings` command
9. Extend `commands/user_commands.rs` with `change_password` command
10. Register all new commands in `main.rs` invoke_handler

**Wave 3: Backup service (can overlap with Wave 2)**
11. Create `services/backup_service.rs` with VACUUM INTO + gzip + Drive upload + local folder + restore + pre-restore backup
12. Add auto-backup timer in Tauri setup
13. Add `tauri-plugin-shell` for opening OAuth URLs

**Wave 4: Frontend reports**
14. Create `src/types/report.ts` with all report DTO types
15. Extend `src/lib/tauri.ts` with report + backup + settings write + password change methods
16. Create report components (DateRangePicker, per-report table/chart components)
17. Create PDF document components (per-report PDF documents)
18. Create `ReportsPage.tsx` master-detail view

**Wave 5: Frontend settings & user management**
19. Create settings tab components (PharmacyInfoTab, FinancialTab, InventoryTab, BackupTab)
20. Create `SettingsPage.tsx` tabbed page
21. Add password change UI to UsersPage

**Wave 6: Wiring & polish**
22. Add Reports and Settings to sidebar nav
23. Add report and settings routes to App.tsx
24. Add backup status widget to DashboardPage
25. Add missed-backup warning to DashboardPage
26. Verify user management completeness (D-78)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SQLite file copy for backup | VACUUM INTO for atomic snapshot | 2018 (SQLite 3.27.0) | VACUUM INTO is safer, simpler, and atomic — the only correct way for single-user desktop |
| Google Drive v2 API | Google Drive v3 API | 2020 | v3 is simpler (no parent folder concept changes); multipart upload still standard |
| jsPDF imperative PDF | @react-pdf/renderer declarative | 2019+ | React developers write PDF components same as UI components; no manual coordinate math |
| Tauri v1 async commands | Tauri v2 async + blocking support | 2024 | Tauri v2 has `spawn_blocking` and better async runtime for long operations |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Google Drive OAuth token stored as JSON in settings table is acceptable security for a single-user desktop app | Backup | If user has stricter security requirements, tokens should be stored in OS credential manager (Windows Credential Manager) via Tauri store plugin |
| A2 | `reqwest::blocking` is available with the features `json` and `multipart` | Standard Stack | If reqwest doesn't support blocking multipart well, switch to `ureq` or use async reqwest with `tauri::async_runtime` |
| A3 | The Tauri shell plugin `tauri-plugin-shell` exposes `open` functionality to open browser URLs | Backup OAuth | If not, fall back to `open` crate or `webbrowser` crate which use the OS default opener |
| A4 | `VACUUM INTO` works correctly with WAL mode | Backup | VACUUM INTO is documented to work with WAL; it checkpoints WAL first then vacuums. Verified by SQLite docs. |
| A5 | Backup timer in a background thread can access `AppState` via `app.state()` | Backup | In Tauri v2, `AppHandle` provides state access; if not, pass a cloned `Arc<Mutex<Connection>>` |
| A6 | Settings write commands don't need validation beyond the service layer | Settings | If complex validation is needed later, add a validation step in `settings_service::update_settings` |

## Open Questions

1. **Google Drive OAuth redirect port conflict**
   - What we know: Localhost HTTP server on port 57432 captures OAuth redirect
   - What's unclear: If port 57432 is already in use
   - Recommendation: Try the configured port; if bind fails, increment port number and retry (up to 5 attempts)

2. **Drive token refresh timing**
   - What we know: Google tokens expire after 3600 seconds (1 hour)
   - What's unclear: Whether refresh_token can expire for installed apps (Google policy varies)
   - Recommendation: Handle token refresh failure gracefully — clear stored token, prompt user to re-connect Drive. Implement refresh logic in BackupService::upload

3. **Return refund impact on monthly P&L**
   - What we know: Refunds should be subtracted from revenue (D-61)
   - What's unclear: Should we match refunds to original sale month or refund processing month?
   - Recommendation: Use refund processing month (simpler, matches actual cash flow). The decision is in agent's discretion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm | @react-pdf/renderer install | ✓ | From package.json | — |
| Tauri v2 | All Rust commands | ✓ | 2.x | — |
| SQLite with WAL | VACUUM INTO backup | ✓ (built-in) | — | — |
| Google Drive API | Backup upload | — | v3 REST | Local folder backup (D-69) |
| Internet | Google Drive upload | — | — | Local folder fallback, offline mode |

**Missing dependencies with no fallback:**
- None — all infrastructure is either already installed or can be added via npm/cargo

**Missing dependencies with fallback:**
- Google Drive API access (requires internet): Local folder/USB backup is the offline fallback (D-69)
- Drive OAuth requires user to have a browser: Tauri desktop always has browser available via shell plugin

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Rust built-in `#[cfg(test)]` + `cargo test`; Frontend: Vitest |
| Config file | None — see Wave 0 |
| Quick run command | `cargo test --lib` (backend); `npx vitest run` (frontend) |
| Full suite command | `cargo test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| REPT-03 | Daily sales aggregation returns correct totals | Integration (SQL tests) | `cargo test report_service::test_daily_sales` |
| REPT-11 | Profit margin calculation matches D-61 formula | Integration | `cargo test report_service::test_profit_margin` |
| REPT-13 | Owner-only commands blocked for pharmacist | Unit (guard test) | `cargo test report_commands::test_owner_guard` |
| BAKP-09 | VACUUM INTO creates valid snapshot | Integration | `cargo test backup_service::test_vacuum_into` |
| BAKP-06 | Pre-restore backup created before restore | Integration | `cargo test backup_service::test_pre_restore` |
| SETT-07 | Settings write persists to DB and reads back | Integration | `cargo test settings_service::test_write_read` |

### Sampling Rate
- **Per task commit:** `cargo test --lib` (sub-5-second compile for small changes)
- **Per wave merge:** Full `cargo test` + `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] None — test infrastructure already exists from prior phases

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `require_owner` guard on report/backup/settings write commands (D-63) |
| V3 Session Management | yes | Existing session token validation reused |
| V4 Access Control | yes | Owner-only at command layer for all reports/backup/settings |
| V5 Input Validation | yes | Date format validation, path sanitization for VACUUM INTO |
| V6 Cryptography | yes | OAuth token storage (settings table), HTTPS for Drive API |

### Known Threat Patterns for Tauri Desktop
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Report data accessible to pharmacist | Elevation of Privilege | `require_owner` guard on EVERY report command — never just hide UI (D-63) |
| VACUUM INTO path injection | Tampering | Sanitize user-provided paths; reject paths with `..` or special characters |
| Backup file contains PHI | Information Disclosure | Backup files are gzip but not encrypted — user controls Drive/local storage security |
| OAuth token theft via settings read | Information Disclosure | Settings are already readable without auth (get_settings has no guard), but tokens are sensitive. Mitigate by adding `require_owner` to a new `get_backup_config` command separate from public get_settings |
| Restore replaces live data | Denial of Service | Pre-restore backup + typed confirmation + integrity check before swap (D-68) |
| Drive token refresh failure | Spoofing | Graceful degradation: clear token, show disconnected state, prompt re-auth |

## Sources

### Primary (HIGH confidence)
- [CITED: sqlite.org/lang_vacuum.html] — VACUUM INTO syntax and atomicity guarantees
- [CITED: developers.google.com/drive/api/guides/manage-uploads] — Drive API multipart upload
- [CITED: developers.google.com/identity/protocols/oauth2/native-app] — OAuth 2.0 for installed/native apps
- [CITED: react-pdf.org/components] — @react-pdf/renderer components API
- [CITED: docs.rs/reqwest/latest/reqwest/] — reqwest blocking client, multipart, JSON
- [CITED: docs.rs/flate2/latest/flate2/] — GzEncoder for gzip compression
- [VERIFIED: npm registry] — @react-pdf/renderer v4.5.1, recharts v3.8.1

### Secondary (MEDIUM confidence)
- [VERIFIED: codebase inspection] — Existing three-layer Rust architecture, command patterns, settings read pattern
- [VERIFIED: codebase inspection] — Database schema (all 4 migrations), sales/returns data model
- [VERIFIED: codebase inspection] — Frontend patterns (tauri.ts API wrapper, shadcn components, Recharts usage)

### Tertiary (LOW confidence)
- [ASSUMED] — Tauri v2 shell plugin opens browser URLs (confirmed by tauri-plugin-shell docs but not tested in this environment)
- [ASSUMED] — Google Drive OAuth refresh token behavior for installed/native apps (depends on Google policy, may need prod testing)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries verified via npm registry or docs.rs; patterns validated against codebase
- Architecture: HIGH — Report aggregation queries verified against existing schema; backup flow uses documented SQLite and Drive APIs
- Pitfalls: HIGH — Pitfalls based on documented behavior of VACUUM INTO, OAuth, and SQLite

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (30 days — libraries are stable; re-check if >30 days before execution)
