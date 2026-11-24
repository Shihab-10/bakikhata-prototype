from __future__ import annotations

import hashlib, json, uuid, os, secrets
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo
from typing import Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select, func, case
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, Shop, Membership, Customer, LedgerEntry, SyncOperation, AuditLog, GoogleIdentity, FirebaseIdentity, utcnow
from .schemas import (
    RegisterIn, LoginIn, CustomerCreateIn, CustomerUpdateIn, LedgerCreateIn,
    ReverseIn, ShopUpdateIn, SyncPushIn, GoogleCredentialIn, GoogleRegisterIn, FirebaseCredentialIn, FirebaseRegisterIn,
)
from .security import (hash_password, verify_password, create_access_token, decode_access_token, normalize_phone,
                       verify_google_id_token, GoogleAuthNotConfigured, InvalidGoogleCredential,
                       verify_firebase_id_token, FirebaseAuthNotConfigured, InvalidFirebaseToken)

router = APIRouter(prefix="/api/v1")
bearer = HTTPBearer(auto_error=False)


def _balance_paisa(db: Session, shop_id: str, customer_id: str) -> int:
    value = db.scalar(
        select(func.coalesce(func.sum(
            case(
                (LedgerEntry.entry_type == "DUE", LedgerEntry.amount_paisa),
                (LedgerEntry.entry_type == "PAYMENT", -LedgerEntry.amount_paisa),
                (LedgerEntry.entry_type == "REVERSAL", LedgerEntry.amount_paisa),
                else_=0,
            )
        ), 0)).where(
            LedgerEntry.shop_id == shop_id,
            LedgerEntry.customer_id == customer_id,
        )
    )
    return int(value or 0)


def _customer_dict(db: Session, customer: Customer, shop_id: str) -> dict[str, Any]:
    balance = _balance_paisa(db, shop_id, customer.id)
    last_entry = db.scalar(
        select(LedgerEntry).where(
            LedgerEntry.shop_id == shop_id,
            LedgerEntry.customer_id == customer.id,
        ).order_by(LedgerEntry.created_at.desc()).limit(1)
    )
    return {
        "id": customer.id,
        "name": customer.name,
        "alias": customer.alias or "",
        "area": customer.area or "",
        "phone": customer.phone or "",
        "balance": balance / 100,
        "limit": 0,
        "lastTxAt": (last_entry.created_at if last_entry else customer.created_at).isoformat(),
        "status": customer.status,
    }


def _entry_dict(db: Session, entry: LedgerEntry) -> dict[str, Any]:
    customer = db.get(Customer, entry.customer_id)
    tx_type = "credit_given" if entry.entry_type == "DUE" else "payment_received"
    if entry.entry_type == "REVERSAL":
        tx_type = "adjustment"
    return {
        "id": entry.id,
        "operationId": entry.operation_id,
        "partyType": "customer",
        "partyId": entry.customer_id,
        "partyName": f"{customer.name} ({customer.area})" if customer and customer.area else (customer.name if customer else "Customer"),
        "txType": tx_type,
        "amount": entry.amount_paisa / 100,
        "channel": entry.channel,
        "note": entry.note or "",
        "createdAt": entry.created_at.isoformat(),
        "businessDate": entry.business_date.isoformat(),
        "syncStatus": "synced",
    }


def _current_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if not credentials:
        raise HTTPException(status_code=401, detail="লগইন করুন")
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = str(payload.get("sub"))
        shop_id = str(payload.get("shop_id"))
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="সেশন শেষ হয়েছে। আবার লগইন করুন")
    user = db.get(User, user_id)
    membership = db.scalar(select(Membership).where(
        Membership.user_id == user_id,
        Membership.shop_id == shop_id,
        Membership.active.is_(True),
    ))
    shop = db.get(Shop, shop_id)
    if not user or not user.is_active or not membership or not shop or shop.status != "active":
        raise HTTPException(status_code=403, detail="এই দোকানে প্রবেশের অনুমতি নেই")
    return {"user": user, "shop": shop, "membership": membership}


