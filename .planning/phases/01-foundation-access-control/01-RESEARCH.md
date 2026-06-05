# Phase 1: Foundation & Access Control - Research

**Researched:** 2026-06-05
**Domain:** Tauri 2.0 + React + TypeScript desktop shell with SQLite persistence, authentication, RBAC, and user management
**Confidence:** HIGH (Tauri 2.0, rusqlite, bcrypt, shadcn/ui — all well-documented, verified via Context7 and npm/crates.io)

## Summary

Phase 1 establishes the spine of the PharmaCare desktop application: a Tauri 2.0 shell with Rust backend services, React/TypeScript UI, and SQLite persistence. Research confirms the architecture approach (rusqlite in Rust commands, NOT Prisma in frontend) is sound and well-documented. The bcrypt crate (v0.19.1) and rusqlite (v0.40.0) are current and stable. Session management should use Rust `State<Mutex<>>` to hold an in-memory session map backed by a SQLite `sessions` table for persistence across restarts. RBAC enforcement happens at the Tauri command layer via a guard pattern — every command checks session validity and role before executing.

**Primary recommendation:** Build the Rust backend as a layered service architecture (SqlitePool → Repository → Service → Tauri Commands), with session state managed in a `Mutex<HashMap<String, Session>>` via `tauri::State`. All database access exclusively through Rust commands (no `@tauri-apps/plugin-sql` in the frontend). Use `rusqlite_migration` for schema versioning with embedded SQL files.

**Key architectural risks to resolve in planning:**
1. Connection pooling — single `rusqlite::Connection` wrapped in `Mutex` works for a single-user desktop app; no need for deadpool-sqlite at this scale.
2. Session token format — UUID v4 generated in Rust on login, stored in `sessions` table and in-memory HashMap, cleared on logout/app-close.
3. Setup wizard detection — check `SELECT COUNT(*) FROM users` at startup; if 0, frontend shows setup wizard instead of login.
4. Password strength — minimum 6 chars enforced on Rust side (D-06).
5. Owner seeding — first setup creates an Owner account; subsequent admins created via user management screen.

## User Constraints (from CONTEXT.md)

### Locked Decisions

| ID | Decision |
|----|----------|
| D-01 | Use rusqlite/sqlx in Rust Tauri commands for database access — NOT Prisma in the frontend. Runtime database access happens exclusively through Rust Tauri commands. |
| D-02 | Enable WAL journal mode (`PRAGMA journal_mode=WAL`), foreign keys (`PRAGMA foreign_keys=ON`), and busy timeout (`PRAGMA busy_timeout=5000`) on every database connection. |
| D-03 | Include the `stock_movements` ledger table in the initial migration — even though Phase 2 implements the full stock intake. |
| D-04 | Session stored in-memory with a SQLite `sessions` table. React checks session validity on app start by calling a Tauri command. No session tokens stored in localStorage. Session exists until user logs out or app closes. |
| D-05 | Setup wizard on first launch guides the creation of the initial Owner account. No hardcoded default credentials. |
| D-06 | Password minimum length: 6 characters. No additional complexity requirements for v1. |
| D-07 | Sidebar navigation using shadcn/ui sidebar component. Owner sees full navigation; Pharmacist sees a restricted set. |
| D-08 | UI language is English only for v1. |
| D-09 | Each login attempt logs: timestamp, username, success/failure, attempted role. Stored in a `login_attempts` SQLite table. Accessible only by Owner role. |
| D-10 | Users are never hard-deleted — only deactivated (`is_active = false`). Deactivated users cannot log in but their historical sales records are preserved. |
| D-11 | System must always have at least one active Owner account. Owner cannot delete their own account. |
| D-12 | Roles are fixed: `owner` and `pharmacist`. No custom roles for v1. |

