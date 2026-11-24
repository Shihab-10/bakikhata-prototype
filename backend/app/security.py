from __future__ import annotations

import os, hmac, hashlib, base64, secrets
from datetime import datetime, timedelta, timezone
import jwt

JWT_SECRET = os.getenv("JWT_SECRET", "DEV-ONLY-CHANGE-ME-BakiKhata-Prototype-Secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    iterations = 310_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "pbkdf2_sha256${}${}${}".format(
        iterations,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    )

def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, iterations, salt_b64, digest_b64 = encoded.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
        expected = base64.urlsafe_b64decode(digest_b64.encode("ascii"))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False

def create_access_token(user_id: str, shop_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "shop_id": shop_id,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

def normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if digits.startswith("880") and len(digits) == 13:
        digits = "0" + digits[3:]
    return digits


class GoogleAuthNotConfigured(Exception):
    pass


class InvalidGoogleCredential(Exception):
    pass


def verify_google_id_token(credential: str) -> dict:
    """Verify a Google Identity Services ID token against our Web Client ID."""
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise GoogleAuthNotConfigured("Google Client ID is not configured")
    if not credential or len(credential) > 12000:
        raise InvalidGoogleCredential("Invalid Google credential")
    try:
        # Imported lazily so the rest of the app and demo login work before
        # the optional Google dependency/configuration is enabled.
        from google.auth.transport.requests import Request
        from google.oauth2 import id_token
        payload = id_token.verify_oauth2_token(credential, Request(), audience=client_id)
        email = str(payload.get("email") or "").strip().lower()
        email_verified = payload.get("email_verified") is True or str(payload.get("email_verified", "")).lower() == "true"
        subject = str(payload.get("sub") or "").strip()
        if not subject or not email or not email_verified:
            raise InvalidGoogleCredential("Google account email is not verified")
        return {
            "sub": subject,
            "email": email,
            "email_verified": True,
            "name": str(payload.get("name") or email.split("@", 1)[0]).strip()[:160],
            "picture": str(payload.get("picture") or "").strip()[:1000],
        }
    except InvalidGoogleCredential:
        raise
    except Exception as exc:
        raise InvalidGoogleCredential("Google token verification failed") from exc


class FirebaseAuthNotConfigured(Exception):
    pass


class InvalidFirebaseToken(Exception):
    pass


_firebase_jwks_clients = {}


def verify_firebase_id_token(id_token: str) -> dict:
    """Verify a Firebase Auth ID token for this project's Google sign-in provider.

    Uses Google's rotating Secure Token public JWKs; no Firebase service-account
    private key is stored in the local prototype. PyJWT validates RS256 signature,
    issuer, audience and time claims.
    """
    project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
    if not project_id:
        raise FirebaseAuthNotConfigured("Firebase project is not configured")
    if not id_token or len(id_token) > 12000:
        raise InvalidFirebaseToken("Invalid Firebase ID token")

    try:
        from jwt import PyJWKClient

        jwks_url = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
        client = _firebase_jwks_clients.get(project_id)
        if client is None:
            client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600, timeout=8)
            _firebase_jwks_clients[project_id] = client

        header = jwt.get_unverified_header(id_token)
        if header.get("alg") != "RS256" or not header.get("kid"):
            raise InvalidFirebaseToken("Unsupported Firebase token signature")
        signing_key = client.get_signing_key_from_jwt(id_token)
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
            leeway=60,
            options={"require": ["exp", "iat", "auth_time", "sub", "aud", "iss"]},
        )

        uid = str(payload.get("sub") or "").strip()
        auth_time = int(payload.get("auth_time") or 0)
        if not uid or len(uid) > 128 or auth_time <= 0:
            raise InvalidFirebaseToken("Firebase token is missing required identity claims")
        if auth_time > int(datetime.now(timezone.utc).timestamp()) + 60:
            raise InvalidFirebaseToken("Firebase authentication time is invalid")

        firebase_claims = payload.get("firebase") or {}
        if firebase_claims.get("sign_in_provider") != "google.com":
            raise InvalidFirebaseToken("This sign-in provider is not enabled for this endpoint")

        email = str(payload.get("email") or "").strip().lower()
        verified = payload.get("email_verified") is True
        if not email or not verified:
            raise InvalidFirebaseToken("A verified Google email is required")

        return {
            "uid": uid,
            "email": email,
            "email_verified": True,
            "name": str(payload.get("name") or email.split("@", 1)[0]).strip()[:160],
            "picture": str(payload.get("picture") or "").strip()[:1000],
        }
    except InvalidFirebaseToken:
        raise
    except Exception as exc:
        raise InvalidFirebaseToken("Firebase ID token verification failed") from exc
