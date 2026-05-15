from sqlalchemy.orm import Session

from core.security import get_password_hash, verify_password
from models.user import User
from schemas.user import UserCreate


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_user_count(db: Session) -> int:
    return db.query(User).count()


def create_user(db: Session, user_in: UserCreate) -> User:
    user = User(
        username=user_in.username,
        role=user_in.role,
        password_hash=get_password_hash(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = get_user_by_username(db, username)
    if not user or not verify_password(password, user.password_hash):
        return None
    return user