### the agent's Discretion
- Password hashing implementation (bcrypt via Rust crate)
- Exact session table schema and session token format
- Specific component structure for the sidebar layout
- Error message wording for login failures
- Login screen design details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with username and password | bcrypt::verify() in Rust commands; Tauri IPC for form submission; session stored in Rust state [VERIFIED: crates.io - bcrypt 0.19.1] |
| AUTH-02 | Passwords stored as bcrypt hashes — never plaintext | bcrypt::hash() with default cost (12); password_hash field in users table; hash on account creation [VERIFIED: crates.io - bcrypt 0.19.1] |
| AUTH-03 | Session persists until user logs out or app closes | In-memory HashMap<String, Session> via `tauri::State<Mutex<SessionState>>`; sessions table for persistence; session cleared on `logout` command or app close event [VERIFIED: Tauri docs v2.tauri.app/develop/state-management] |
| AUTH-04 | All login attempts (success and failure) logged | `login_attempts` table; Rust auth service writes attempt record before/after bcrypt verify; accessible via owner-only Tauri command [DERIVED: D-09] |
| AUTH-05 | Inactive users cannot log in but historical records preserved | Auth service checks `users.is_active = 1` before allowing login; deactivated users blocked; records preserved via `is_active` flag [DERIVED: D-10] |
| USER-01 | Owner can add user (full name, username, password, role) | `create_user` Tauri command with owner role guard; bcrypt hashing at creation; username uniqueness enforced via SQL UNIQUE constraint [VERIFIED: sqlite.org/docs] |
| USER-02 | Owner can deactivate user (preserves sales history) | `deactivate_user` Tauri command with owner guard; sets `is_active = 0`; does not cascade-delete related records [DERIVED: D-10] |
| USER-03 | Owner cannot delete their own account | Business rule in `deactivate_user` service: reject if `target_user_id == current_session.user_id` [DERIVED: D-11] |
| USER-04 | System requires at least one active Owner account | Business rule in `deactivate_user`: reject if `is_active=true` and role=owner and `COUNT(*) WHERE role=owner AND is_active=1` would drop to 0 [DERIVED: D-11] |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User authentication | Rust backend (AuthService) | React UI (login form) | bcrypt verification and session creation must happen in Rust; form rendering is UI concern |
| Session management | Rust backend (in-memory State) | SQLite (persistence) | D-04 mandates in-memory session; sessions table provides crash-recovery persistence |
| RBAC enforcement | Rust backend (command guard) | React UI (navigation) | D-01 mandates all DB access through Rust; frontend-only hiding is insufficient security |
| User management CRUD | Rust backend (service) | React UI (forms) | Create/deactivate require bcrypt hashing and owner-role guard in Rust |
| Login audit logging | Rust backend (AuthService) | — | Write happens synchronously in auth flow; read-only view is owner-only command |
| Database persistence / migrations | Rust backend (rusqlite) | — | D-01: all DB access through Rust commands |
| First-run setup wizard | React UI (wizard flow) | Rust backend (detection) | Rust detects 0 users and signals frontend; React renders the wizard |
| Sidebar navigation | React UI (shadcn sidebar) | — | D-07: sidebar is purely UI; role-based menu items derived from session |
| Password hashing | Rust backend (bcrypt crate) | — | Sensitive cryptographic operation must happen server-side (Rust) |
| App data directory / DB location | Rust backend (setup) | — | Resolved at startup via `app.path().app_data_dir()` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri 2 | 2.x stable | Desktop shell, IPC, permissions | Lightweight native Windows app; v2 stable with improved permissions model [CITED: v2.tauri.app] |
| React | 19.2.7 | UI rendering | Component model for interactive forms, sidebar, and POS [VERIFIED: npm registry] |
| TypeScript | 6.0.3 | Type-safe frontend | Avoids runtime type errors at IPC boundary [VERIFIED: npm registry] |
| Tailwind CSS | latest v4 | Utility-first styling | Pairs with shadcn/ui; rapid UI development [VERIFIED: npm registry] |
| shadcn/ui | 2.4.0 | Pre-built React components | Sidebar, dialogs, forms, data tables; MIT licensed [VERIFIED: npm registry] |
| rusqlite | 0.40.0 | SQLite from Rust | Ergonomic Rust bindings; prepared statements, transactions, WAL pragmas [VERIFIED: crates.io] |
| rusqlite_migration | 2.6.0 | Schema migrations | Embedded SQL migrations; uses user_version for fast version checking; validates migration sequence [CITED: docs.rs/rusqlite_migration] |
| bcrypt crate | 0.19.1 | Password hashing | Industry standard; default cost factor 12; verify() method for login [VERIFIED: crates.io] |
| serde / serde_json | 1.0.228 | JSON serialization | Required for Tauri command DTO serialization; derive macros for all request/response types [VERIFIED: crates.io] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | latest | Icon library for shadcn sidebar | Sidebar navigation icons, button icons |
| radix-ui | latest | Accessible UI primitives | shadcn sidebar depends on react-collapsible from radix |
| class-variance-authority | latest | Utility for component variants | Used by shadcn sidebar component |
| uuid crate | 1.x | Session token generation | Generate v4 UUIDs for session tokens [VERIFIED: crates.io] |
| chrono crate | 0.4.x | Timestamps | ISO 8601 timestamps for audit logs [ASSUMED - standard Rust ecosystem] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rusqlite (direct Rust) | Prisma (Node.js sidecar) | Prisma adds Node.js packaging, process supervision, IPC complexity; rusqlite is simpler for single-user desktop app |
| rusqlite + Mutex | deadpool-sqlite (connection pool) | deadpool adds async pool overhead; single-user app needs only one connection with Mutex |
| bcrypt crate | argon2 crate | bcrypt is well-established, simpler, and specified by PRD; argon2 is newer but equally valid |
| In-memory Session via State | localStorage session token | D-04 explicitly forbids localStorage; Rust memory is more secure |
| rusqlite_migration (embedded SQL) | refinery (migration framework) | rusqlite_migration is simpler (no CLI needed), uses user_version, validates migrations in tests |