def _create_customer(db: Session, shop_id: str, actor_id: str, payload: dict[str, Any]) -> Customer:
    client_id = str(payload.get("client_id") or uuid.uuid4())
    existing = db.scalar(select(Customer).where(Customer.id == client_id, Customer.shop_id == shop_id))
    if existing:
        if existing.name != str(payload.get("name", "")).strip() or (existing.phone or "") != str(payload.get("phone", "") or "").strip():
            raise ValueError("client_id already belongs to a different customer payload")
        return existing
    customer = Customer(
        id=client_id,
        shop_id=shop_id,
        name=str(payload.get("name", "")).strip(),
        alias=str(payload.get("alias", "") or "").strip(),
        area=str(payload.get("area", "") or "").strip(),
        phone=str(payload.get("phone", "") or "").strip(),
    )
    if not customer.name:
        raise ValueError("Customer name is required")
    db.add(customer)
    opening_balance = int(payload.get("opening_balance", 0) or 0)
    if opening_balance > 0:
        op_id = f"{payload.get('operation_id') or client_id}:opening"
        db.add(LedgerEntry(
            id=str(uuid.uuid4()), shop_id=shop_id, customer_id=client_id,
            entry_type="DUE", amount_paisa=opening_balance * 100,
            business_date=date.today(), note="শুরুর জের (Opening Balance)",
            channel="opening", operation_id=op_id, actor_id=actor_id,
        ))
    db.add(AuditLog(
        shop_id=shop_id, actor_id=actor_id, action="CUSTOMER_CREATED",
        entity_type="customer", entity_id=client_id,
        details=json.dumps({"name": customer.name}, ensure_ascii=False),
    ))
    return customer


def _create_entry(db: Session, shop_id: str, actor_id: str, payload: dict[str, Any]) -> tuple[LedgerEntry, bool]:
    operation_id = str(payload.get("operation_id") or "").strip()
    if not operation_id:
        raise ValueError("operation_id is required")
    existing = db.scalar(select(LedgerEntry).where(
        LedgerEntry.shop_id == shop_id,
        LedgerEntry.operation_id == operation_id,
    ))
    if existing:
        requested_type = payload.get("tx_type") or payload.get("txType")
        expected_type = "DUE" if requested_type == "credit_given" else "PAYMENT"
        if (existing.customer_id != str(payload.get("customer_id") or "") or
            existing.entry_type != expected_type or
            existing.amount_paisa != int(payload.get("amount", 0) or 0) * 100):
            raise ValueError("operation_id already used with a different transaction payload")
        return existing, True
    customer_id = str(payload.get("customer_id") or "")
    customer = db.scalar(select(Customer).where(
        Customer.id == customer_id,
        Customer.shop_id == shop_id,
        Customer.status == "active",
    ))
    if not customer:
        raise ValueError("Customer not found in this shop")
    amount = int(payload.get("amount", 0) or 0)
    if amount <= 0:
        raise ValueError("Amount must be greater than zero")
    tx_type = payload.get("tx_type") or payload.get("txType")
    if tx_type not in ("credit_given", "payment_received"):
        raise ValueError("Invalid transaction type")
    business_date_raw = payload.get("business_date") or payload.get("businessDate")
    business_date = date.fromisoformat(str(business_date_raw)) if business_date_raw else datetime.now(ZoneInfo("Asia/Dhaka")).date()
    entry = LedgerEntry(
        id=str(uuid.uuid4()), shop_id=shop_id, customer_id=customer_id,
        entry_type="DUE" if tx_type == "credit_given" else "PAYMENT",
        amount_paisa=amount * 100,
        business_date=business_date,
        note=str(payload.get("note", "") or "").strip(),
        channel=str(payload.get("channel", "cash") or "cash"),
        operation_id=operation_id,
        actor_id=actor_id,
    )
    db.add(entry)
    db.add(AuditLog(
        shop_id=shop_id, actor_id=actor_id,
        action="DUE_ADDED" if tx_type == "credit_given" else "PAYMENT_RECEIVED",
        entity_type="ledger_entry", entity_id=entry.id,
        details=json.dumps({"customer_id": customer_id, "amount": amount, "note": entry.note}, ensure_ascii=False),
    ))
    return entry, False


