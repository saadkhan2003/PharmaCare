# Phase 1: Foundation & Access Control - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the foundational desktop application: a working Tauri 2.0 + React + TypeScript shell with SQLite database persistence, bcrypt-based user authentication (login/logout/session), role-based access control (Owner/Pharmacist), user management CRUD (add, view, deactivate), login audit logging, and safeguards (last-owner protection, no hard deletes).

This phase does NOT include: POS, inventory management, purchasing, suppliers, batches, reports, backup, settings screens, or any other domain feature. Those are covered by Phases 2-5.

</domain>

<decisions>
## Implementation Decisions

### Database & Backend Architecture
- **D-01**: Use rusqlite/sqlx in Rust Tauri commands for database access — NOT Prisma in the frontend. The PRD mentions Prisma, but the architecture research strongly recommends against letting React write SQL directly. Runtime database access happens exclusively through Rust Tauri commands. SQLite schema design may use Prisma schema as design input, but the running application uses rusqlite.
- **D-02**: Enable WAL journal mode (`PRAGMA journal_mode=WAL`), foreign keys (`PRAGMA foreign_keys=ON`), and busy timeout (`PRAGMA busy_timeout=5000`) on every database connection.
- **D-03**: Include the `stock_movements` ledger table in the initial migration — even though Phase 2 implements the full stock intake. This prevents retrofit pain later (key research finding).

### Session & Authentication
- **D-04**: Session stored in-memory with a SQLite `sessions` table. React checks session validity on app start by calling a Tauri command. No session tokens stored in localStorage. Session exists until user logs out or app closes.
- **D-05**: Setup wizard on first launch guides the creation of the initial Owner account. No hardcoded default credentials.
- **D-06**: Password minimum length: 6 characters. No additional complexity requirements for v1.

### UI & Navigation
- **D-07**: Sidebar navigation using shadcn/ui sidebar component. Owner sees full navigation; Pharmacist sees a restricted set (POS, basic dashboard, inventory view-only, process returns).
- **D-08**: UI language is English only for v1.

### Login Audit
- **D-09**: Each login attempt logs: timestamp, username, success/failure, attempted role. Stored in a `login_attempts` SQLite table. Accessible only by Owner role.

### User Management Rules
- **D-10**: Users are never hard-deleted — only deactivated (is_active = false). Deactivated users cannot log in but their historical sales records are preserved.
- **D-11**: System must always have at least one active Owner account. Owner cannot delete their own account.
- **D-12**: Roles are fixed: `owner` and `pharmacist`. No custom roles for v1.

### the agent's Discretion
- Password hashing implementation (bcrypt via a Rust crate — agent can choose the specific crate)
- Exact session table schema and session token format
- Specific component structure for the sidebar layout
- Error message wording for login failures
- Login screen design details (form layout, branding placement)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — Full requirement definitions (AUTH-01 through AUTH-05, USER-01 through USER-04)
- `.planning/ROADMAP.md` §"Phase 1: Foundation & Access Control" — Success criteria, requirement mappings
- `.planning/PROJECT.md` — Core value, constraints, context

### Research
- `.planning/research/SUMMARY.md` — Architecture approach (Rust command pattern, stock ledger in Phase 1), pitfalls (Prisma-in-frontend concerns, WAL backup, RBAC at command layer)
- `.planning/research/ARCHITECTURE.md` — Component boundaries, intent command pattern, role-masked DTOs
- `.planning/research/PITFALLS.md` — Pitfalls 1 (ledger before POS), 6 (auth before features), 10 (offline baseline), 13 (migration discipline)

### Database Schema
- `PRD.md` §6 (Database Schema) — Reference schema for users, settings, sessions tables
- `PRD.md` §8 (Non-Functional Requirements) — Performance targets, security, data integrity rules
- `PRD.md` §5.8 (User Management) — Business rules for user accounts

### Tech References
- `PRD.md` §3 (Tech Stack) — Declared stack: Tauri 2.0, React, TypeScript, Tailwind CSS, shadcn/ui, SQLite
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
No existing codebase — this is a greenfield project. All components, hooks, and utilities will be created fresh.

### Established Patterns
No established patterns yet — this phase establishes the foundational patterns (component structure, data flow, IPC pattern, session management) that all subsequent phases will follow.

### Integration Points
- Tauri IPC boundary between React UI and Rust backend — established in this phase
- SQLite connection managed from Rust — all future phases connect through this
- Navigation structure (sidebar) — Phase 2+ add navigation items

</code_context>

<specifics>
## Specific Ideas

No specific references from the user — open to standard approaches for Tauri 2.0 desktop application patterns.

Key architectural guidance from research:
- **Intent command pattern**: React sends intent commands (`login`, `create_user`, `deactivate_user`) via Tauri IPC; Rust validates RBAC and business rules; single SQLite transaction commits the mutation + audit log
- **Role-masked DTOs**: Owner-only data (purchase prices, margins) never reaches frontend — masked at Rust command boundary
- **Offline baseline**: All Phase 1 features must work fully offline. No internet dependency for login or user management.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Foundation & Access Control*
*Context gathered: 2026-06-05*
