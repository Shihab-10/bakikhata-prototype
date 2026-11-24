import os
import uuid

os.environ.setdefault("DATABASE_URL", "sqlite:///./data/test_bakikhata.db")

from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db

init_db()
client = TestClient(app)


def register_account():
    suffix = str(uuid.uuid4().int)[-9:]
    phone = "01" + suffix
    response = client.post("/api/v1/auth/register", json={
        "phone": phone,
        "password": "TestPass@123",
        "owner_name": "Test Owner",
        "shop_name": "Test Shop " + suffix,
        "address": "Dhaka",
        "business_type": "grocery",
    })
    assert response.status_code == 200
    return phone, response.json()["access_token"]


def test_auth_customer_ledger_and_idempotency():
    phone, token = register_account()
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    customer = client.post("/api/v1/customers", headers=headers, json={
        "client_id": str(uuid.uuid4()), "name": "সামী", "area": "বাজার", "phone": "01700000000", "opening_balance": 1000
    })
    assert customer.status_code == 201
    customer_id = customer.json()["id"]
    assert customer.json()["balance"] == 1000
    op = str(uuid.uuid4())
    due = client.post("/api/v1/transactions", headers=headers, json={
        "operation_id": op, "customer_id": customer_id, "tx_type": "credit_given", "amount": 500, "note": "মুদি বাজার"
    })
    assert due.status_code == 201
    assert due.json()["balance"] == 1500
    duplicate = client.post("/api/v1/transactions", headers=headers, json={
        "operation_id": op, "customer_id": customer_id, "tx_type": "credit_given", "amount": 500, "note": "মুদি বাজার"
    })
    assert duplicate.status_code == 201
    assert duplicate.json()["duplicate"] is True
    payment = client.post("/api/v1/transactions", headers=headers, json={
        "operation_id": str(uuid.uuid4()), "customer_id": customer_id, "tx_type": "payment_received", "amount": 300
    })
    assert payment.status_code == 201
    assert payment.json()["balance"] == 1200
    ledger = client.get(f"/api/v1/customers/{customer_id}/ledger", headers=headers)
    assert ledger.status_code == 200
    assert len(ledger.json()["items"]) == 3


def test_tenant_isolation():
    _, token_a = register_account()
    _, token_b = register_account()
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    customer = client.post("/api/v1/customers", headers=headers_a, json={"name": "Private Customer"})
    assert customer.status_code == 201
    customer_id = customer.json()["id"]
    response = client.get(f"/api/v1/customers/{customer_id}", headers=headers_b)
    assert response.status_code == 404


def test_sync_push_is_idempotent_and_shop_scoped():
    _, token = register_account()
    headers = {"Authorization": f"Bearer {token}"}
    customer_id = str(uuid.uuid4())
    customer_operation = str(uuid.uuid4())
    customer_payload = {
        "client_id": customer_id,
        "name": "Offline Customer",
        "alias": "Offline Alias",
        "area": "Market",
        "phone": "01700000001",
        "opening_balance": 250,
    }
    first_customer = client.post("/api/v1/sync/push", headers=headers, json={
        "operations": [{"operation_id": customer_operation, "operation_type": "CREATE_CUSTOMER", "payload": customer_payload}]
    })
    assert first_customer.status_code == 200
    assert first_customer.json()["results"][0]["status"] == "synced"
    repeated_customer = client.post("/api/v1/sync/push", headers=headers, json={
        "operations": [{"operation_id": customer_operation, "operation_type": "CREATE_CUSTOMER", "payload": customer_payload}]
    })
    assert repeated_customer.json()["results"][0]["status"] == "duplicate"

    entry_operation = str(uuid.uuid4())
    entry_payload = {"customer_id": customer_id, "tx_type": "credit_given", "amount": 100, "note": "offline entry"}
    entry = client.post("/api/v1/sync/push", headers=headers, json={
        "operations": [{"operation_id": entry_operation, "operation_type": "CREATE_LEDGER_ENTRY", "payload": entry_payload}]
    })
    assert entry.json()["results"][0]["status"] == "synced"
    repeated_entry = client.post("/api/v1/sync/push", headers=headers, json={
        "operations": [{"operation_id": entry_operation, "operation_type": "CREATE_LEDGER_ENTRY", "payload": entry_payload}]
    })
    assert repeated_entry.json()["results"][0]["status"] == "duplicate"
    balance = client.get(f"/api/v1/customers/{customer_id}", headers=headers).json()["balance"]
    assert balance == 350
