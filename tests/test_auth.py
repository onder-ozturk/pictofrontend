"""
Unit tests for backend/auth.py — JWT authentication and user store.

Sprint 4 — s4-b3 / s4-g1
Tests: password hashing, register_user, authenticate_user,
       create_access_token, decode_access_token, get_user_by_id,
       expired/invalid/wrong-secret tokens, email normalisation.
"""

import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest
from jose import JWTError, jwt

import auth


# ─── Fixture: in-memory store temizleme ──────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_user_store():
    """Her testten önce/sonra in-memory user store'u temizle."""
    auth._users_by_email.clear()
    auth._users_by_id.clear()
    yield
    auth._users_by_email.clear()
    auth._users_by_id.clear()


# ─── Password hashing ─────────────────────────────────────────────────────────

def test_hash_verify_roundtrip():
    h = auth.hash_password("secret123")
    assert auth.verify_password("secret123", h)


def test_verify_wrong_password():
    h = auth.hash_password("correct-pass")
    assert not auth.verify_password("wrong-pass", h)


def test_hash_is_not_plaintext():
    h = auth.hash_password("mypassword")
    assert h != "mypassword"
    assert len(h) > 20


def test_same_password_different_hashes():
    """Hashing is salted — same input produces different hashes."""
    h1 = auth.hash_password("same")
    h2 = auth.hash_password("same")
    assert h1 != h2   # different salts


# ─── register_user ───────────────────────────────────────────────────────────

def test_register_user_success():
    user = auth.register_user("Alice@Example.com", "password123")
    assert user.email == "alice@example.com"  # normalised to lowercase
    assert user.id is not None
    assert len(user.id) > 0


def test_register_user_returns_user_record():
    user = auth.register_user("test@test.com", "pass1234")
    assert isinstance(user, auth.UserRecord)


def test_register_user_duplicate_raises():
    auth.register_user("dup@test.com", "pass1234")
    with pytest.raises(ValueError, match="already registered"):
        auth.register_user("DUP@test.com", "pass5678")  # uppercase duplicate


def test_register_user_email_normalized():
    user = auth.register_user("UPPER@DOMAIN.COM", "pass1234")
    assert user.email == "upper@domain.com"


def test_register_user_stored_by_email():
    user = auth.register_user("store@test.com", "pass1234")
    assert "store@test.com" in auth._users_by_email


def test_register_user_stored_by_id():
    user = auth.register_user("byid@test.com", "pass1234")
    found = auth.get_user_by_id(user.id)
    assert found is not None
    assert found.email == user.email


def test_register_multiple_users():
    u1 = auth.register_user("user1@test.com", "pass1234")
    u2 = auth.register_user("user2@test.com", "pass5678")
    assert u1.id != u2.id
    assert u1.email != u2.email


def test_register_user_has_created_at():
    user = auth.register_user("time@test.com", "pass1234")
    assert isinstance(user.created_at, datetime)
    assert user.created_at.tzinfo is not None  # timezone-aware


# ─── authenticate_user ───────────────────────────────────────────────────────

def test_authenticate_valid_credentials():
    auth.register_user("login@test.com", "mypassword")
    user = auth.authenticate_user("login@test.com", "mypassword")
    assert user is not None
    assert user.email == "login@test.com"


def test_authenticate_wrong_password_returns_none():
    auth.register_user("wrong@test.com", "correct-pass")
    result = auth.authenticate_user("wrong@test.com", "incorrect-pass")
    assert result is None


def test_authenticate_unknown_email_returns_none():
    result = auth.authenticate_user("nobody@test.com", "anypass")
    assert result is None


def test_authenticate_email_case_insensitive():
    auth.register_user("case@test.com", "pass1234")
    user = auth.authenticate_user("CASE@TEST.COM", "pass1234")
    assert user is not None


def test_authenticate_empty_password_returns_none():
    auth.register_user("empty@test.com", "realpassword")
    result = auth.authenticate_user("empty@test.com", "")
    assert result is None


# ─── get_user_by_id ──────────────────────────────────────────────────────────

def test_get_user_by_id_existing():
    user = auth.register_user("byid2@test.com", "pass1234")
    found = auth.get_user_by_id(user.id)
    assert found is not None
    assert found.id == user.id


def test_get_user_by_id_missing():
    result = auth.get_user_by_id("nonexistent-uuid-1234")
    assert result is None


# ─── create_access_token ─────────────────────────────────────────────────────

def test_create_access_token_returns_string():
    token = auth.create_access_token("uid-1", "test@example.com")
    assert isinstance(token, str)
    assert len(token) > 20


def test_create_access_token_decodable():
    token = auth.create_access_token("uid-123", "user@example.com")
    payload = auth.decode_access_token(token)
    assert payload["sub"] == "uid-123"
    assert payload["email"] == "user@example.com"


def test_access_token_has_expiry():
    token = auth.create_access_token("uid-x", "exp@test.com")
    payload = auth.decode_access_token(token)
    assert "exp" in payload


def test_access_token_not_yet_expired():
    token = auth.create_access_token("uid-y", "valid@test.com")
    payload = auth.decode_access_token(token)
    exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    assert exp_dt > datetime.now(timezone.utc)


# ─── decode_access_token ─────────────────────────────────────────────────────

def test_decode_invalid_token_raises():
    with pytest.raises(JWTError):
        auth.decode_access_token("not.a.valid.token")


def test_decode_empty_token_raises():
    with pytest.raises(JWTError):
        auth.decode_access_token("")


def test_decode_expired_token_raises():
    expired_payload = {
        "sub": "uid-expired",
        "email": "exp@test.com",
        "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
    }
    token = jwt.encode(expired_payload, auth.SECRET_KEY, algorithm=auth.ALGORITHM)
    with pytest.raises(JWTError):
        auth.decode_access_token(token)


def test_decode_wrong_secret_raises():
    payload = {
        "sub": "uid-ws",
        "email": "ws@test.com",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = jwt.encode(payload, "completely-wrong-secret", algorithm=auth.ALGORITHM)
    with pytest.raises(JWTError):
        auth.decode_access_token(token)


def test_decode_tampered_token_raises():
    token = auth.create_access_token("uid-t", "t@t.com")
    # Tamper: corrupt the signature section (third segment after splitting by '.')
    parts = token.split(".")
    parts[2] = parts[2][:4] + "XXXXXXXXXXXXXXXXXXXXX"
    tampered = ".".join(parts)
    with pytest.raises(JWTError):
        auth.decode_access_token(tampered)
