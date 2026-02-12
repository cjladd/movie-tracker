# Changes Recommendation and Execution Log

## Scope Requested
- Implement plan items `3`, `5`, `7`, `8`, and `9`.
- Keep behavior stable unless a security/reliability correction requires tighter handling.

## Execution Checklist
- [x] `3` Password reset productionization:
  - [x] hash reset tokens at rest
  - [x] send reset email through a production-ready provider integration
  - [x] add reset-password UX page
- [x] `5` CI migration verification:
  - [x] validate schema + migration scripts in CI against ephemeral MySQL
  - [x] enforce idempotent migration run
- [x] `7` Frontend robustness standards:
  - [x] unify API error messaging + toast behavior
  - [x] standardize loading/empty/error rendering helpers
- [x] `8` Accessibility pass:
  - [x] keyboard/focus parity for interactive cards and controls
  - [x] stronger semantic/ARIA coverage for dynamic UI
  - [x] contrast/focus visibility improvements
- [x] `9` Performance pass:
  - [x] improve image loading attributes/strategy
  - [x] introduce route-level script splitting for homepage-only logic
  - [x] tighten static caching policy

## Implementation Log
- 2026-02-12: Initialized execution plan and checklist.
- 2026-02-12: Completed item `3`:
  - added hashed reset-token storage (`token_hash`) with legacy fallback handling,
  - added Resend-backed password reset email utility with safe dev fallback,
  - added `Reset_Password.html` flow and connected login-page reset request UX.
- 2026-02-12: Completed item `5`:
  - added `backend/scripts/verify-migrations.js` to execute SQL files with delimiter-aware parsing,
  - wired CI `db-migrations` job with ephemeral MySQL service,
  - run `migrate.sql` twice in CI to enforce idempotency.
- 2026-02-12: Completed item `7`:
  - added shared frontend helpers in `app.js` (`normalizeCollection`, `getErrorMessage`, `setStatusMessage`, `renderStandardState`),
  - migrated key pages (`Friends`, `Heads Up`, `Settings`, `Binge Bank`) to consistent status/error behavior.
- 2026-02-12: Completed item `8`:
  - added skip-link injection and focus-visible styling,
  - added keyboard semantics to homepage movie cards and stronger `aria-live`/dialog attributes on dynamic UI regions.
- 2026-02-12: Completed item `9`:
  - split homepage runtime from `app.js` into `js/homepage.js` and loaded it only on `website.html`,
  - improved image loading attributes (`decoding`, selective eager priority),
  - tightened static and HTML cache headers in Express,
  - added frontend build/minification pipeline script (`backend/scripts/build-frontend-assets.js`) and CI execution.