**Installation:**
```bash
# Frontend
npm create tauri-app@latest -- --template react-ts
npm install @shadcn/ui lucide-react class-variance-authority
npx shadcn@latest add sidebar

# Rust (in src-tauri/Cargo.toml)
cargo add rusqlite --features bundled
cargo add rusqlite_migration
cargo add bcrypt
cargo add serde --features derive
cargo add serde_json
cargo add uuid --features v4
cargo add chrono
```

**Version verification:**
```bash
# Verified 2026-06-05
npm view @tauri-apps/cli version        # 2.11.2
npm view @tauri-apps/api version        # 2.11.0
npm view react version                  # 19.2.7
npm view typescript version             # 6.0.3
cargo search bcrypt --limit 1           # bcrypt = "0.19.1"
cargo search rusqlite --limit 1         # rusqlite = "0.40.0"
cargo search rusqlite_migration --limit 1 # rusqlite_migration = "2.6.0"
```

## Architecture Patterns

### System Architecture Diagram

```text
 ┌──────────────────────────────────────────────┐
 │              React UI (TypeScript)             │
 │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
 │  │ Login    │ │ Setup    │ │ User Mgmt    │  │
 │  │ Screen   │ │ Wizard   │ │ Screen       │  │
 │  └────┬─────┘ └────┬─────┘ └──────┬───────┘  │
 │       │            │              │           │
 │  ┌────▼────────────▼──────────────▼───────┐  │
 │  │     shadcn/ui Sidebar (role-based)      │  │
 │  │        react-router / client nav         │  │
 │  └────────────────┬──────────────────────┘  │
 │                   │                          │
 │         invoke() via @tauri-apps/api         │
 └───────────────────┬──────────────────────────┘
                     │  Tauri IPC Boundary
 ┌───────────────────▼──────────────────────────┐
 │         Rust Backend (Tauri Commands)         │
 │                                               │
 │  ┌─────────────┐  ┌──────────────────────┐   │
 │  │ Command     │  │ AppState              │   │
 │  │ Handlers    │  │  ├─ db: Mutex<Conn>  │   │
 │  │  auth_login │  │  └─ sessions:        │   │
 │  │  auth_logout│  │     Mutex<HashMap>   │   │
 │  │  create_user│  └──────────────────────┘   │
 │  │  deactivate │                              │
 │  │  list_users │  ┌──────────────────────┐   │
 │  │  get_session│  │ Services              │   │
 │  │  check_setup│  │  ├─ AuthService      │   │
 │  └──────┬──────┘  │  ├─ UserService      │   │
 │         │         │  └─ AuditService     │   │
 │         │         └─────────┬────────────┘   │
 │         │                   │                 │
 │         ▼                   ▼                 │
 │  ┌────────────────────────────────────────┐   │
 │  │  rusqlite::Connection (Mutex-wrapped)   │   │
 │  │  + rusqlite_migration (schema mgmt)     │   │
 │  │  + WAL / foreign_keys / busy_timeout    │   │
 │  └────────────────┬───────────────────────┘   │
 │                   │                             │
 └───────────────────┴─────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  pharmacare.db         │
         │  pharmacare.db-wal     │
         │  pharmacare.db-shm     │
         │  (in %APPDATA%/        │
         │   com.pharmacare.app/) │
         └───────────────────────┘
```

**Flow: Login (primary use case):**
```
User submits credentials
  → React invokes `auth_login` command via Tauri IPC
  → Command handler receives DTO, extracts session from State
  → AuthService looks up user by username
  → AuthService checks is_active flag
  → AuthService calls bcrypt::verify(password, hash)
  → AuthService writes login_attempts record
  → On success: AuthService generates UUID session token
  → On success: inserts session row in sessions table
  → On success: inserts session into in-memory HashMap
  → Returns SessionDto { token, user_id, role, full_name } to React
  → React stores token in Zustand/context (NOT localStorage per D-04)
```

**Flow: Command RBAC guard (every mutating command):**
```
React invokes `create_user` with session token + payload
  → Command handler extracts session_token from payload
  → Lookup session_token in in-memory HashMap (or fallback to sessions table)
  → Verify session.user.role == "owner"; reject if not
  → Execute service logic
  → Return success/error DTO
```

### Recommended Project Structure

