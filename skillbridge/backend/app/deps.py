from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import ActivityLog, Student, User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue.")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Sign in again.")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account no longer exists.")
    return user


def require_roles(*roles: str):
    def guard(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"This area is for {', '.join(roles)} accounts. You are signed in as {user.role}.",
            )
        return user

    return guard


def current_student(
    user: User = Depends(require_roles("student")), db: Session = Depends(get_db)
) -> Student:
    student = db.query(Student).filter(Student.user_id == user.id).first()
    if not student:
        raise HTTPException(404, "No student profile is attached to this account.")
    return student


def log(db: Session, user: User | None, action: str, detail: str = ""):
    db.add(
        ActivityLog(
            actor_id=user.id if user else None,
            actor_role=user.role if user else "",
            action=action,
            detail=detail[:500],
        )
    )
    db.commit()
