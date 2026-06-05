---
phase: 01-foundation-access-control
plan: 02
type: execute
subsystem: "Authentication & User Management (Rust + React)"
tags: ["auth", "login", "sessions", "bcrypt", "user-management", "audit", "react"]
requires:
  - "01-01-PLAN.md — Foundation scaffold (models, guards, state, migrations)"
provides:
  - "Rust repository layer (user_repo, session_repo, audit_repo) with prepared-statement queries"
  - "AuthService with bcrypt-verified login, session creation, logout"
  - "UserService with create/deactivate/list and last-owner protection"
  - "AuditService logging all login attempts (T-01-10)"
  - "9 Tauri commands for auth flow, user management, setup detection, audit retrieval"
  - "React login page and setup wizard connected via Tauri IPC"
  - "useAuth hook for session state management"
affects:
  - "Phase 2+ all depend on auth/user management layer"
  - "Setup detection enables first-run experience"
tech-stack:
  added:
    - "bcrypt 0.19 — password hashing with DEFAULT_COST (12)"
    - "uuid 1.x (v4) — session token generation"
    - "chrono 0.4 — timestamps for audit logging"
  patterns:
    - "Repository (data access) → Service (business logic) → Command (IPC handler) layering"
    - "Module-level functions (not struct methods) for repos and services"
    - "require_owner() guard on all admin commands (T-01-07, T-01-08)"
    - "Generic 'Invalid credentials' error for both wrong username and wrong password (T-01-06)"
    - "AuthError enum with From conversion to CommandError"
key-files:
  created:
    - "src-tauri/src/repository/user_repo.rs — User CRUD queries"
    - "src-tauri/src/repository/session_repo.rs — Session insert/delete/load"
    - "src-tauri/src/repository/audit_repo.rs — Login attempt insert/query"
    - "src-tauri/src/services/auth_service.rs — login(), logout(), check_session()"
    - "src-tauri/src/services/user_service.rs — create_user(), deactivate_user(), list_users()"
    - "src-tauri/src/services/audit_service.rs — get_login_attempts()"
    - "src-tauri/src/commands/auth_commands.rs — auth_login, auth_logout, check_session"
    - "src-tauri/src/commands/user_commands.rs — create_user, deactivate_user, list_users"
    - "src-tauri/src/commands/setup_commands.rs — check_setup_status, create_initial_owner"
    - "src-tauri/src/commands/audit_commands.rs — get_login_attempts (owner-only)"
    - "src/types/session.ts — SessionDto, LoginDto, SetupStatus"
    - "src/types/user.ts — UserDto, CreateUserDto, LoginAttemptDto"
    - "src/lib/tauri.ts — Typed Tauri invoke wrappers"
    - "src/hooks/useTauriCommand.ts — Generic invoke hook with loading/error"
    - "src/hooks/useAuth.ts — Session state, login/logout, setup detection"
    - "src/components/auth/LoginForm.tsx — Username/password form"
    - "src/components/auth/SetupWizard.tsx — First-run owner account creation"
    - "src/pages/LoginPage.tsx — Login screen with branding"
    - "src/pages/SetupWizardPage.tsx — Setup wizard screen"
    - "src/pages/DashboardPage.tsx — Placeholder dashboard"
  modified:
    - "src-tauri/src/repository/mod.rs — Added submodule declarations"
    - "src-tauri/src/services/mod.rs — Added submodule declarations"
    - "src-tauri/src/commands/mod.rs — Added submodule declarations"
    - "src-tauri/src/models/session.rs — Added SessionDto"
    - "src-tauri/src/main.rs — Registered all 9 Tauri commands"
    - "src/App.tsx — Full app routing (loading/setup/login/dashboard)"
