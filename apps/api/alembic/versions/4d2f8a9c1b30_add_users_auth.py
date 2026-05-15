"""add_users_auth

Revision ID: 4d2f8a9c1b30
Revises: a4ef1c2b9d77
Create Date: 2026-05-14 00:00:00.000000

"""
import os
from typing import Sequence, Union

from alembic import op
from core.config import settings
from passlib.context import CryptContext
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4d2f8a9c1b30"
down_revision: Union[str, None] = "a4ef1c2b9d77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


user_role = sa.Enum("admin", "planner", "viewer", name="user_role")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    admin_username = os.getenv("DEFAULT_ADMIN_USERNAME") or settings.DEFAULT_ADMIN_USERNAME
    admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD") or settings.DEFAULT_ADMIN_PASSWORD
    if admin_username and admin_password:
        users_table = sa.table(
            "users",
            sa.column("username", sa.String()),
            sa.column("role", user_role),
            sa.column("password_hash", sa.String()),
        )
        op.bulk_insert(
            users_table,
            [
                {
                    "username": admin_username,
                    "role": "admin",
                    "password_hash": pwd_context.hash(admin_password),
                }
            ],
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")
    user_role.drop(op.get_bind(), checkfirst=True)
