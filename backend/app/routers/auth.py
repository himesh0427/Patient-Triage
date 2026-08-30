from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone

from ..database import get_db
from ..models import User
from ..services.auth_service import (
    generate_salt,
    hash_password,
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


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: Optional[str] = "nurse"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True
        orm_mode = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    message: str

    class Config:
        from_attributes = True
        orm_mode = True


class RoleUpdateRequest(BaseModel):
    role: str  # "nurse", "admin"


# =========================================================
# ENDPOINTS
# =========================================================
@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """
    Register a new clinical staff member (e.g. Nurse or Administrator).
    Hashes password, saves user in DB, and returns access token for immediate session.
    """
    username = payload.username.strip().lower()
    email = payload.email.strip().lower()
    full_name = payload.full_name.strip()
    role = payload.role.strip().lower() if payload.role else "nurse"

    if not username or not email or not payload.password or not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name, username, email, and password are all required."
        )

    if role not in ["nurse", "admin"]:
        role = "nurse"

    existing_user = db.query(User).filter(
        (User.username.ilike(username)) | (User.email.ilike(email))
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A staff account with this username or email already exists."
        )

    salt = generate_salt()
    pwd_hash = hash_password(payload.password, salt)
    new_user = User(
        username=username,
        email=email,
        hashed_password=pwd_hash,
        salt=salt,
        full_name=full_name,
        role=role,
        is_active=True,
        last_login=datetime.now(timezone.utc),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(new_user, remember_me=True)

    record_audit(
        db=db,
        action="USER_REGISTERED",
        user_id=new_user.username,
        new_value=new_user.role,
        reason=f"New clinical staff registered: {new_user.full_name} ({new_user.role}).",
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user,
        "message": f"Staff account created successfully for {new_user.full_name}.",
    }


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
    allowed_roles = ["nurse", "admin"]
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
