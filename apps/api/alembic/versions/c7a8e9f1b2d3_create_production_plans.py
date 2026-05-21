"""create_production_plans

Revision ID: c7a8e9f1b2d3
Revises: 4d2f8a9c1b30
Create Date: 2026-05-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c7a8e9f1b2d3"
down_revision: Union[str, None] = "4d2f8a9c1b30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "production_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("target_quantity", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "product_id", "date", name="uq_production_plans_product_date"
        ),
    )
    op.create_index(op.f("ix_production_plans_id"), "production_plans", ["id"])
    op.create_index(op.f("ix_production_plans_date"), "production_plans", ["date"])


def downgrade() -> None:
    op.drop_index(op.f("ix_production_plans_date"), table_name="production_plans")
    op.drop_index(op.f("ix_production_plans_id"), table_name="production_plans")
    op.drop_table("production_plans")
