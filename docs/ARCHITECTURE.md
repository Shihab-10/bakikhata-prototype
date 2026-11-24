# Architecture — Phase 01

```text
Mobile browser / installable PWA
        │
        ├── HTML/CSS/JavaScript UI (teammate design retained)
        ├── IndexedDB cache + outbox
        │
        └── HTTPS / same-origin REST API
                    │
                 FastAPI
                    │
          Phone/password authentication + Google Identity Services
          Google ID-token verification + GoogleIdentity link table
          JWT session + membership
          Tenant-scoped service functions
          Ledger calculation + idempotency
          Audit log + sync push/pull
                    │
             SQLAlchemy ORM
                    │
       SQLite (local development default)
       PostgreSQL (configured option)
```

## Tenant boundary

The client never chooses the tenant ID for a ledger request. The API obtains the active shop from the signed access token and verifies an active user membership for every protected request. Customer and ledger queries include the server-derived `shop_id` predicate.

## Ledger model

Amounts are stored as integer paisa (`amount_paisa`) to avoid floating-point money arithmetic. The UI currently enters whole BDT and the API converts BDT to paisa. Balance is derived from ledger events, not trusted from the browser.

- `DUE`: increases customer receivable.
- `PAYMENT`: decreases customer receivable.
- Corrections are recorded as compensating entries.

## Sync

The browser writes local changes and an outbox operation in a single IndexedDB transaction. The outbox is pushed in creation order. Each operation has an operation ID; the server records it per shop and returns `duplicate` for retries. Once the outbox is empty, the client pulls a shop-scoped snapshot.


## Google sign-in

The browser uses Google's official Identity Services button and receives an ID token. FastAPI verifies the token signature, issuer, expiry and audience against `GOOGLE_CLIENT_ID`; it also requires a verified email. The app then maps the stable Google subject (`sub`) to a `GoogleIdentity` record and issues its own Baki Khata JWT. A first-time Google user completes merchant onboarding with a Bangladesh phone number and shop details. Existing phone/password users can link Google from Settings after signing in. The Google token is never used as the app's long-lived session token, and Google passwords are never stored.


## Authentication provider

The browser uses Firebase Authentication for Google account sign-in. Firebase ID tokens are verified by FastAPI using Google's Secure Token JWK endpoint and the configured Firebase project ID. BakiKhata issues its own JWT for shop-scoped API access. Firebase stores identity only; financial ledger records remain in the BakiKhata database. Demo and mobile/password authentication remain independent.
