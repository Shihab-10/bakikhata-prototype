# Legacy Google OAuth setup

The current BakiKhata login no longer uses the direct Google Identity Services Web Client ID flow.
Use [Firebase Google Authentication setup](./FIREBASE_AUTH_SETUP_BN.md) instead.

`GOOGLE_CLIENT_ID` and the legacy `/auth/google*` endpoints are retained temporarily for rollback/compatibility only. The active frontend login and account-link screens use Firebase Authentication.