@router.post("/auth/register")
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    phone = normalize_phone(payload.phone)
    if len(phone) != 11 or not phone.startswith("01"):
        raise HTTPException(status_code=422, detail="সঠিক বাংলাদেশি মোবাইল নম্বর দিন")
    if db.scalar(select(User).where(User.phone == phone)):
        raise HTTPException(status_code=409, detail="এই মোবাইল নম্বর দিয়ে আগে অ্যাকাউন্ট খোলা হয়েছে")
    user = User(phone=phone, full_name=payload.owner_name.strip(), password_hash=hash_password(payload.password))
    shop = Shop(name=payload.shop_name.strip(), address=payload.address.strip(), business_type=payload.business_type)
    db.add(user); db.add(shop); db.flush()
    membership = Membership(user_id=user.id, shop_id=shop.id, role="owner")
    db.add(membership)
    db.commit()
    token = create_access_token(user.id, shop.id)
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "phone": user.phone, "full_name": user.full_name}, "shop": {"id": shop.id, "name": shop.name, "address": shop.address, "role": "owner"}}


@router.post("/auth/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    phone = normalize_phone(payload.phone)
    user = db.scalar(select(User).where(User.phone == phone, User.is_active.is_(True)))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="মোবাইল নম্বর অথবা পাসওয়ার্ড সঠিক নয়")
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id, Membership.active.is_(True)))
    if not membership:
        raise HTTPException(status_code=403, detail="কোনো সক্রিয় দোকানের অনুমতি পাওয়া যায়নি")
    shop = db.get(Shop, membership.shop_id)
    if not shop or shop.status != "active":
        raise HTTPException(status_code=403, detail="দোকানটি বর্তমানে সক্রিয় নয়")
    token = create_access_token(user.id, shop.id)
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "phone": user.phone, "full_name": user.full_name}, "shop": {"id": shop.id, "name": shop.name, "address": shop.address, "role": membership.role}}


def _verified_google_profile(credential: str) -> dict[str, Any]:
    try:
        return verify_google_id_token(credential)
    except GoogleAuthNotConfigured:
        raise HTTPException(status_code=503, detail="Google Sign-In এখনো configure করা হয়নি। backend/.env ফাইলে GOOGLE_CLIENT_ID সেট করুন।")
    except InvalidGoogleCredential:
        raise HTTPException(status_code=401, detail="Google verification ব্যর্থ হয়েছে। আবার চেষ্টা করুন।")


def _google_session_response(db: Session, identity: GoogleIdentity) -> dict[str, Any]:
    user = db.get(User, identity.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="এই Google account-এর merchant access নিষ্ক্রিয়")
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id, Membership.active.is_(True)).order_by(Membership.created_at.asc()))
    if not membership:
        raise HTTPException(status_code=403, detail="এই Google account-এর কোনো সক্রিয় দোকান নেই")
    shop = db.get(Shop, membership.shop_id)
    if not shop or shop.status != "active":
        raise HTTPException(status_code=403, detail="দোকানটি বর্তমানে সক্রিয় নয়")
    token = create_access_token(user.id, shop.id)
    return {
        "access_token": token, "token_type": "bearer",
        "user": {"id": user.id, "phone": user.phone, "full_name": user.full_name, "email": identity.email, "picture": identity.picture_url},
        "shop": {"id": shop.id, "name": shop.name, "address": shop.address, "role": membership.role},
    }


@router.get("/auth/config")
def auth_config():
    # Firebase web configuration is public client configuration, not a server secret.
    firebase_config = {
        "apiKey": os.getenv("FIREBASE_API_KEY", "").strip(),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN", "").strip(),
        "projectId": os.getenv("FIREBASE_PROJECT_ID", "").strip(),
        "appId": os.getenv("FIREBASE_APP_ID", "").strip(),
    }
    firebase_enabled = all(firebase_config.values())
    # Keep legacy flags for older clients during the migration; the current UI uses Firebase.
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    return {
        "firebase_enabled": firebase_enabled,
        "firebase_config": firebase_config if firebase_enabled else None,
        "google_enabled": bool(client_id),
        "google_client_id": client_id or None,
    }


@router.post("/auth/google")
def google_login(payload: GoogleCredentialIn, db: Session = Depends(get_db)):
    profile = _verified_google_profile(payload.credential)
    identity = db.scalar(select(GoogleIdentity).where(GoogleIdentity.google_sub == profile["sub"]))
    if identity:
        return _google_session_response(db, identity)
    return {
        "requires_shop_setup": True,
        "google_profile": {"email": profile["email"], "name": profile["name"], "picture": profile["picture"]},
    }


