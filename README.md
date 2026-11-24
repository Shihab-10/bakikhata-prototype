# Baki Khata — Full-stack Prototype (Phase 01)

This project upgrades the teammate's original mobile-first HTML/CSS/JavaScript prototype into a working full-stack prototype while preserving its visual direction and page structure.

## What works in this phase

- Real merchant registration and password login (JWT session).
- Google Identity Services sign-in with backend ID-token verification, first-time shop onboarding, and existing-account linking (requires a Google Web Client ID).
- Shop and owner account creation.
- Tenant-scoped customer creation, search, customer details and ledger history.
- Due and payment posting with server-calculated balances.
- Opening balance recorded as a ledger event.
- Idempotent transaction operation IDs (safe retry protection).
- Basic audit events for customer and ledger changes.
- Local IndexedDB cache and durable browser outbox for customer/ledger writes.
- Sync push and snapshot pull when the connection returns.
- Server-side tenant scoping on customer and ledger endpoints.
- Corrected ledger sign convention: Due increases receivable (+); Payment reduces receivable (−).
- PWA shell and responsive mobile-first screens retained.
- FastAPI serves both API and frontend from one origin.

## Important scope boundaries

This is a staged prototype, not a production SaaS release. Phase 01 uses SQLite by default so it can run on a PC without Docker or a successful PostgreSQL installation. PostgreSQL support is included through `DATABASE_URL` and `psycopg`; switch to PostgreSQL after the local core flow is verified.

The following still need later phases and real-device testing: native Android/iOS speech modules, dialect benchmark, advanced offline conflict/restore tests, production PostgreSQL hardening/RLS, staff roles, billing/payment gateway, SMS gateway, public passbook sharing, production backups, APK packaging, and a full automated browser/device QA pass. Inventory/POS/supplier/branch pages from the original teammate ZIP remain local demo tools and are not part of the teacher's first MVP.

## Requirements

- Windows 10/11
- Python 3.11+ (your Python 3.13.2 is suitable)
- Node.js is not required to run this phase; it is retained for frontend syntax checks only.
- Internet connection for the first dependency installation.
- PostgreSQL and Docker are NOT required for the first local run.

## Port isolation (important when LandSure AI is running)

Baki Khata uses port **8010** by default so it does not collide with another local project such as LandSure AI on port 8000. Start it with `./scripts/start.ps1`. If 8010 is also occupied, use `./scripts/start.ps1 -Port 8011`. This only changes the Baki Khata process; it does not edit or stop LandSure AI.

## Setup in VS Code / PowerShell

1. Extract the ZIP into a new folder, for example `C:\Users\YOUR_USER\Downloads\BakiKhata_FullStack_01`.
2. Open that folder in VS Code.
3. Open Terminal → PowerShell. Do not copy the `PS C:\...>` prompt or `>>` characters.
4. Run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup.ps1
```

5. Create the demo shop data (optional but recommended):

```powershell
.\scripts\seed-demo.ps1
```

Demo login:
- Phone: `01712987654`
- Password: `Demo@12345`

6. Start the application:

```powershell
.\scripts\start.ps1
```

7. Open these URLs:
- App: http://127.0.0.1:8010
- API docs: http://127.0.0.1:8010/docs
- Health: http://127.0.0.1:8010/health

You can also register your own shop from the login page. For a clean demonstration, use the seeded demo account first.

## Run automated backend tests

Open a second PowerShell terminal in the project root and run:

```powershell
.\scripts\test.ps1
```

## Google Sign-In setup

Follow `docs/GOOGLE_SIGNIN_SETUP_BN.md`. Add `GOOGLE_CLIENT_ID` to `backend/.env`, then rerun `scripts/setup.ps1` and restart the server. Demo Login and mobile/password login continue to work even before Google is configured.

## PostgreSQL later

The first run uses SQLite at `backend/data/bakikhata.db`. After PostgreSQL 17 is successfully installed, stop the server and edit `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@127.0.0.1:5432/bakikhata
```

Create a database named `bakikhata` in pgAdmin, restart `scripts/start.ps1`, then the API will create the prototype tables. Never share your database password or commit `.env` to Git.

## Project layout

```text
BakiKhata_FullStack_01/
├── frontend/                 # Teammate UI, retained and integrated
│   ├── index.html
│   ├── pages/
│   ├── css/
│   └── js/
├── backend/
│   ├── app/                   # FastAPI, SQLAlchemy models, auth, sync
│   ├── tests/
│   ├── data/                  # Local SQLite database
│   ├── requirements.txt
│   └── .env.example
├── scripts/                   # Windows PowerShell setup/run/test scripts
└── docs/
```

## Financial rule

Customer balance is calculated from immutable ledger events:

`Current Due = Sum(DUE) − Sum(PAYMENT)`

A retry with the same operation ID is not counted twice. Confirmed entries should be corrected through reversal/correction events, not silently overwritten.


## Firebase Google Authentication

See `docs/FIREBASE_AUTH_SETUP_BN.md` for Firebase project setup, Google provider enablement, local configuration, and deployment notes. Demo and mobile/password login remain available when Firebase is not configured.
