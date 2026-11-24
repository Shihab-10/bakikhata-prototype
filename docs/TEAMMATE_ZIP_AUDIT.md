# Original teammate ZIP — integration notes

The teammate's archive was a 72-entry static web/PWA prototype built with HTML, CSS and vanilla JavaScript. It contained 17 HTML pages, 29 JavaScript files and IndexedDB-based local demo storage. The API bridge had `USE_REMOTE_API: false`; the API contract was documentation only. There was no FastAPI app, SQL schema, PostgreSQL configuration, React Native project or Android Gradle project in that archive.

## Reused
- Original responsive UI pages and CSS tokens.
- Navigation shell, customer list, ledger, quick entry and voice draft presentation.
- Language/theme helpers and PWA manifest.

## Reworked in Phase 01
- Replaced fake OTP login with real password/JWT authentication.
- Added FastAPI, SQLAlchemy models and tenant-scoped API routes.
- Added local IndexedDB outbox and retry-safe push/pull sync.
- Connected customer, ledger, transaction and dashboard services to API.
- Corrected transaction sign convention: Due adds to receivable; payment subtracts from receivable.
- Added opening balance as a ledger event and corrected demo seed balances.
- Changed passbook badge to "private preview" because a public verification/share API is not implemented.
- Excluded inventory/POS from the teacher's first MVP scope; legacy screens remain visibly separate local demo tools.

## Still pending
Native mobile STT/TTS bridge, dialect evaluation, full PostgreSQL deployment/RLS, restore testing, subscription enforcement, real SMS/payment integrations, native APK packaging and device QA.
