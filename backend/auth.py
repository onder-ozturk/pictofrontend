"""
PicToFrontend — JWT authentication utilities.

Sprint 4:
  s4-b3 — JWT tabanlı kullanıcı oturum yönetimi: kayıt, giriş, token yenileme
  s4-g1 — JWT doğrulama middleware: Bearer token, expiry kontrolü, 401 yanıtı

In-memory user store (Sprint 4 scope).
Migrate to persistent SQLite in a later sprint if needed.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field

# ─── Config ───────────────────────────────────────────────────────────────────
SECRET_KEY: str = os.getenv(
    "JWT_SECRET_KEY",
    "pictofrontend-dev-secret-CHANGE-IN-PRODUCTION-use-openssl-rand-hex-32",
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

# ─── Password hashing ─────────────────────────────────────────────────────────
# pbkdf2_sha256 uses Python's built-in hashlib — no C-extension version conflicts.
# Replace with bcrypt (or argon2) when a compatible passlib/bcrypt pair is available.
_pwd_ctx = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


# ─── Token helpers ────────────────────────────────────────────────────────────

def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Return payload dict. Raises JWTError on invalid or expired token."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


# ─── In-memory user store ─────────────────────────────────────────────────────

class UserRecord(BaseModel):
    id: str
    email: str
    password_hash: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


_store_lock = Lock()
_users_by_email: dict[str, UserRecord] = {}
_users_by_id:    dict[str, UserRecord] = {}


def register_user(email: str, password: str) -> UserRecord:
    """
    Create a new user. Raises ValueError if email already taken.
    Password must be at least 8 characters (enforced at the API layer).
    """
    key = email.strip().lower()
    with _store_lock:
        if key in _users_by_email:
            raise ValueError("Email already registered.")
        uid  = str(uuid.uuid4())
        user = UserRecord(
            id=uid,
            email=key,
            password_hash=hash_password(password),
        )
        _users_by_email[key] = user
        _users_by_id[uid]    = user
    return user


def authenticate_user(email: str, password: str) -> Optional[UserRecord]:
    """Return the UserRecord if credentials are valid, else None."""
    key  = email.strip().lower()
    user = _users_by_email.get(key)
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def get_user_by_id(user_id: str) -> Optional[UserRecord]:
    return _users_by_id.get(user_id)


def get_user_by_email(email: str) -> Optional[UserRecord]:
    return _users_by_email.get(email.strip().lower())


def register_oauth_user(email: str) -> UserRecord:
    """Register or return an existing user authenticated via an OAuth provider."""
    key = email.strip().lower()
    with _store_lock:
        if key in _users_by_email:
            return _users_by_email[key]
        uid = str(uuid.uuid4())
        user = UserRecord(
            id=uid,
            email=key,
            password_hash="OAUTH_USER",
        )
        _users_by_email[key] = user
        _users_by_id[uid] = user
    return user


# ─── FastAPI Bearer dependency ─────────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> UserRecord:
    """Dependency — raises HTTP 401 if token is missing, invalid, or expired."""
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Pass Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(creds.credentials)
        uid = payload.get("sub")
        if not uid:
            raise JWTError("Missing subject claim.")
        user = get_user_by_id(uid)
        if not user:
            raise JWTError("User not found.")
        return user
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[UserRecord]:
    """Non-raising variant — returns None for unauthenticated requests."""
    if not creds:
        return None
    try:
        payload = decode_access_token(creds.credentials)
        uid = payload.get("sub")
        return get_user_by_id(uid) if uid else None
    except JWTError:
        return None