```
pharmacare/
├── src/                          # React frontend
│   ├── main.tsx                  # App entry point
│   ├── App.tsx                   # Root component (+ router)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components (generated)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx       # shadcn sidebar (role-based)
│   │   │   ├── Header.tsx        # User info, logout button
│   │   │   └── AppShell.tsx      # Sidebar + content area layout
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx     # Username/password form
│   │   │   └── SetupWizard.tsx   # First-run owner creation
│   │   └── users/
│   │       ├── UserList.tsx      # Table of users
│   │       └── AddUserDialog.tsx # Modal form for new user
│   ├── hooks/
│   │   ├── useAuth.ts            # Session state, login/logout
│   │   └── useTauriCommand.ts    # Generic Tauri invoke wrapper
│   ├── lib/
│   │   └── tauri.ts              # Tauri invoke helpers
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── SetupWizardPage.tsx
│   │   ├── DashboardPage.tsx     # Phase 3+
│   │   └── UsersPage.tsx
│   └── types/
│       ├── session.ts            # SessionDto, LoginDto, etc.
│       └── user.ts               # UserDto, CreateUserDto, etc.
├── src-tauri/
│   ├── src/
│   │   ├── main.rs               # Tauri builder, plugin setup
│   │   ├── lib.rs                 # Module declarations
│   │   ├── state.rs              # AppState struct (db, sessions)
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── auth_commands.rs   # login, logout, check_session
│   │   │   ├── user_commands.rs   # create_user, deactivate_user, list_users
│   │   │   ├── setup_commands.rs  # check_first_run, create_owner
│   │   │   └── audit_commands.rs  # get_login_attempts (owner-only)
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── auth_service.rs
│   │   │   ├── user_service.rs
│   │   │   └── audit_service.rs
│   │   ├── repository/
│   │   │   ├── mod.rs
│   │   │   ├── user_repo.rs
│   │   │   ├── session_repo.rs
│   │   │   └── audit_repo.rs
│   │   ├── models/
│   │   │   ├── mod.rs
│   │   │   ├── user.rs
│   │   │   ├── session.rs
│   │   │   └── login_attempt.rs
│   │   ├── errors.rs             # AppError enum, Into<InvokeError>
│   │   ├── guards.rs             # require_owner(), require_session()
│   │   └── migrations.rs         # rusqlite_migration definitions
│   ├── migrations/               # SQL migration files (optional, can be inline)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── tailwind.config.ts
```

### Pattern 1: Session-Guarded Tauri Command

**What:** Every command that requires authentication uses a helper to extract and validate the session from the in-memory state.

**When to use:** All Tauri commands that need auth or RBAC.

**Source:** [CITED: v2.tauri.app/develop/state-management]

```rust
// src-tauri/src/guards.rs
use tauri::State;
use crate::state::AppState;
use crate::models::session::Session;

#[derive(Debug, Serialize)]
pub struct SessionInfo {
    pub user_id: i64,
    pub username: String,
    pub role: String,
    pub full_name: String,
}

#[derive(Debug, Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl From<CommandError> for tauri::ipc::InvokeError {
    fn from(e: CommandError) -> Self {
        tauri::ipc::InvokeError::from(e.to_string())
    }
}

pub fn require_session(state: &AppState, token: &str) -> Result<SessionInfo, CommandError> {
    let sessions = state.sessions.lock().map_err(|_| CommandError {
        code: "INTERNAL".into(),
        message: "Failed to acquire lock".into(),
    })?;

    sessions
        .get(token)
        .map(|s| SessionInfo {
            user_id: s.user_id,
            username: s.username.clone(),
            role: s.role.clone(),
            full_name: s.full_name.clone(),
        })
        .ok_or_else(|| CommandError {
            code: "UNAUTHORIZED".into(),
            message: "Invalid or expired session".into(),
        })
}

pub fn require_owner(state: &AppState, token: &str) -> Result<SessionInfo, CommandError> {
    let session = require_session(state, token)?;
    if session.role != "owner" {
        return Err(CommandError {
            code: "FORBIDDEN".into(),
            message: "Owner role required".into(),
        });
    }
    Ok(session)
}
```

```rust
// src-tauri/src/commands/user_commands.rs
#[tauri::command]
fn create_user(
    state: State<'_, AppState>,
    session_token: String,
    payload: CreateUserDto,
) -> Result<UserDto, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    // Validate password length
    if payload.password.len() < 6 {
        return Err(CommandError {
            code: "VALIDATION".into(),
            message: "Password must be at least 6 characters".into(),
        });
    }
    let user = state.services.user_service.create_user(payload)?;
    Ok(user)
}
```

### Pattern 2: In-Memory Session State

**What:** Sessions live in a Rust-managed `HashMap` keyed by UUID token. On startup, existing sessions are loaded from SQLite for crash recovery across app restarts.

**Source:** [CITED: v2.tauri.app/develop/calling-rust], [DERIVED: D-04]

```rust
// src-tauri/src/state.rs
use std::collections::HashMap;
use std::sync::Mutex;
use rusqlite::Connection;
use crate::models::session::StoredSession;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub sessions: Mutex<HashMap<String, StoredSession>>,
    pub services: AppServices,
}

pub struct AppServices {
    pub auth_service: AuthService,
    pub user_service: UserService,
    pub audit_service: AuditService,
}

// In main.rs setup:
// 1. Open SQLite connection
// 2. Run migrations via rusqlite_migration
// 3. Load any unexpired sessions from sessions table into HashMap
// 4. Register AppState with tauri::Builder::default().manage(state)
```

### Pattern 3: Auth Login Transaction

**What:** Login operation reads user, verifies bcrypt, creates session, logs attempt — all within business-logic service.

