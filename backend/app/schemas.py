from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict
from typing import Any

class RegisterIn(BaseModel):
    phone: str = Field(min_length=10, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    owner_name: str = Field(min_length=2, max_length=160)
    shop_name: str = Field(min_length=2, max_length=180)
    address: str = Field(default="", max_length=255)
    business_type: str = Field(default="grocery", max_length=60)

class LoginIn(BaseModel):
    phone: str = Field(min_length=10, max_length=20)
    password: str = Field(min_length=8, max_length=128)

class CustomerCreateIn(BaseModel):
    client_id: str | None = None
    name: str = Field(min_length=1, max_length=160)
    alias: str = Field(default="", max_length=160)
    area: str = Field(default="", max_length=160)
    phone: str = Field(default="", max_length=30)
    opening_balance: int = Field(default=0, ge=0, le=100000000)
    operation_id: str | None = None

class CustomerUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    alias: str | None = Field(default=None, max_length=160)
    area: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=30)
    status: str | None = Field(default=None, pattern="^(active|archived)$")

class LedgerCreateIn(BaseModel):
    operation_id: str = Field(min_length=8, max_length=80)
    customer_id: str
    tx_type: str = Field(pattern="^(credit_given|payment_received)$")
    amount: int = Field(gt=0, le=100000000)
    note: str = Field(default="", max_length=1000)
    channel: str = Field(default="cash", max_length=30)
    business_date: str | None = None

class ReverseIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    operation_id: str = Field(min_length=8, max_length=80)

class ShopUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=180)
    address: str | None = Field(default=None, max_length=255)
    business_type: str | None = Field(default=None, max_length=60)

class SyncOperationIn(BaseModel):
    operation_id: str = Field(min_length=8, max_length=80)
    operation_type: str = Field(pattern="^(CREATE_CUSTOMER|CREATE_LEDGER_ENTRY)$")
    payload: dict[str, Any]

class SyncPushIn(BaseModel):
    operations: list[SyncOperationIn] = Field(default_factory=list, max_length=200)


class GoogleCredentialIn(BaseModel):
    credential: str = Field(min_length=20, max_length=12000)


class GoogleRegisterIn(GoogleCredentialIn):
    phone: str = Field(min_length=10, max_length=20)
    shop_name: str = Field(min_length=2, max_length=180)
    address: str = Field(default="", max_length=255)
    business_type: str = Field(default="grocery", max_length=60)


class FirebaseCredentialIn(BaseModel):
    id_token: str = Field(min_length=100, max_length=12000)


class FirebaseRegisterIn(FirebaseCredentialIn):
    phone: str = Field(min_length=10, max_length=20)
    shop_name: str = Field(min_length=2, max_length=180)
    address: str = Field(default="", max_length=255)
    business_type: str = Field(default="grocery", max_length=60)
