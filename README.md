# PharmaCare

A production-ready desktop pharmacy management application built with **Tauri 2.0**, **React**, **TypeScript**, and **SQLite**. Designed for offline-first use with role-based access (Owner / Pharmacist), real-time inventory tracking, and Google Drive backups.

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6)
![Rust](https://img.shields.io/badge/Rust-2021-orange)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### Point of Sale (POS)
- Fast medicine search with barcode/name/generic lookup
- Cart management with quantity editing and item removal
- Multiple payment methods (Cash, Card, Other)
- Customer debt tracking with WhatsApp reminders
- Automatic stock deduction on sale
- Receipt generation with PDF export

### Inventory Management
- Medicine catalog with categories, units, pricing, and reorder levels
- Batch tracking with expiry dates and purchase costs
- Stock ledger with full mutation history (sale, purchase, return, write-off)
- Low stock alerts and expiry warnings (configurable days)
- CSV bulk import for medicines
- Search and filter by category, stock status, active status

### Supplier Management
- Supplier directory with contact details
- Purchase recording with batch creation
- **Supplier debt tracking** — auto-created on pending/partial purchases
- Record payments against supplier debts
- Supplier return processing

### Customer Returns
- Return processing with sold-quantity validation
- Three return conditions: resellable (restock), damaged (write-off), expired (write-off)
- Automatic stock adjustment based on condition
- Return history with filters and pagination

### Financial Reports (9 Reports)
- **Daily Sales** — revenue, profit, items per day
- **Monthly P&L** — revenue, COGS, gross/net profit, refunds, write-offs
- **Top Sellers** — medicine ranking by quantity sold
- **Slow-Moving Stock** — medicines with low turnover
- **Low Stock** — items below reorder level
- **Expiry Report** — items expiring within warning/critical thresholds
- **Supplier Purchases** — spending by supplier
- **Sales by User** — performance per staff member
- **Profit Margin** — margin analysis per medicine

> All reports account for customer returns — returned quantities and refund amounts are subtracted from revenue/profit figures.

### Dashboard
- Today's sales and profit KPIs (return-adjusted)
- Monthly sales summary
- Low stock and expiry warning counts
- Top 5 selling medicines chart
- Backup status indicator
- **Auto-refreshes** when data changes in any other page

### User & Security
- Role-based access: Owner (full access) / Pharmacist (POS + returns only)
- bcrypt password hashing
- Session management with token-based auth
- Login audit log with filters (username, success/failure, date range)
- User CRUD with password management

### Settings
- Pharmacy info (name, address, phone, license)
- Financial config (currency symbol, tax rate, discount limits)
- Inventory config (expiry warning/critical days, reorder defaults)
- Theme toggle (Light / Dark / System)
- **Database migration status** — view DB size, migration progress, WAL/FK status

### Data & Backup
- Local SQLite database (zero config, offline-first)
- Google Drive backup integration (optional)
- Automatic backup scheduling
- Backup status banner with overdue warnings

### UX Polish
- **Dark mode** — full support across all pages, charts, and login screen
- **Event bus** — mutations in one page instantly update all dependent pages
- **Keyboard shortcuts** — `⌘1` through `⌘9` for quick navigation
- **Code splitting** — lazy-loaded routes for fast initial load
- **Pagination** — all list views with server-side offset/limit
- **UI sound effects** — optional audio feedback (default off, toggle in Settings)
- **Toast notifications** — non-intrusive success/error feedback
- **Responsive layout** — sidebar collapses on smaller screens
- **Skeleton loading** — smooth loading states

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Runtime | Tauri 2.0 |
| Frontend | React 18 + TypeScript 5.8 |
| Styling | Tailwind CSS 3.4 |
| UI Components | Radix UI + Base UI + custom |
| Charts | Recharts 3.8 |
| PDF Generation | @react-pdf/renderer |
| Backend | Rust (2021 edition) |
| Database | SQLite (rusqlite, bundled) |
| Auth | bcrypt password hashing |
| HTTP Client | reqwest (Google Drive API) |
| Build | Vite 7 |
| Testing | cargo test (69 Rust tests) + Vitest (frontend) |

---

## Project Structure

```
PharmaCare/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── auth/                 # Login form, forgot password
│   │   ├── layout/               # Sidebar, responsive shell
│   │   ├── medicines/            # Medicine form, list, import dialog
│   │   ├── pos/                  # POS cart, search, payment
│   │   ├── purchases/            # Purchase form, list
│   │   ├── reports/              # 9 report components + charts
│   │   ├── returns/              # Customer/supplier return forms
│   │   ├── settings/             # Settings tabs
│   │   ├── suppliers/            # Supplier form, list
│   │   ├── ui/                   # Shared UI components
│   │   └── users/                # User list, login audit
│   ├── hooks/                    # useTauriCommand, useSettings, useIsDark, useGlobalShortcuts
│   ├── lib/                      # tauri.ts (API), eventBus.ts, sounds.ts, utils
│   ├── pages/                    # 17 route pages
│   ├── types/                    # TypeScript interfaces
│   └── App.tsx                   # Router with lazy-loaded routes
├── src-tauri/                    # Backend (Rust)
│   ├── migrations/               # 9 SQLite migrations (001-009)
│   ├── src/
│   │   ├── commands/             # Tauri command handlers (13 modules)
│   │   ├── error.rs              # AppError type
│   │   ├── db.rs                 # Database connection
│   │   ├── main.rs               # Tauri app setup + command registration
│   │   ├── migrations.rs         # Migration runner
│   │   ├── models/               # Data structures (14 modules)
│   │   ├── repository/           # Database queries (14 modules)
│   │   └── services/             # Business logic (14 modules)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── .github/workflows/build.yml   # CI/CD (Windows, Linux, macOS)
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (recommended: 20)
- **Rust** (install via [rustup](https://rustup.rs/))
- **System dependencies** (Linux only):
  ```bash
  sudo apt-get install libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```

### Development

```bash
# Install frontend dependencies
npm install

# Start development server (hot reload)
npm run tauri dev
```

### Build

```bash
# Build for production
npm run tauri build
```

Output locations:
- **Linux**: `src-tauri/target/release/bundle/deb/` and `AppImage/`
- **Windows**: `src-tauri/target/release/bundle/msi/` and `nsis/`
- **macOS**: `src-tauri/target/release/bundle/dmg/`

### Tests

```bash
# Rust backend tests (69 tests)
cd src-tauri && cargo test

# Frontend tests
npm test
```

---

## CI/CD

GitHub Actions workflow (`.github/workflows/build.yml`) builds for all platforms:

| Platform | Output |
|----------|--------|
| Ubuntu 22.04 | `.deb` + `.AppImage` |
| Windows | `.exe` + `.msi` |
| macOS (ARM) | `.dmg` |

### Trigger a release build:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This creates a GitHub Release with all platform installers attached.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘1` | POS |
| `⌘2` | POS History |
| `⌘3` | Dashboard |
| `⌘4` | Medicines |
| `⌘5` | Suppliers |
| `⌘6` | Purchases |
| `⌘7` | Reports |
| `⌘8` | Supplier Debts |
| `⌘9` | Users |

---

## Environment Variables (Optional)

For Google Drive backup functionality:

```bash
export GOOGLE_OAUTH_CLIENT_ID="xxxxx.apps.googleusercontent.com"
export GOOGLE_OAUTH_CLIENT_SECRET="GOCSPX-xxxxx"
```

OAuth client must be a **Web application** type with redirect URI:
`http://localhost:57432/callback`

Scope: `https://www.googleapis.com/auth/drive.file`

---

## Database

SQLite database stored at:
- **Linux**: `~/.local/share/com.pharmacare.app/pharmacare.db`
- **Windows**: `%APPDATA%/com.pharmacare.app/pharmacare.db`
- **macOS**: `~/Library/Application Support/com.pharmacare.app/pharmacare.db`

9 migrations handle schema evolution. Migration status viewable in Settings > Database.

---

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Owner | `admin` | `admin123` |
| Pharmacist | `pharmacist` | `pharma123` |

> Change these immediately in production.

---

## License

MIT