**Source:** [CITED: docs.rs/bcrypt/latest], [VERIFIED: crates.io bcrypt 0.19.1]

```rust
// src-tauri/src/services/auth_service.rs
use bcrypt::{hash, verify, DEFAULT_COST};
use uuid::Uuid;
use chrono::Utc;

pub struct AuthService {
    user_repo: UserRepository,
    session_repo: SessionRepository,
    audit_repo: AuditRepository,
}

impl AuthService {
    pub fn login(&self, db: &Connection, sessions: &mut HashMap<String, StoredSession>, username: &str, password: &str) -> Result<SessionDto, AuthError> {
        // Look up user
        let user = self.user_repo.find_by_username(db, username)
            .ok_or(AuthError::InvalidCredentials)?;

        // Check active
        if !user.is_active {
            self.audit_repo.log_attempt(db, username, false, Some("inactive".into()));
            return Err(AuthError::AccountDeactivated);
        }

        // Verify password
        let valid = verify(password, &user.password_hash)
            .map_err(|_| AuthError::InternalError)?;
        if !valid {
            self.audit_repo.log_attempt(db, username, false, Some("wrong_password".into()));
            return Err(AuthError::InvalidCredentials);
        }

        // Create session
        let token = Uuid::new_v4().to_string();
        let session = StoredSession {
            token: token.clone(),
            user_id: user.id,
            username: user.username.clone(),
            role: user.role.clone(),
            full_name: user.full_name.clone(),
            created_at: Utc::now(),
        };

        // Persist to SQLite
        self.session_repo.insert(db, &session)?;

        // Insert into in-memory HashMap
        sessions.insert(token.clone(), session.clone());

        // Log success
        self.audit_repo.log_attempt(db, username, true, None);

        Ok(SessionDto {
            token,
            user_id: user.id,
            username: user.username,
            role: user.role,
            full_name: user.full_name,
        })
    }
}
```

### Pattern 4: Migration Setup with rusqlite_migration

**What:** All schema migrations defined inline in Rust, validated by `migrations.validate()` in tests.

**Source:** [CITED: docs.rs/rusqlite_migration/2.6.0]

```rust
// src-tauri/src/migrations.rs
use rusqlite_migration::{Migrations, M};

pub fn get_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../migrations/001_initial/up.sql")),
        // Future migrations added here:
        // M::up(include_str!("../migrations/002_medicine_catalog/up.sql")),
    ])
}
```

```sql
-- src-tauri/migrations/001_initial/up.sql
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT NOT NULL,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('owner', 'pharmacist')),
    is_active     INTEGER DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    token      TEXT UNIQUE NOT NULL,
    role       TEXT NOT NULL,
    username   TEXT NOT NULL,
    full_name  TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE login_attempts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT NOT NULL,
    attempted_role TEXT,
    success        INTEGER NOT NULL,
    failure_reason TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE stock_movements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_type   TEXT NOT NULL,
    medicine_id     INTEGER,
    batch_id        INTEGER,
    quantity_delta  INTEGER NOT NULL,
    reference_type  TEXT NOT NULL,
    reference_id    INTEGER,
    reason          TEXT,
    user_id         INTEGER NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Initial Data

- First-run detection: `SELECT COUNT(*) FROM users`
- When 0 users, frontend shows SetupWizardPage which creates the initial Owner
- Settings seeded: `setup_complete = 'false'` (set to `'true'` after wizard completes)
- Future migrations: Phase 2 adds medicines, batches, suppliers, purchases, purchase_items

### Pattern 5: First-Run Detection

**What:** On app startup, a dedicated Tauri command checks whether the initial owner has been created.

**Source:** [DERIVED: D-05]

```rust
// src-tauri/src/commands/setup_commands.rs
#[tauri::command]
fn check_setup_status(state: State<'_, AppState>) -> Result<SetupStatus, CommandError> {
    let db = state.db.lock().map_err(|_| ...)?;
    let count: i64 = db.query_row(
        "SELECT COUNT(*) FROM users",
        [],
        |row| row.get(0),
    ).map_err(|_| ...)?;

    Ok(SetupStatus {
        needs_setup: count == 0,
    })
}
```

```typescript
// src/hooks/useAuth.ts
import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect } from 'react';