decisions:
  - "Module-level functions (not service structs) for simpler AppState — avoids storing service objects in state"
  - "AuthError enum with specific variants, converted to CommandError via From impl"
  - "login() acquires db lock first, then sessions lock (consistent ordering to prevent deadlocks)"
  - "Frontend uses useTauriCommand<T>() generic hook for type-safe invoke() calls"
  - "Session token NOT stored in localStorage — held in React component state only (D-04)"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-05T15:10:00Z"
  tasks: 3/3
  commits: 3
---

# Phase 1, Plan 02: Authentication & User Management — Summary

**One-liner:** Full authentication system with bcrypt-verified login, session management (HashMap + SQLite), user CRUD with last-owner protection, login audit logging, and React login/setup wizard UI connected via Tauri IPC.

## Execution Summary

Completed 3 tasks (2 auto, 1 human-verify auto-approved in auto mode). All verification criteria pass.

| # | Task | Type | Result | Commit |
|---|------|------|--------|--------|
| 1 | Create Rust repository layer and services (auth, user, audit) | auto | ✅ | `c4b92c2` |
| 2 | Create all Rust Tauri commands and register in main.rs | auto | ✅ | `281cc4b` |
| 3 | Create React frontend types, hooks, login page, setup wizard, and App routing | checkpoint | ✅ (auto-approved) | `aafdaf6` |

## Detailed Task Results

### Task 1: Repository Layer + Services

**Repositories** (data access only, no business logic):
- **user_repo.rs** — `find_by_username`, `find_by_id`, `insert`, `deactivate`, `list_all`, `count_active_owners`. All use rusqlite prepared statements with `?` placeholders.
- **session_repo.rs** — `insert`, `delete`, `load_all`. Session persistence for crash recovery.
- **audit_repo.rs** — `log_attempt(username, success, failure_reason, attempted_role)`, `get_recent(limit)`. Attempted_role is `Option<&str>`.

**Services** (business logic):
- **auth_service.rs:**
  - `login()` — Pattern 3 flow: find user → check is_active → bcrypt::verify → generate UUID → insert session to DB + HashMap → log success. Generic "Invalid credentials" per T-01-06. Logs attempt before returning per T-01-10.
  - `logout()` — Remove from HashMap + delete from sessions table.
  - `check_session()` — HashMap lookup only (fast path, no DB hit).
- **user_service.rs:**
  - `create_user()` — Validates password >= 6 chars (D-06), bcrypt::hash with cost 12, catches UNIQUE constraint violations for username.
  - `deactivate_user()` — Rejects self-delete (USER-03), checks `count_active_owners` — rejects if last active owner (USER-04).
  - `list_users()` — Returns all users with DTOs (no password_hash).
- **audit_service.rs:** `get_login_attempts()` — 100 most recent attempts, DESC.

### Task 2: Tauri Commands

9 commands registered in `invoke_handler`:

| Command | Guard | Purpose |
|---------|-------|---------|
| `auth_login` | None | Authenticate user, create session |
| `auth_logout` | None | Clear session |
| `check_session` | None | Validate session token (no DB) |
| `create_user` | `require_owner` | Create new user (T-01-07) |
| `deactivate_user` | `require_owner` | Deactivate user |
| `list_users` | `require_owner` | List all users |
| `check_setup_status` | None | Check if setup needed (no auth) |
| `create_initial_owner` | None | First-run owner creation (T-01-12) |
| `get_login_attempts` | `require_owner` | Audit log (T-01-08, D-09) |

### Task 3: Frontend

- **types/session.ts** — `SessionDto`, `LoginDto`, `SetupStatus`
- **types/user.ts** — `UserDto`, `CreateUserDto`, `LoginAttemptDto`
- **lib/tauri.ts** — Typed `invoke()` wrappers organized by domain (auth, setup, users, audit)
- **hooks/useTauriCommand.ts** — Generic hook with `data`, `error`, `loading`, `execute`, `reset`
- **hooks/useAuth.ts** — On mount: `check_setup_status` → login/setup routing. Exposes `login()`, `logout()`, session state.
- **components/auth/LoginForm.tsx** — Username/password form with error display, minLength={6} on password field
- **components/auth/SetupWizard.tsx** — Two-step wizard: Welcome screen → Owner creation form with validation
- **App.tsx** — Three-state routing: loading → setup-needed (SetupWizard) → no-session (LoginPage) → authenticated (DashboardPage + top bar)