@router.post("/auth/google/register")
def google_register(payload: GoogleRegisterIn, db: Session = Depends(get_db)):
    profile = _verified_google_profile(payload.credential)
    existing_identity = db.scalar(select(GoogleIdentity).where(GoogleIdentity.google_sub == profile["sub"]))
    if existing_identity:
        return _google_session_response(db, existing_identity)

    phone = normalize_phone(payload.phone)
    if len(phone) != 11 or not phone.startswith("01"):
        raise HTTPException(status_code=422, detail="সঠিক বাংলাদেশি মোবাইল নম্বর দিন")
    if db.scalar(select(User).where(User.phone == phone)):
        raise HTTPException(status_code=409, detail="এই মোবাইল নম্বর দিয়ে আগে অ্যাকাউন্ট খোলা হয়েছে। আগে মোবাইল নম্বর দিয়ে লগইন করে Settings থেকে Google account connect করুন।")
    shop_name = payload.shop_name.strip()
    if len(shop_name) < 2:
        raise HTTPException(status_code=422, detail="দোকানের নাম কমপক্ষে ২ অক্ষরের হতে হবে")

    # A strong random local password is stored because the legacy merchant
    # schema requires one; the user never receives or enters this password.
    user = User(
        phone=phone, full_name=profile["name"] or "Merchant",
        password_hash=hash_password(secrets.token_urlsafe(48)),
    )
    shop = Shop(name=shop_name, address=payload.address.strip(), business_type=payload.business_type)
    db.add(user); db.add(shop); db.flush()
    db.add(Membership(user_id=user.id, shop_id=shop.id, role="owner"))
    identity = GoogleIdentity(
        user_id=user.id, google_sub=profile["sub"], email=profile["email"],
        full_name=profile["name"], picture_url=profile["picture"], email_verified=True,
    )
    db.add(identity)
    db.add(AuditLog(shop_id=shop.id, actor_id=user.id, action="GOOGLE_ACCOUNT_CREATED",
                    entity_type="user", entity_id=user.id, details=json.dumps({"email": profile["email"]})))
    try:
        db.commit(); db.refresh(identity)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="Google account বা mobile number আগে থেকেই যুক্ত থাকতে পারে। আবার লগইন করুন।")
    return _google_session_response(db, identity)


@router.post("/auth/google/link")
def google_link(payload: GoogleCredentialIn, db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    profile = _verified_google_profile(payload.credential)
    existing = db.scalar(select(GoogleIdentity).where(GoogleIdentity.google_sub == profile["sub"]))
    if existing:
        if existing.user_id == ctx["user"].id:
            return {"linked": True, "email": existing.email, "message": "এই Google account আগে থেকেই যুক্ত আছে"}
        raise HTTPException(status_code=409, detail="এই Google account অন্য একটি merchant account-এর সাথে যুক্ত")
    identity = GoogleIdentity(
        user_id=ctx["user"].id, google_sub=profile["sub"], email=profile["email"],
        full_name=profile["name"], picture_url=profile["picture"], email_verified=True,
    )
    db.add(identity)
    db.add(AuditLog(shop_id=ctx["shop"].id, actor_id=ctx["user"].id, action="GOOGLE_ACCOUNT_LINKED",
                    entity_type="user", entity_id=ctx["user"].id, details=json.dumps({"email": profile["email"]})))
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="এই Google account অন্য একটি account-এ যুক্ত থাকতে পারে")
    return {"linked": True, "email": profile["email"], "message": "Google account সফলভাবে যুক্ত হয়েছে"}




def _verified_firebase_profile(id_token: str) -> dict[str, Any]:
    try:
        return verify_firebase_id_token(id_token)
    except FirebaseAuthNotConfigured:
        raise HTTPException(status_code=503, detail="Firebase Authentication configure করা হয়নি। Firebase settings backend/.env-এ যোগ করুন।")
    except InvalidFirebaseToken:
        raise HTTPException(status_code=401, detail="Firebase token যাচাই করা যায়নি। আবার Google দিয়ে sign in করুন।")