export function useAuth() {
  const [isSetupNeeded, setIsSetupNeeded] = useState<boolean | null>(null);

  useEffect(() => {
    invoke<{ needs_setup: boolean }>('check_setup_status')
      .then((result) => setIsSetupNeeded(result.needs_setup))
      .catch(() => setIsSetupNeeded(true));
  }, []);

  return { isSetupNeeded };
}
```

### Anti-Patterns to Avoid
- **Raw SQL from React via `@tauri-apps/plugin-sql`:** Bypasses RBAC, exposes all data to frontend, makes stock invariants unenforceable. Use Rust commands instead.
- **Storing session tokens in localStorage:** D-04 forbids this. Session exists only in Rust memory. React calls `get_session` on app start to verify validity.
- **Password stored as plaintext:** Verified through D-02 requirement; bcrypt crate handles this correctly.
- **Frontend-only role hiding:** Hiding buttons in UI but leaving commands unprotected. Every Tauri command that requires a role MUST check server-side.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Manual bcrypt implementation | `bcrypt` crate (0.19.1) | Correct cost factor, constant-time comparison, well-audited code [VERIFIED: crates.io] |
| Schema migrations | Manual version tracking in SQL | `rusqlite_migration` (2.6.0) | Uses SQLite `user_version`; validates entire migration sequence in tests; atomic updates [CITED: docs.rs/rusqlite_migration] |
| UUID generation | Sequential IDs or custom format | `uuid` crate with `v4` feature | Cryptographically random tokens; prevents session guessing |
| JSON serialization | Manual string formatting | `serde` + `serde_json` (1.0.228) | Required by Tauri IPC; `#[derive(Serialize, Deserialize)]` on all DTOs |
| App data directory path | Hardcoded path | `app.path().app_data_dir()` Tauri API | Cross-platform correct; respects OS data directory conventions [CITED: v2.tauri.app] |

**Key insight:** Password hashing, UUID generation, and migration management are deceptively complex. The ecosystem crates handle edge cases (constant-time comparison, concurrent migration safety, URL-safe tokens) that custom code would get wrong.

## Common Pitfalls

### Pitfall 1: Exposing database access to frontend via plugin-sql
**What goes wrong:** Frontend components bypass Rust command guards and directly query/mutate SQLite, leaking purchase prices, enabling unauthorized user creation.
**Why it happens:** The `@tauri-apps/plugin-sql` plugin makes it trivial to call SQL from React. The PRD initially suggested Prisma in the frontend.
**How to avoid:** Never register the `tauri-plugin-sql` with frontend access. All DB access goes through Rust commands. The `capabilities` file should NOT include `sql:allow-execute` or similar.
**Warning signs:** React code imports from `@tauri-apps/plugin-sql` or uses `invoke('plugin:sql:execute', ...)`.

### Pitfall 2: Session not cleared on app close
**What goes wrong:** Session data remains in SQLite after app close; re-opening the app might auto-login from stale session.
**Why it happens:** Tauri app close can be sudden. The `onCloseRequested` event in React may not fire on force-close.
**How to avoid:** On app startup, load sessions from SQLite for crash recovery (D-04 allows this) but set a reasonable TTL. However, D-04 says "Session exists until user logs out or app closes" — so on close, we should clear. Use Tauri's `on_window_event` in Rust to capture `CloseRequested` and clear sessions.
**Warning signs:** Reopening the app finds user still logged in from a previous session.

### Pitfall 3: Mutex deadlocks from nested Rust commands
**What goes wrong:** A command acquires the `db` Mutex lock, calls a service that tries to acquire the `sessions` Mutex lock, while another thread holds `sessions` and tries to acquire `db` — deadlock.
**Why it happens:** Desktop apps don't usually have thread contention, but async Tauri commands can interleave.
**How to avoid:** Acquire locks in a consistent order (db first, then sessions, never the reverse). Or use `try_lock` with error handling. Keep lock durations short — release db lock before calling other services when possible.
**Warning signs:** App freezes intermittently during concurrent operations (e.g., switching screens while a command is running).

### Pitfall 4: bcrypt cost setting too high causing login >3s
**What goes wrong:** Default bcrypt cost (12) takes ~250ms on modern hardware — fine. But if set to 14+ or used on very old Windows hardware, login becomes sluggish.
**Why it happens:** bcrypt is intentionally slow; higher costs increase time exponentially.
**How to avoid:** Use `DEFAULT_COST` (12). The hashing happens only on account creation and login. Consider logging cost times during testing and document.
**Warning signs:** Login takes >500ms on target hardware.

### Pitfall 5: Enabling foreign keys AFTER creating tables
**What goes wrong:** `PRAGMA foreign_keys=ON` only affects the current connection. If tables were created without foreign keys enabled, the constraints don't apply retroactively.
**Why it happens:** SQLite defaults to foreign keys OFF. PRAGMA must be set per connection.
**How to avoid:** Set pragmas immediately after opening the connection, before running migrations. Verify with `PRAGMA foreign_keys` query in test.
**Warning signs:** Foreign key violations silently allowed.

## Code Examples

### Tauri 2.0 Builder Setup with SQLite and State

