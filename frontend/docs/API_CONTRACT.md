# FastAPI + PostgreSQL API Contract — Implemented Phase 01

Base path: `/api/v1`

## Authentication
- `POST /auth/register` — create owner, shop and owner membership.
- `POST /auth/login` — phone/password login, returns JWT.
- `GET /auth/me` — current user and shop.
- `PATCH /auth/profile` — update owner display name.
- `PATCH /shops/current` — update current shop name/address/type.

## Customers and ledger
- `GET /customers`
- `POST /customers`
- `GET /customers/{customer_id}`
- `PATCH /customers/{customer_id}`
- `GET /customers/{customer_id}/ledger`
- `GET /transactions?party_id={customer_id}`
- `POST /transactions`
- `POST /transactions/{entry_id}/reverse`
- `GET /dashboard/summary`

## Offline sync
- `POST /sync/push` — sequential idempotent `CREATE_CUSTOMER` and `CREATE_LEDGER_ENTRY` operations.
- `GET /sync/pull` — current shop's customer and transaction snapshot.

All protected routes require `Authorization: Bearer <token>`. Shop scope is derived from the authenticated membership, never trusted from a client-supplied tenant ID.

## Money format
The UI sends whole BDT integer amounts. The database stores integer paisa in `amount_paisa`. Balance = Sum(DUE) − Sum(PAYMENT).


## Firebase Google Authentication

- `GET /api/v1/auth/config` returns public Firebase Web App config only when all required fields are set.
- `POST /api/v1/auth/firebase` accepts `{ "id_token": "..." }`; returns a BakiKhata JWT for an existing linked identity, or `requires_shop_setup`.
- `POST /api/v1/auth/firebase/register` accepts `{ "id_token", "phone", "shop_name", "address", "business_type" }`; creates the merchant and shop after server-side Firebase token verification.
- `POST /api/v1/auth/firebase/link` accepts `{ "id_token": "..." }` with an existing BakiKhata bearer token to link a Google identity to the current merchant.

Firebase ID tokens are not used as BakiKhata API access tokens. The backend verifies them and issues its own shop-scoped JWT.