def _firebase_session_response(db: Session, identity: FirebaseIdentity) -> dict[str, Any]:
    user = db.get(User, identity.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="এই Google account-এর merchant access নিষ্ক্রিয়")
    membership = db.scalar(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.active.is_(True),
        ).order_by(Membership.created_at.asc())
    )
    if not membership:
        raise HTTPException(status_code=403, detail="এই Google account-এর কোনো সক্রিয় দোকান নেই")
    shop = db.get(Shop, membership.shop_id)
    if not shop or shop.status != "active":
        raise HTTPException(status_code=403, detail="দোকানটি বর্তমানে সক্রিয় নয়")
    token = create_access_token(user.id, shop.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "phone": user.phone,
            "full_name": user.full_name,
            "email": identity.email,
            "picture": identity.picture_url,
        },
        "shop": {
            "id": shop.id,
            "name": shop.name,
            "address": shop.address,
            "role": membership.role,
        },
    }




def _migrate_legacy_google_identity(db: Session, profile: dict[str, Any]) -> FirebaseIdentity | None:
    """Link a verified legacy GIS identity by its already-verified Google email."""
    legacy_matches = db.scalars(
        select(GoogleIdentity).where(
            func.lower(GoogleIdentity.email) == profile["email"],
            GoogleIdentity.email_verified.is_(True),
        ).limit(2)
    ).all()
    if len(legacy_matches) != 1:
        return None
    legacy = legacy_matches[0]
    user = db.get(User, legacy.user_id)
    if not user or not user.is_active:
        return None
    identity = FirebaseIdentity(
        user_id=user.id,
        firebase_uid=profile["uid"],
        email=profile["email"],
        full_name=profile["name"],
        picture_url=profile["picture"],
        email_verified=True,
    )
    db.add(identity)
    try:
        db.commit()
        db.refresh(identity)
    except Exception:
        db.rollback()
        return None
    return identity


@router.post("/auth/firebase")
def firebase_login(payload: FirebaseCredentialIn, db: Session = Depends(get_db)):
    profile = _verified_firebase_profile(payload.id_token)
    identity = db.scalar(
        select(FirebaseIdentity).where(FirebaseIdentity.firebase_uid == profile["uid"])
    )
    if identity:
        return _firebase_session_response(db, identity)
    # Existing merchants created by the previous direct Google Sign-In build
    # can migrate safely because both identities carry the same verified Google email.
    identity = _migrate_legacy_google_identity(db, profile)
    if identity:
        return _firebase_session_response(db, identity)
    return {
        "requires_shop_setup": True,
        "firebase_profile": {
            "email": profile["email"],
            "name": profile["name"],
            "picture": profile["picture"],
        },
    }


@router.post("/auth/firebase/register")
def firebase_register(payload: FirebaseRegisterIn, db: Session = Depends(get_db)):
    profile = _verified_firebase_profile(payload.id_token)
    existing_identity = db.scalar(
        select(FirebaseIdentity).where(FirebaseIdentity.firebase_uid == profile["uid"])
    )
    if existing_identity:
        return _firebase_session_response(db, existing_identity)
    legacy_identity = _migrate_legacy_google_identity(db, profile)
    if legacy_identity:
        return _firebase_session_response(db, legacy_identity)

    phone = normalize_phone(payload.phone)
    if len(phone) != 11 or not phone.startswith("01"):
        raise HTTPException(status_code=422, detail="সঠিক বাংলাদেশি মোবাইল নম্বর দিন")
    if db.scalar(select(User).where(User.phone == phone)):
        raise HTTPException(
            status_code=409,
            detail="এই মোবাইল নম্বর দিয়ে আগে অ্যাকাউন্ট খোলা হয়েছে। আগে মোবাইল নম্বর দিয়ে লগইন করে Settings থেকে Google account সংযুক্ত করুন।",
        )

    shop_name = payload.shop_name.strip()
    if len(shop_name) < 2:
        raise HTTPException(status_code=422, detail="দোকানের নাম কমপক্ষে ২ অক্ষরের হতে হবে")

    user = User(
        phone=phone,
        full_name=profile["name"] or "Merchant",
        password_hash=hash_password(secrets.token_urlsafe(48)),
    )
    shop = Shop(
        name=shop_name,
        address=payload.address.strip(),
        business_type=payload.business_type,
    )
    db.add(user)
    db.add(shop)
    db.flush()
    db.add(Membership(user_id=user.id, shop_id=shop.id, role="owner"))
    identity = FirebaseIdentity(
        user_id=user.id,
        firebase_uid=profile["uid"],
        email=profile["email"],
        full_name=profile["name"],
        picture_url=profile["picture"],
        email_verified=True,
    )
    db.add(identity)
    db.add(AuditLog(
        shop_id=shop.id,
        actor_id=user.id,
        action="FIREBASE_GOOGLE_ACCOUNT_CREATED",
        entity_type="user",
        entity_id=user.id,
        details=json.dumps({"email": profile["email"]}, ensure_ascii=False),
    ))
    try:
        db.commit()
        db.refresh(identity)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="এই Google account বা mobile number আগে থেকেই যুক্ত থাকতে পারে। আবার চেষ্টা করুন।")
    return _firebase_session_response(db, identity)