```rust
// src-tauri/src/main.rs
use rusqlite::Connection;
use rusqlite_migration::Migrations;
use std::sync::Mutex;
use std::collections::HashMap;

mod state;
mod commands;
mod services;
mod repository;
mod models;
mod errors;
mod guards;
mod migrations;

use state::{AppState, AppServices, DbContainer};

fn main() {
    let migrations = migrations::get_migrations();

    tauri::Builder::default()
        .setup(|app| {
            // Get app data directory for SQLite file
            let app_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("pharmacare.db");

            // Open connection with WAL + foreign keys + busy timeout
            let mut conn = Connection::open(&db_path)?;
            conn.execute_batch("
                PRAGMA journal_mode=WAL;
                PRAGMA foreign_keys=ON;
                PRAGMA busy_timeout=5000;
            ")?;

            // Run migrations
            migrations.to_latest(&mut conn)?;

            // Load existing sessions from DB
            let sessions = load_sessions(&conn)?;

            // Build services
            let services = AppServices::new();

            // Register state
            app.manage(AppState {
                db: Mutex::new(conn),
                sessions: Mutex::new(sessions),
                services,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth_commands::auth_login,
            commands::auth_commands::auth_logout,
            commands::auth_commands::check_session,
            commands::user_commands::create_user,
            commands::user_commands::deactivate_user,
            commands::user_commands::list_users,
            commands::setup_commands::check_setup_status,
            commands::setup_commands::create_initial_owner,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn load_sessions(conn: &Connection) -> Result<HashMap<String, models::session::StoredSession>, Box<dyn std::error::Error>> {
    let mut stmt = conn.prepare("SELECT token, user_id, username, role, full_name, created_at FROM sessions")?;
    let sessions = stmt.query_map([], |row| {
        Ok(models::session::StoredSession {
            token: row.get(0)?,
            user_id: row.get(1)?,
            username: row.get(2)?,
            role: row.get(3)?,
            full_name: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;

    let mut map = HashMap::new();
    for session in sessions {
        if let Ok(s) = session {
            map.insert(s.token.clone(), s);
        }
    }
    Ok(map)
}
```

### Login Command Handler

```rust
// src-tauri/src/commands/auth_commands.rs
use tauri::State;
use serde::Deserialize;
use crate::state::AppState;
use crate::guards::CommandError;

#[derive(Deserialize)]
pub struct LoginDto {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct SessionDto {
    pub token: String,
    pub user_id: i64,
    pub username: String,
    pub role: String,
    pub full_name: String,
}

#[tauri::command]
fn auth_login(
    state: State<'_, AppState>,
    payload: LoginDto,
) -> Result<SessionDto, CommandError> {
    let db = state.db.lock().map_err(|_| CommandError {
        code: "INTERNAL".into(),
        message: "Failed to acquire database lock".into(),
    })?;

    let mut sessions = state.sessions.lock().map_err(|_| CommandError {
        code: "INTERNAL".into(),
        message: "Failed to acquire session lock".into(),
    })?;

    state.services.auth_service.login(
        &db,
        &mut sessions,
        &payload.username,
        &payload.password,
    )
}
```

### Login Attempt Audit (Owner-Only View)

