"""replace_snapshot_manual_flag_with_type

Revision ID: b6f8a2d4c9e1
Revises: a7c9d1e2f3b4
Create Date: 2026-06-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b6f8a2d4c9e1"
down_revision: Union[str, None] = "a7c9d1e2f3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SNAPSHOT_TYPE_CHECK = "snapshot_type IN ('manual', 'AI', 'drone')"


def upgrade() -> None:
    op.add_column(
        "inventory_snapshots",
        sa.Column("snapshot_type", sa.String(length=16), nullable=True),
    )
    op.execute(
        """
        UPDATE inventory_snapshots
        SET snapshot_type = CASE
            WHEN is_manual IS TRUE THEN 'manual'
            ELSE 'AI'
        END
        """
    )
    op.alter_column(
        "inventory_snapshots",
        "snapshot_type",
        existing_type=sa.String(length=16),
        nullable=False,
        server_default="manual",
    )
    op.create_check_constraint(
        "ck_inventory_snapshots_snapshot_type",
        "inventory_snapshots",
        SNAPSHOT_TYPE_CHECK,
    )
    op.drop_column("inventory_snapshots", "is_manual")


def downgrade() -> None:
    op.add_column(
        "inventory_snapshots",
        sa.Column("is_manual", sa.Boolean(), nullable=True),
    )
    op.execute(
        """
        UPDATE inventory_snapshots
        SET is_manual = CASE
            WHEN snapshot_type = 'manual' THEN TRUE
            ELSE FALSE
        END
        """
    )
    op.alter_column(
        "inventory_snapshots",
        "is_manual",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.true(),
    )
    op.drop_constraint(
        "ck_inventory_snapshots_snapshot_type",
        "inventory_snapshots",
        type_="check",
    )
    op.drop_column("inventory_snapshots", "snapshot_type")