@router.post("/auth/firebase/link")
def firebase_link(
    payload: FirebaseCredentialIn,
    db: Session = Depends(get_db),
    ctx: dict = Depends(_current_context),
):
    profile = _verified_firebase_profile(payload.id_token)
    existing = db.scalar(
        select(FirebaseIdentity).where(FirebaseIdentity.firebase_uid == profile["uid"])
    )
    if existing:
        if existing.user_id == ctx["user"].id:
            return {"linked": True, "email": existing.email, "message": "এই Google account আগে থেকেই যুক্ত আছে"}
        raise HTTPException(status_code=409, detail="এই Google account অন্য একটি merchant account-এর সাথে যুক্ত")

    identity = FirebaseIdentity(
        user_id=ctx["user"].id,
        firebase_uid=profile["uid"],
        email=profile["email"],
        full_name=profile["name"],
        picture_url=profile["picture"],
        email_verified=True,
    )
    db.add(identity)
    db.add(AuditLog(
        shop_id=ctx["shop"].id,
        actor_id=ctx["user"].id,
        action="FIREBASE_GOOGLE_ACCOUNT_LINKED",
        entity_type="user",
        entity_id=ctx["user"].id,
        details=json.dumps({"email": profile["email"]}, ensure_ascii=False),
    ))
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="এই Google account অন্য একটি account-এ যুক্ত থাকতে পারে")
    return {"linked": True, "email": profile["email"], "message": "Google account সফলভাবে যুক্ত হয়েছে"}


@router.get("/auth/me")
def me(ctx: dict = Depends(_current_context)):
    user, shop, membership = ctx["user"], ctx["shop"], ctx["membership"]
    return {"user": {"id": user.id, "phone": user.phone, "full_name": user.full_name}, "shop": {"id": shop.id, "name": shop.name, "address": shop.address, "business_type": shop.business_type, "role": membership.role}}


