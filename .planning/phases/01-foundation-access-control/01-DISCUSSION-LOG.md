# Phase 1: Foundation & Access Control - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 1-Foundation & Access Control
**Areas discussed:** Database strategy, Session handling, First-user setup, Password policy, Navigation layout, Login audit scope
**Mode:** auto (auto-selected all areas, recommended defaults chosen)

---

## Database Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Prisma ORM in frontend | As specified in PRD, Node.js sidecar for Prisma | |
| rusqlite/sqlx in Rust commands | Database access through Rust Tauri commands, no Prisma in frontend | ✓ |
| Hybrid Prisma design + Rust runtime | Use Prisma schema as design input, implement in Rust | |

**User's choice:** rusqlite/sqlx in Rust Tauri commands (auto — recommended by architecture research)
**Notes:** The architecture research strongly recommends against Prisma-in-frontend for desktop apps. PRD mention of Prisma is treated as design input only.

## Session Handling

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory + SQLite session table | Secure, survives restart, no plaintext tokens | ✓ |
| localStorage token | Simple but less secure, vulnerable to XSS | |
| Tauri secure storage plugin | Most secure but adds dependency complexity | |

**User's choice:** In-memory session with SQLite session table (auto — recommended)
**Notes:** React checks session on app start via Tauri command.

## First-User Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Setup wizard on first launch | Guided owner account creation, no default credentials | ✓ |
| Seed script with default admin | Hardcoded default credentials that must change | |
| Manual SQLite seeding by developer | Not user-friendly | |

**User's choice:** Setup wizard on first launch (auto — recommended)
**Notes:** Avoids security risk of hardcoded defaults.

## Password Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum 6 characters | Simple, sufficient for v1 | ✓ |
| Minimum 8 characters + complexity | Stronger, better security | |
| No minimum | Least secure | |

**User's choice:** Minimum 6 characters (auto — recommended)
**Notes:** Can be strengthened in later versions.

## Navigation Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar navigation | Consistent desktop app pattern, good for role-based views | ✓ |
| Top bar navigation | Simpler but less scalable for many screens | |

**User's choice:** Sidebar navigation with shadcn/ui (auto — recommended)
**Notes:** Owner sees full navigation; Pharmacist sees restricted view.

## Login Audit Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Timestamp, username, success/failure, role | Covers audit requirements | ✓ |
| Full details including screen captures | Over-engineered for v1 | |
| Minimal (success/failure only) | Insufficient for audit trail | |

**User's choice:** Timestamp, username, success/failure, role (auto — recommended)
**Notes:** Stored in login_attempts table, Owner-only access.

---

## the agent's Discretion

- Rust bcrypt crate selection
- Session table schema design
- Sidebar component structure
- Error message wording
- Login screen form layout

## Deferred Ideas

None — discussion stayed within phase scope.
