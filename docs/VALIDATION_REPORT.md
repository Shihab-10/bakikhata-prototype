# Phase 01 validation report

Validated in the build environment on 24 Nov 2026:

- Python compile check: passed.
- FastAPI/SQLAlchemy API tests: 6 passed.
  - Registration and authenticated `/auth/me`.
  - Customer creation with opening balance.
  - Due and payment balance calculation.
  - Duplicate transaction retry does not double count.
  - Offline sync push duplicate handling.
  - Cross-shop customer read is rejected.
- Google authentication tests cover first-time Google shop onboarding, returning Google login, linking an existing phone account, and disabled/unconfigured Google login. Google token verification is mocked in automated tests; live Google OAuth still requires the user's own Web Client ID.
- JavaScript syntax check: 31/31 passed with `node --check`.
- PWA manifest JSON and both icon assets: passed.
- Local HTML script/style/image references: passed.
- FastAPI TestClient smoke check: `/health`, `/`, `/docs`, demo login, shop profile, customer list and dashboard summary responded successfully.

Not verified in this build environment:

- Installation on the user's Windows PC.
- Real Android Chrome browser rendering and PWA installation.
- Actual airplane-mode/offline behaviour on the user's phone.
- Live Google OAuth popup and token verification using a real Google Cloud Web Client ID.
- PostgreSQL installation and PostgreSQL-specific runtime/migration tests.
- Native Android/iOS STT/TTS, APK packaging, payment gateway or SMS gateway.

Passing source-level checks is not a substitute for running the package on the user's PC and testing it on a real phone.


## Firebase Authentication update (2026-11-24)

- Backend test suite: 11 passed.
- Python compile check: passed.
- JavaScript syntax check: 32 files passed.
- Firebase client: JavaScript SDK 13.4.0, Google provider, persistent browser auth, popup flow with redirect fallback.
- Backend: Firebase ID token validation with PyJWT Secure Token JWK, RS256, issuer, audience, expiration, issued-at, auth-time, Google provider claim, and verified email.
- New additive `firebase_identities` table; existing Google identity table and mobile/demo authentication preserved.
- Firebase Console project creation/provider enablement and real Google account login require user-owned Firebase project configuration and have not yet been live-tested.
