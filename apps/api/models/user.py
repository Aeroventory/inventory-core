from enum import Enum

from sqlalchemy import Column, Enum as SqlEnum, Integer, String

from db.session import Base


class UserRole(str, Enum):
    admin = "admin"
    planner = "planner"
    viewer = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, unique=True, index=True)
    role = Column(
        SqlEnum(
            UserRole,
            name="user_role",
            values_callable=lambda roles: [role.value for role in roles],
        ),
        nullable=False,
        default=UserRole.viewer,
    )
    password_hash = Column(String, nullable=False)
