"""add_snapshot_manual_source

Revision ID: d1f4a7b9c2e0
Revises: c7a8e9f1b2d3
Create Date: 2026-05-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d1f4a7b9c2e0"
down_revision: Union[str, None] = "c7a8e9f1b2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inventory_snapshots",
        sa.Column(
            "is_manual",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.execute("UPDATE inventory_snapshots SET is_manual = TRUE WHERE is_manual IS NULL")


def downgrade() -> None:
    op.drop_column("inventory_snapshots", "is_manual")
