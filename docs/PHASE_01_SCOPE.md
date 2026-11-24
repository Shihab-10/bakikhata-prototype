# Phase 01 — Delivered Scope and Remaining Work

## Delivered in source

- FastAPI app and API documentation.
- Password-based merchant signup/login with signed JWT tokens.
- Shop, user and membership records.
- Tenant-scoped customer CRUD and ledger reads.
- Due and payment posting with a server-computed balance.
- Opening balance as a ledger event.
- Unique operation ID for transaction retry idempotency.
- Basic audit trail.
- IndexedDB local cache and outbox; sequential sync push; pull snapshot after outbox clears.
- PWA shell retained from teammate's design.
- Demo account seed script.

## Not yet production-complete

- Native Android/iOS speech bridge; current browser SpeechRecognition is device/browser dependent.
- Bengali dialect model and measured amount/intent accuracy.
- Full offline conflict policy for simultaneous multi-device changes.
- Device replacement restore workflow and server backup/restore verification.
- PostgreSQL migration validation, RLS and adversarial tenant tests on PostgreSQL.
- Staff accounts/RBAC beyond owner membership.
- Subscription/trial enforcement, bKash/Nagad gateway, SMS.
- Native Android APK packaging and testing on low-end devices.
- Complete accessibility and browser/device test matrix.
- Supplier ledger, inventory and POS intentionally excluded from the first MVP.

## Demo acceptance checks

1. Register a new shop and login.
2. Create a customer with an opening balance.
3. Add a due entry; balance must increase.
4. Record a payment; balance must decrease.
5. Refresh the page; server data must remain.
6. Submit the same operation ID twice through API docs; balance must change only once.
7. Create a second shop and verify it cannot read the first shop's customer ID.
8. With an already logged-in session, turn off network, create a customer or ledger entry, turn network on, then use Sync Center/refresh to sync.

Note: offline behaviour is a prototype implementation and must be field-tested before any real shop uses it.
