from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone

from ..database import get_db
from ..models import User
from ..services.auth_service import (
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
    record_audit,
)

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


# =========================================================
# SCHEMAS
# =========================================================
class LoginRequest(BaseModel):
    username_or_email: str
    password: str
    remember_me: bool = True


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login: Optional[datetime] = None

    class Config:
        orm_mode = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    message: str


class RoleUpdateRequest(BaseModel):
    role: str  # "triage_nurse", "charge_nurse", "admin"


# =========================================================
# ENDPOINTS
# =========================================================
@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticate user via username or email and password.
    Logs successful login or failed login attempt to the compliance audit log.
    """
    identifier = payload.username_or_email.strip().lower()
    
    # Lookup by username or email (case-insensitive)
    user = db.query(User).filter(
        (User.username.ilike(identifier)) | (User.email.ilike(identifier))
    ).first()

    if not user or not verify_password(payload.password, user.hashed_password, user.salt):
        # Record failed login attempt in audit log
        record_audit(
            db=db,
            action="FAILED_LOGIN",
            user_id=identifier,
            reason=f"Failed login attempt for user identifier '{identifier}' (invalid credentials).",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password. Please check your credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        record_audit(
            db=db,
            action="FAILED_LOGIN",
            user_id=user.username,
            reason=f"Failed login attempt for deactivated user account '{user.username}'.",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account has been disabled. Please contact your hospital administrator.",
        )

    # Update last login timestamp
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    # Generate token
    token = create_access_token(user, remember_me=payload.remember_me)

    # Record successful login event in audit log
    record_audit(
        db=db,
        action="LOGIN",
        user_id=user.username,
        reason=f"User {user.full_name} ({user.role}) logged in successfully.",
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
        "message": f"Welcome back, {user.full_name}!",
    }


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Log out the currently active user and record the logout event in the audit trail.
    """
    record_audit(
        db=db,
        action="LOGOUT",
        user_id=current_user.username,
        reason=f"User {current_user.full_name} ({current_user.role}) logged out.",
    )
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Return profile and role details of the currently authenticated user.
    """
    return current_user


@router.get("/users", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """
    List all clinical users in the system (Clinical Administrator only).
    """
    return db.query(User).order_by(User.id.asc()).all()


@router.put("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    payload: RoleUpdateRequest,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """
    Update a clinical user's access role and log the change in the audit trail (Admin only).
    """
    allowed_roles = ["triage_nurse", "charge_nurse", "admin"]
    if payload.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Allowed roles are: {', '.join(allowed_roles)}",
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    old_role = target_user.role
    target_user.role = payload.role
    db.commit()

    # Record role change event in audit log
    record_audit(
        db=db,
        action="ROLE_CHANGE",
        user_id=current_user.username,
        old_value=old_role,
        new_value=payload.role,
        reason=f"Admin {current_user.full_name} changed role for {target_user.full_name} ({target_user.username}) from {old_role} to {payload.role}.",
    )

    return target_user