@router.patch("/shops/current")
def update_shop(payload: ShopUpdateIn, db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    shop = ctx["shop"]
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(shop, key, value)
    db.commit(); db.refresh(shop)
    return {"id": shop.id, "name": shop.name, "address": shop.address, "business_type": shop.business_type}



@router.patch("/auth/profile")
def update_profile(payload: dict, db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    name = str(payload.get("full_name", "")).strip()
    if len(name) < 2 or len(name) > 160:
        raise HTTPException(status_code=422, detail="নামের দৈর্ঘ্য সঠিক নয়")
    user = ctx["user"]
    user.full_name = name
    db.add(AuditLog(shop_id=ctx["shop"].id, actor_id=user.id, action="PROFILE_UPDATED", entity_type="user", entity_id=user.id, details="owner name updated"))
    db.commit(); db.refresh(user)
    return {"id": user.id, "full_name": user.full_name, "phone": user.phone}

@router.get("/customers")
def list_customers(db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    shop_id = ctx["shop"].id
    customers = db.scalars(select(Customer).where(Customer.shop_id == shop_id, Customer.status == "active").order_by(Customer.created_at.desc())).all()
    items = [_customer_dict(db, customer, shop_id) for customer in customers]
    items.sort(key=lambda item: item["lastTxAt"], reverse=True)
    return {"items": items, "total": len(items)}


@router.post("/customers", status_code=201)
def create_customer(payload: CustomerCreateIn, db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    shop_id, actor_id = ctx["shop"].id, ctx["user"].id
    data = payload.model_dump()
    data["operation_id"] = data.get("operation_id") or f"customer:{data.get('client_id') or uuid.uuid4()}"
    try:
        customer = _create_customer(db, shop_id, actor_id, data)
        db.commit(); db.refresh(customer)
    except ValueError as exc:
        db.rollback(); raise HTTPException(status_code=422, detail=str(exc))
    return _customer_dict(db, customer, shop_id)


@router.get("/customers/{customer_id}")
def get_customer(customer_id: str, db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    customer = db.scalar(select(Customer).where(Customer.id == customer_id, Customer.shop_id == ctx["shop"].id))
    if not customer:
        raise HTTPException(status_code=404, detail="খরিদ্দার পাওয়া যায়নি")
    return _customer_dict(db, customer, ctx["shop"].id)


@router.patch("/customers/{customer_id}")
def update_customer(customer_id: str, payload: CustomerUpdateIn, db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    customer = db.scalar(select(Customer).where(Customer.id == customer_id, Customer.shop_id == ctx["shop"].id))
    if not customer:
        raise HTTPException(status_code=404, detail="খরিদ্দার পাওয়া যায়নি")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, key, value)
    db.add(AuditLog(shop_id=ctx["shop"].id, actor_id=ctx["user"].id, action="CUSTOMER_UPDATED", entity_type="customer", entity_id=customer.id, details="profile updated"))
    db.commit(); db.refresh(customer)
    return _customer_dict(db, customer, ctx["shop"].id)


@router.get("/customers/{customer_id}/ledger")
def customer_ledger(customer_id: str, db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    shop_id = ctx["shop"].id
    customer = db.scalar(select(Customer).where(Customer.id == customer_id, Customer.shop_id == shop_id))
    if not customer:
        raise HTTPException(status_code=404, detail="খরিদ্দার পাওয়া যায়নি")
    entries = db.scalars(select(LedgerEntry).where(LedgerEntry.shop_id == shop_id, LedgerEntry.customer_id == customer_id).order_by(LedgerEntry.business_date.desc(), LedgerEntry.created_at.desc())).all()
    return {"customer": _customer_dict(db, customer, shop_id), "items": [_entry_dict(db, e) for e in entries]}


@router.get("/transactions")
def list_transactions(party_id: str | None = None, party_type: str | None = None, db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    query = select(LedgerEntry).where(LedgerEntry.shop_id == ctx["shop"].id)
    if party_id:
        query = query.where(LedgerEntry.customer_id == party_id)
    entries = db.scalars(query.order_by(LedgerEntry.business_date.desc(), LedgerEntry.created_at.desc()).limit(1000)).all()
    return {"items": [_entry_dict(db, e) for e in entries], "total": len(entries)}


@router.post("/transactions", status_code=201)
def create_transaction(payload: LedgerCreateIn, db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    try:
        entry, duplicate = _create_entry(db, ctx["shop"].id, ctx["user"].id, payload.model_dump())
        db.commit(); db.refresh(entry)
    except ValueError as exc:
        db.rollback(); raise HTTPException(status_code=422, detail=str(exc))
    return {**_entry_dict(db, entry), "duplicate": duplicate, "balance": _balance_paisa(db, ctx["shop"].id, entry.customer_id) / 100}


@router.post("/transactions/{entry_id}/reverse")
def reverse_transaction(entry_id: str, payload: ReverseIn, db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    shop_id, actor_id = ctx["shop"].id, ctx["user"].id
    original = db.scalar(select(LedgerEntry).where(LedgerEntry.id == entry_id, LedgerEntry.shop_id == shop_id))
    if not original:
        raise HTTPException(status_code=404, detail="লেনদেন পাওয়া যায়নি")
    existing = db.scalar(select(LedgerEntry).where(LedgerEntry.shop_id == shop_id, LedgerEntry.operation_id == payload.operation_id))
    if existing:
        return {**_entry_dict(db, existing), "duplicate": True}
    reversal_type = "PAYMENT" if original.entry_type == "DUE" else "DUE"
    reversal = LedgerEntry(
        shop_id=shop_id, customer_id=original.customer_id, entry_type=reversal_type,
        amount_paisa=original.amount_paisa, business_date=datetime.now(ZoneInfo("Asia/Dhaka")).date(),
        note=f"সংশোধন/বাতিল: {payload.reason}", channel="adjustment",
        operation_id=payload.operation_id, correction_of=original.id, actor_id=actor_id,
    )
    db.add(reversal)
    db.add(AuditLog(shop_id=shop_id, actor_id=actor_id, action="LEDGER_ENTRY_REVERSED", entity_type="ledger_entry", entity_id=original.id, details=payload.reason))
    db.commit(); db.refresh(reversal)
    return {**_entry_dict(db, reversal), "balance": _balance_paisa(db, shop_id, original.customer_id) / 100}


@router.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    shop_id = ctx["shop"].id
    customers = db.scalars(select(Customer).where(Customer.shop_id == shop_id, Customer.status == "active")).all()
    balances = [_balance_paisa(db, shop_id, c.id) for c in customers]
    today = datetime.now(ZoneInfo("Asia/Dhaka")).date()
    today_entries = db.scalars(select(LedgerEntry).where(LedgerEntry.shop_id == shop_id, LedgerEntry.business_date == today)).all()
    cash_in = sum(e.amount_paisa for e in today_entries if e.entry_type == "PAYMENT")
    credit = sum(e.amount_paisa for e in today_entries if e.entry_type == "DUE")
    return {
        "totalReceivable": sum(max(0, b) for b in balances) / 100,
        "totalPayable": 0,
        "todayCashIn": cash_in / 100,
        "todayCredit": credit / 100,
        "customerCount": len(customers),
        "pendingSyncCount": 0,
    }


@router.post("/sync/push")
def sync_push(payload: SyncPushIn, db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    shop_id, actor_id = ctx["shop"].id, ctx["user"].id
    results = []
    for operation in payload.operations:
        operation_payload = operation.payload
        payload_hash = hashlib.sha256(json.dumps(operation_payload, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
        prior = db.scalar(select(SyncOperation).where(SyncOperation.shop_id == shop_id, SyncOperation.operation_id == operation.operation_id))
        if prior:
            if prior.payload_hash != payload_hash:
                results.append({"operation_id": operation.operation_id, "status": "rejected", "message": "operation_id reused with a different payload"})
            else:
                results.append({"operation_id": operation.operation_id, "status": "duplicate"})
            continue
        try:
            if operation.operation_type == "CREATE_CUSTOMER":
                data = dict(operation_payload)
                data["operation_id"] = operation.operation_id
                customer = _create_customer(db, shop_id, actor_id, data)
                entity_id = customer.id
            elif operation.operation_type == "CREATE_LEDGER_ENTRY":
                data = dict(operation_payload)
                data["operation_id"] = operation.operation_id
                entry, _duplicate = _create_entry(db, shop_id, actor_id, data)
                entity_id = entry.id
            else:
                raise ValueError("Unsupported operation")
            db.add(SyncOperation(shop_id=shop_id, operation_id=operation.operation_id, operation_type=operation.operation_type, payload_hash=payload_hash, status="committed"))
            db.commit()
            results.append({"operation_id": operation.operation_id, "status": "synced", "entity_id": entity_id})
        except Exception as exc:
            db.rollback()
            results.append({"operation_id": operation.operation_id, "status": "rejected", "message": str(exc)[:240]})
    return {"results": results, "synced": sum(1 for r in results if r["status"] in ("synced", "duplicate"))}


@router.get("/sync/pull")
def sync_pull(db: Session = Depends(get_db), ctx: dict = Depends(_current_context)):
    shop_id = ctx["shop"].id
    customers = db.scalars(select(Customer).where(Customer.shop_id == shop_id, Customer.status == "active")).all()
    entries = db.scalars(select(LedgerEntry).where(LedgerEntry.shop_id == shop_id).order_by(LedgerEntry.created_at.asc())).all()
    return {
        "customers": [_customer_dict(db, c, shop_id) for c in customers],
        "transactions": [_entry_dict(db, e) for e in entries],
        "server_time": utcnow().isoformat(),
    }
