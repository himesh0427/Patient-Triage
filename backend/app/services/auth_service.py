import hashlib
import hmac
import base64
import json
import secrets
import time
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Header, status, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, AuditLog

# Secret key for HMAC token signing (in production, loaded from environment)
AUTH_SECRET_KEY = "patient-triage-secure-hmac-token-secret-key-2026"
TOKEN_EXPIRY_SECONDS = 86400 * 7  # 7 days (remember me support)
SESSION_EXPIRY_SECONDS = 86400 * 1  # 1 day standard session


# =========================================================
# PASSWORD HASHING (PBKDF2-HMAC-SHA256)
# =========================================================
def generate_salt() -> str:
    """Generate a secure random 32-character hex salt."""
    return secrets.token_hex(16)


def hash_password(password: str, salt: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with 100,000 iterations."""
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return key.hex()


def verify_password(plain_password: str, hashed_password: str, salt: str) -> bool:
    """Verify that a plaintext password matches the stored hash."""
    computed_hash = hash_password(plain_password, salt)
    return hmac.compare_digest(computed_hash, hashed_password)


# =========================================================
# TOKEN CREATION & VERIFICATION (Signed JSON Tokens)
# =========================================================
def create_access_token(user: User, remember_me: bool = True) -> str:
    """Create a tamper-proof HMAC-SHA256 signed bearer token."""
    duration = TOKEN_EXPIRY_SECONDS if remember_me else SESSION_EXPIRY_SECONDS
    exp = int(time.time()) + duration

    payload = {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "full_name": user.full_name,
        "exp": exp,
    }

    payload_json = json.dumps(payload, separators=(',', ':'))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode('utf-8')).decode('utf-8').rstrip('=')

    signature = hmac.new(
        AUTH_SECRET_KEY.encode('utf-8'),
        payload_b64.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return f"{payload_b64}.{signature}"


def decode_access_token(token: str) -> Optional[dict]:
    """Verify signature and return token payload if valid and unexpired."""
    try:
        parts = token.split('.')
        if len(parts) != 2:
            return None

        payload_b64, signature = parts

        # Verify signature
        expected_sig = hmac.new(
            AUTH_SECRET_KEY.encode('utf-8'),
            payload_b64.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, signature):
            return None

        # Pad base64 if needed
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += '=' * padding

        payload_bytes = base64.urlsafe_b64decode(payload_b64.encode('utf-8'))
        payload = json.loads(payload_bytes.decode('utf-8'))

        # Check expiration
        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception:
        return None


# =========================================================
# AUDIT LOGGING HELPER
# =========================================================
def record_audit(
    db: Session,
    action: str,
    user_id: str,
    reason: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    visit_id: Optional[int] = None
):
    """Safely log an authentication, authorization, or administrative event."""
    try:
        log_entry = AuditLog(
            visit_id=visit_id,
            action=action,
            user_id=user_id,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[AUTH AUDIT ERROR] Failed to record audit log for {action}: {e}")


# =========================================================
# SEED DEFAULT DEMO USERS
# =========================================================
DEFAULT_DEMO_USERS = [
    {
        "username": "nurse",
        "email": "nurse@hospital.org",
        "password": "nurse123",
        "full_name": "Sarah Jenkins, RN",
        "role": "nurse",
    },
    {
        "username": "admin",
        "email": "admin@hospital.org",
        "password": "admin123",
        "full_name": "Dr. Eleanor Davis, MD",
        "role": "admin",
    },
]


def seed_demo_users(db: Session):
    """Seed the demo accounts (Nurse and Administrator) and ensure proper role settings."""
    for demo in DEFAULT_DEMO_USERS:
        existing = db.query(User).filter(
            (User.username == demo["username"]) | (User.email == demo["email"])
        ).first()

        if not existing:
            salt = generate_salt()
            pwd_hash = hash_password(demo["password"], salt)
            new_user = User(
                username=demo["username"],
                email=demo["email"],
                hashed_password=pwd_hash,
                salt=salt,
                full_name=demo["full_name"],
                role=demo["role"],
                is_active=True,
            )
            db.add(new_user)
            db.commit()
            print(f"[AUTH SEED] Created demo user: {demo['username']} ({demo['role']})")
        else:
            if existing.role != demo["role"]:
                existing.role = demo["role"]
                db.commit()


# =========================================================
# FASTAPI DEPENDENCIES: CURRENT USER & RBAC
# =========================================================
def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Extract, decode, and validate the Bearer token from the Authorization header."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided or token is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or "user_id" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or tampered authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == payload["user_id"], User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists or has been deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Attach to request state for audit logs
    request.state.current_user = user
    return user


def get_optional_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Optional user dependency for endpoints accessible with or without auth."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization[7:].strip()
        payload = decode_access_token(token)
        if payload and "user_id" in payload:
            user = db.query(User).filter(User.id == payload["user_id"], User.is_active == True).first()
            if user:
                request.state.current_user = user
                return user
    except Exception:
        pass
    return None


def require_role(allowed_roles: List[str]):
    """
    Factory dependency ensuring the authenticated user has one of the allowed roles.
    If unauthorized, logs ACCESS_DENIED to AuditLog and raises 403 Forbidden.
    """
    def role_checker(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Admin has superset permissions for everything
        if current_user.role == "admin":
            return current_user

        effective_roles = set(allowed_roles)
        if "nurse" in effective_roles or "charge_nurse" in effective_roles or "triage_nurse" in effective_roles:
            effective_roles.update(["nurse", "triage_nurse", "charge_nurse"])

        if current_user.role not in effective_roles:
            # Record unauthorized attempt in Audit Trail
            record_audit(
                db=db,
                action="ACCESS_DENIED",
                user_id=current_user.username,
                reason=(
                    f"Restricted access attempt to {request.url.path}. "
                    f"Required roles: {allowed_roles}, User role: {current_user.role}"
                ),
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "ACCESS_DENIED",
                    "message": "Access restricted. You do not have permission to access this resource or perform this action.",
                    "required_roles": allowed_roles,
                    "user_role": current_user.role,
                }
            )
        return current_user

    return role_checker
