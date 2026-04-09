"""
JWT + bcrypt auth helpers.
Tokens live in httpOnly cookies, 24h expiry.
"""
import os
from datetime import datetime, timedelta, timezone

from fastapi import Cookie, Header, HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Passwords ───────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


# ── JWT ─────────────────────────────────────────────────────

def create_token(
    user_id: int,
    is_admin: bool,
    group_id: int | None = None,
    group_role: str | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload: dict = {"sub": str(user_id), "admin": is_admin, "exp": expire}
    if group_id is not None:
        payload["gid"] = group_id
        payload["grl"] = group_role
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


# ── FastAPI dependencies ─────────────────────────────────────

def get_current_user(
    cookie_token: str | None = Cookie(default=None, alias="access_token"),
    authorization: str | None = Header(default=None),
) -> dict:
    """Dependency — accepts token from httpOnly cookie or Authorization: Bearer header."""
    token = cookie_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = _decode_token(token)
    return {
        "user_id":    int(payload["sub"]),
        "is_admin":   payload.get("admin", False),
        "group_id":   payload.get("gid"),    # None if not yet in a group
        "group_role": payload.get("grl"),    # None if not yet in a group
    }


def get_admin_user(current: dict = None) -> dict:
    """Dependency — same as get_current_user but requires is_admin=True."""
    # called via Depends(get_current_user) chained
    if not current.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return current
