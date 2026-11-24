import uuid

from fastapi.testclient import TestClient
import app.api as api_module
from app.main import app

client = TestClient(app)


def fake_firebase_profile():
    return {
        "uid": "firebase-" + uuid.uuid4().hex,
        "email": "firebase-" + uuid.uuid4().hex[:10] + "@example.com",
        "email_verified": True,
        "name": "Firebase Google Merchant",
        "picture": "https://example.com/firebase-avatar.png",
    }


def test_firebase_first_login_register_and_returning_login(monkeypatch):
    profile = fake_firebase_profile()
    monkeypatch.setattr(api_module, "verify_firebase_id_token", lambda token: profile)
    monkeypatch.setenv("FIREBASE_API_KEY", "test-api-key")
    monkeypatch.setenv("FIREBASE_AUTH_DOMAIN", "test-project.firebaseapp.com")
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "test-project")
    monkeypatch.setenv("FIREBASE_APP_ID", "1:test:web:test")

    config = client.get("/api/v1/auth/config")
    assert config.status_code == 200
    assert config.json()["firebase_enabled"] is True
    assert config.json()["firebase_config"]["projectId"] == "test-project"

    first = client.post("/api/v1/auth/firebase", json={"id_token": "x" * 120})
    assert first.status_code == 200
    assert first.json()["requires_shop_setup"] is True

    phone = "01" + str(uuid.uuid4().int)[-9:]
    created = client.post("/api/v1/auth/firebase/register", json={
        "id_token": "x" * 120,
        "phone": phone,
        "shop_name": "Firebase Test Store",
        "address": "Dhaka",
        "business_type": "grocery",
    })
    assert created.status_code == 200
    assert created.json()["user"]["email"] == profile["email"]

    token = created.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["shop"]["name"] == "Firebase Test Store"

    returning = client.post("/api/v1/auth/firebase", json={"id_token": "x" * 120})
    assert returning.status_code == 200
    assert returning.json().get("access_token")


def test_existing_phone_user_can_link_firebase_google(monkeypatch):
    profile = fake_firebase_profile()
    monkeypatch.setattr(api_module, "verify_firebase_id_token", lambda token: profile)
    phone = "01" + str(uuid.uuid4().int)[-9:]
    registered = client.post("/api/v1/auth/register", json={
        "phone": phone,
        "password": "TestPass@123",
        "owner_name": "Phone User",
        "shop_name": "Phone Shop",
        "address": "Dhaka",
        "business_type": "grocery",
    })
    assert registered.status_code == 200
    access_token = registered.json()["access_token"]

    linked = client.post(
        "/api/v1/auth/firebase/link",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"id_token": "x" * 120},
    )
    assert linked.status_code == 200
    assert linked.json()["linked"] is True

    login = client.post("/api/v1/auth/firebase", json={"id_token": "x" * 120})
    assert login.status_code == 200
    assert login.json().get("access_token")


def test_firebase_auth_config_is_disabled_until_complete(monkeypatch):
    for key in ("FIREBASE_API_KEY", "FIREBASE_AUTH_DOMAIN", "FIREBASE_PROJECT_ID", "FIREBASE_APP_ID"):
        monkeypatch.delenv(key, raising=False)
    config = client.get("/api/v1/auth/config")
    assert config.status_code == 200
    assert config.json()["firebase_enabled"] is False

    # Demo/mobile auth routes remain available when Firebase is not configured.
    assert client.post("/api/v1/auth/login", json={
        "phone": "01712987654", "password": "Demo@12345"
    }).status_code in (200, 401)


def test_firebase_register_rejects_existing_mobile_account(monkeypatch):
    profile = fake_firebase_profile()
    monkeypatch.setattr(api_module, "verify_firebase_id_token", lambda token: profile)
    phone = "01" + str(uuid.uuid4().int)[-9:]
    registered = client.post("/api/v1/auth/register", json={
        "phone": phone,
        "password": "TestPass@123",
        "owner_name": "Existing Phone User",
        "shop_name": "Existing Phone Shop",
        "address": "Dhaka",
        "business_type": "grocery",
    })
    assert registered.status_code == 200

    conflict = client.post("/api/v1/auth/firebase/register", json={
        "id_token": "x" * 120,
        "phone": phone,
        "shop_name": "Duplicate Shop",
        "address": "",
        "business_type": "grocery",
    })
    assert conflict.status_code == 409


def test_firebase_token_verifier_requires_project_and_rejects_malformed_token(monkeypatch):
    from app.security import (
        verify_firebase_id_token,
        FirebaseAuthNotConfigured,
        InvalidFirebaseToken,
    )
    import pytest

    monkeypatch.delenv("FIREBASE_PROJECT_ID", raising=False)
    with pytest.raises(FirebaseAuthNotConfigured):
        verify_firebase_id_token("not-a-jwt")

    monkeypatch.setenv("FIREBASE_PROJECT_ID", "test-project")
    with pytest.raises(InvalidFirebaseToken):
        verify_firebase_id_token("not-a-jwt")


def test_legacy_verified_google_identity_is_migrated(monkeypatch):
    from app.database import SessionLocal
    from app.models import GoogleIdentity, FirebaseIdentity
    profile = fake_firebase_profile()
    monkeypatch.setattr(api_module, "verify_firebase_id_token", lambda token: profile)

    phone = "01" + str(uuid.uuid4().int)[-9:]
    registered = client.post("/api/v1/auth/register", json={
        "phone": phone,
        "password": "TestPass@123",
        "owner_name": "Legacy Google User",
        "shop_name": "Legacy Google Shop",
        "address": "Dhaka",
        "business_type": "grocery",
    })
    assert registered.status_code == 200
    user_id = registered.json()["user"]["id"]

    db = SessionLocal()
    try:
        db.add(GoogleIdentity(
            user_id=user_id,
            google_sub="legacy-sub-" + uuid.uuid4().hex,
            email=profile["email"],
            full_name=profile["name"],
            picture_url=profile["picture"],
            email_verified=True,
        ))
        db.commit()
    finally:
        db.close()

    migrated = client.post("/api/v1/auth/firebase", json={"id_token": "x" * 120})
    assert migrated.status_code == 200
    assert migrated.json().get("access_token")

    db = SessionLocal()
    try:
        linked = db.query(FirebaseIdentity).filter_by(firebase_uid=profile["uid"]).first()
        assert linked is not None
        assert linked.user_id == user_id
    finally:
        db.close()
