# BakiKhata Local Authentication Repair — 25 November 2026

## Scope
This patch keeps the selected Local Account Mode. It does not enable Neon, PostgreSQL, Firebase, Google sign-in, cloud sync, or any Vercel deployment. It does not alter the existing Vercel project link or Git history.

## Changes
- Increased the browser auth database schema version from 1 to 2 and made the `accounts` object store creation idempotent. This allows older version-1 auth databases to upgrade safely.
- Added IndexedDB connection cleanup, version-change handling, blocked-database messages, and transaction-completion handling.
- Validated the local session token and session shape before treating a user as logged in.
- Writes the session before the local token and clears partial session data if browser storage rejects a write.
- Normalizes Bangladesh phone numbers entered with English, Bangla, Arabic-Indic, or Persian digits; accepts 01XXXXXXXXX and +8801XXXXXXXXX forms for valid 013–019 prefixes.
- Retained PBKDF2-HMAC-SHA256 password hashing at 310,000 iterations.
- Added recovery for a damaged built-in Demo Account password hash without replacing the Demo shop identity or its ledger.
- Added clearer in-page login/signup feedback and password show/hide controls.
- Changed successful navigation to `location.replace()` to avoid returning to the submitted form.
- Bumped the service-worker cache name so old app-shell caches are retired.
- Synchronized `public/` from `frontend/` so both trees contain identical assets.

## Validation performed in the repair environment
- JavaScript syntax: 64/64 files passed `node --check`.
- Python syntax: 12/12 files passed `py_compile`.
- Backend tests: 9 passed.
- Local-auth flow simulation: passed signup, Bangla phone normalization, +880 phone login, logout, wrong-password rejection, duplicate-signup rejection, demo login, demo credential repair, and version-1 auth database upgrade.
- Per-shop IndexedDB isolation simulation: passed.
- Frontend/public asset mirror: 67/67 files matched.
- Local HTML asset references: 0 missing.

## Important limitation
Local Account Mode stores account records and ledger data in the browser on the current device/origin. It is not cloud authentication, does not synchronize accounts across devices or browsers, and browser/site-data deletion can erase local accounts and ledgers. Passwords are PBKDF2-hashed in the browser, but this mode is a prototype/local-use path, not a substitute for server-side production authentication and backups.

## Deployment
No deployment was performed. Apply the patch locally, test Signup/Login and the Demo Account, then explicitly choose whether to commit/push and deploy.
