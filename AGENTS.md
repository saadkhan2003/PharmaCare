# PharmaCare — Project Guide

## Project Context

See: `.planning/PROJECT.md` for full project context.
See: `.planning/REQUIREMENTS.md` for v1 requirements and traceability.
See: `.planning/ROADMAP.md` for phased execution plan.

**Core Value:** The pharmacist can reliably process medicine sales while stock, profit, expiry, and backup data stay accurate without requiring internet access.

**Tech Stack:** Tauri 2.0 (Rust) + React + TypeScript + Tailwind CSS + shadcn/ui + SQLite + Google Drive API + Recharts + @react-pdf/renderer

## Workflow Commands

- `/gsd-discuss-phase <N>` — Gather context and clarify approach before planning
- `/gsd-plan-phase <N>` — Create execution plan for a phase
- `/gsd-execute-phase <N>` — Execute plans in a phase
- `/gsd-verify-work` — Validate built features
- `/gsd-progress` — Check status and advance workflow

## Project Rules

- All planning artifacts live in `.planning/` — commit along with code changes.
- Every requirement must map to exactly one phase (see traceability in REQUIREMENTS.md).
- Stock mutations must go through a single stock service — never direct SQL from frontend.
- Phase plans must include success criteria validation steps.