```rust
// src-tauri/src/commands/audit_commands.rs
#[derive(Serialize)]
pub struct LoginAttemptDto {
    pub id: i64,
    pub username: String,
    pub success: bool,
    pub failure_reason: Option<String>,
    pub created_at: String,
}

#[tauri::command]
fn get_login_attempts(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<LoginAttemptDto>, CommandError> {
    let _owner = require_owner(&state, &session_token)?;
    let db = state.db.lock().map_err(|_| ...)?;

    let mut stmt = db.prepare(
        "SELECT id, username, success, failure_reason, created_at FROM login_attempts ORDER BY created_at DESC LIMIT 100"
    )?;

    let attempts = stmt.query_map([], |row| {
        Ok(LoginAttemptDto {
            id: row.get(0)?,
            username: row.get(1)?,
            success: row.get(2)?,
            failure_reason: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(attempts)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 allowlist (tauri.conf.json) | Tauri v2 capabilities (capabilities/*.json) | Tauri 2.0 stable (2024) | More granular, per-window permission scoping; must use `core:default` and explicit plugin permissions |
| bcrypt Rust crate | bcrypt 0.19.1 with DEFAULT_COST | Continuous | Stable API; `hash()` and `verify()` pattern unchanged since 0.15 |
| rusqlite raw queries | rusqlite with `prepare_cached` for hot paths | Built-in | Prepared statement caching improves repeated query performance |
| Prisma/ORM in frontend | Rust-backed commands with rusqlite | Architecture decision | Keeps business logic and financial data on the Rust side of the IPC boundary |

**Deprecated/outdated:**
- Tauri v1 API: Tauri 2.0 has breaking changes in path resolution, permissions model, plugin architecture. Use v2 API throughout.
- `tauri::api::path`: Replaced by `app.path()` methods in Tauri 2.0 setup closure.
- SQL-based session in localStorage (common anti-pattern): Replaced by Rust-managed in-memory session per D-04.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Single `Mutex<Connection>` (not a pool) is sufficient for single-user desktop app workload | Standard Stack | If concurrent Tauri commands create lock contention, switch to `deadpool-sqlite` or use a dedicated read connection |
| A2 | UUID v4 tokens are sufficiently unique for session tokens | Architecture Patterns | Risk of collision is astronomically low (2^122 unique values) — acceptable for v1 |
| A3 | `chrono` crate is available and compatible with the Tauri 2.0 Rust edition | Standard Stack | chrono is widely compatible; if edition 2024 issues arise, use `time` crate instead |

## Open Questions

1. **Session TTL / expiration policy**
   - What we know: D-04 says "Session exists until user logs out or app closes."
   - What's unclear: What happens if the app crashes? Should sessions have a TTL for crash recovery? Research suggests loading existing sessions from SQLite on startup is acceptable for the single-user desktop context.
   - Recommendation: Load sessions from SQLite on startup (crash recovery). No TTL needed for v1. Session cleared on explicit logout.

2. **App data directory location for Windows**
   - What we know: `app.path().app_data_dir()` returns the correct OS-specific directory.
   - What's unclear: Whether to use `app_data_dir()`, `local_data_dir()`, or a custom subdirectory.
   - Recommendation: Use `app.path().app_data_dir()` which resolves to `%APPDATA%/com.pharmacare.app/` on Windows.

3. **shadcn sidebar role-based variant approach**
   - What we know: shadcn sidebar component is available and supports collapsible sections.
   - What's unclear: Should we render two separate sidebars (one per role) or a single component with conditional menu items?
   - Recommendation: Single sidebar component with role-conditional `navItems` array. Owner gets all items; Pharmacist gets restricted set. This is in the agent's discretion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust (rustc) | Tauri backend | ✓ | 1.94.1 | — |
| Cargo | Rust build system | ✓ | 1.94.1 | — |
| Node.js | Frontend build, npm | ✓ | 24.13.1 | — |
| npm | Package management | ✓ | 11.8.0 | — |
| SQLite (bundled via rusqlite) | Database | ✓ (bundled) | rusqlite bundles SQLite | System SQLite if feature `bundled` omitted |
| pnpm | Optional package manager | Not checked | — | npm is fine |

**Missing dependencies with no fallback:** None — all core tooling is available.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | bcrypt hashing (cost 12), minimum 6-char password, login audit log |
| V3 Session Management | yes | In-memory session state (not localStorage), server-side validation on every command |
| V4 Access Control | yes | Role-guarded Tauri commands; owner-only commands reject pharmacist tokens |
| V5 Input Validation | yes | Zod or runtime check in Rust; prevent SQL injection via prepared statements (rusqlite) |
| V6 Cryptography | no | bcrypt is password hashing, not general crypto; no encryption requirements in v1 |

### Known Threat Patterns for Tauri 2.0 + SQLite Desktop

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized command invocation (e.g., pharmacist calling `create_user`) | Elevation of Privilege | `require_owner()` guard on every privileged command; session token passed with every invocation |
| SQL injection via IPC payload | Tampering | rusqlite prepared statements (`?1` placeholders) — never string-concatenating SQL |
| Session token reuse after logout | Spoofing | Tokens removed from HashMap on logout; `check_session` validates token exists in HashMap |
| Offline brute-force login attempt | Tampering | Login attempts logged; bcrypt cost 12 slows brute force; no rate limit for v1 (consider for v2) |
| Local file access to SQLite DB | Information Disclosure | OS file permissions on app data directory; no encryption-at-rest for v1 (consider for v2 if PHI sensitivity increases) |

## Sources

### Primary (HIGH confidence)
- Tauri 2.0 docs — Commands, state management, permissions, path API [CITED: v2.tauri.app/develop/calling-rust, v2.tauri.app/develop/state-management, v2.tauri.app/security/permissions/]
- rusqlite docs — Connection, prepared statements, transactions [CITED: docs.rs/rusqlite/0.40.0]
- rusqlite_migration docs — Migration patterns, validation, file loading [CITED: docs.rs/rusqlite_migration/2.6.0]
- bcrypt crate — Hash and verify patterns [VERIFIED: crates.io - bcrypt 0.19.1]
- serde docs — Derive macros for Serialize/Deserialize [CITED: serde.rs]
- npm registry — Package version verification: React 19.2.7, TypeScript 6.0.3, @tauri-apps packages [VERIFIED: npm registry]
- Crates.io — Version verification: rusqlite 0.40.0, bcrypt 0.19.1, serde 1.0.228 [VERIFIED: crates.io]

### Secondary (MEDIUM confidence)
- shadcn/ui sidebar component — Available at `@shadcn/sidebar`, depends on radix-ui + class-variance-authority + lucide-react [VERIFIED: npm registry & shadcn registry]
- Tauri v2 permissions model — replaced v1 allowlist with capabilities JSON files [CITED: v2.tauri.app/start/migrate/from-tauri-1]

### Tertiary (LOW confidence)
- chrono crate v0.4.x compatibility with Rust 1.94.1 — [ASSUMED] based on ecosystem maturity

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core crate versions verified against crates.io and npm registry
- Architecture: HIGH - Tauri state management, command patterns, and session patterns documented by official Tauri docs
- Pitfalls: HIGH - Derived from architecture research, SQLite-specific issues, and bcrypt/security best practices

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (30 days for fast-moving ecosystem — Tauri and React)