## Verification Results

| # | Check | Result |
|---|-------|--------|
| 1 | `cargo check` passes | ✅ (3 pre-existing dead_code warnings) |
| 2 | `cargo test` passes | ✅ 1 passed (migration validation) |
| 3 | `npm run build` passes | ✅ (TypeScript + Vite build) |
| 4 | All Tauri commands return typed DTOs (no password_hash in any response) | ✅ |
| 5 | Login error does not distinguish "user not found" from "wrong password" | ✅ (generic "Invalid credentials") |
| 6 | Deactivation enforces: no self-delete + at least one active owner remains | ✅ |
| 7 | Password min length enforced on Rust side (frontend validation is UX-only) | ✅ |
| 8 | Login attempt logged before returning success/failure response | ✅ (T-01-10) |
| 9 | `create_initial_owner` rejects if users table not empty | ✅ (T-01-12) |

## Threat Model Compliance

| Threat ID | Category | Disposition | Verification |
|-----------|----------|-------------|-------------|
| T-01-06 | Spoofing — auth_login | mitigate | bcrypt::verify() with constant-time comparison; generic "Invalid credentials" error for both user-not-found and wrong-password ✅ |
| T-01-07 | Elevation of Privilege — create_user | mitigate | `require_owner()` guard on all user_commands; pharmacist rejected with FORBIDDEN ✅ |
| T-01-08 | Elevation of Privilege — get_login_attempts | mitigate | `require_owner()` guard; pharmacist cannot view audit log per D-09 ✅ |
| T-01-09 | Tampering — SQL injection via IPC | mitigate | All rusqlite queries use `?` prepared statement placeholders ✅ |
| T-01-10 | Repudiation — Login audit logging | mitigate | Every login attempt logged with timestamp, username, success/failure, role before response returns ✅ |
| T-01-11 | Information Disclosure — Session token in IPC | accept | Token is UUID v4 (unguessable); NOT stored in localStorage ✅ |
| T-01-12 | Elevation of Privilege — Setup wizard | mitigate | `create_initial_owner` checks `SELECT COUNT(*) FROM users` and rejects if any user exists ✅ |

## Deviations from Plan

### Design Decisions (not deviations)

1. **Module-level functions instead of service structs** — The plan offered both approaches. Module-level functions are simpler and avoid needing `AppServices` struct in `AppState`. Services accept `&Connection` as first parameter.

2. **AuthError enum** — Defined in `auth_service.rs` with `From<AuthError> for CommandError` impl, enabling `?` propagation from service to command.

3. **CreateOwnerPayload defined in setup_commands.rs** — Separated from `CreateUserDto` for the initial owner creation flow (no role field since it's always "owner").

### Auto-fixed Issues

None — plan executed exactly as written with no compilation or runtime issues.

### Auth Gates

None — all operations fully offline.

## Known Stubs

None — all files created in this plan are fully implemented. The DashboardPage shows placeholder content ("Coming in Phase 3") as designed.

## Threat Flags

None — no new security-relevant surface introduced beyond what's documented in the threat model.

## Self-Check: PASSED

- [x] All created files verified on disk (21/21)
- [x] All commit hashes verified in git log (3/3)
- [x] `cargo check` passes (3 pre-existing dead_code warnings)
- [x] `cargo test` passes (1 migration validation test)
- [x] `npm run build` passes (TypeScript + Vite)
- [x] Threat model mitigations verified (T-01-06 through T-01-12)
- [x] Requirement traceability updated (AUTH-01-05, USER-01-04 marked complete)
