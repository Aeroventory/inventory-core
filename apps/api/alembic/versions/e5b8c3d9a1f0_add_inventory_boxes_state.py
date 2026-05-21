"""add_inventory_boxes_state

Revision ID: e5b8c3d9a1f0
Revises: d1f4a7b9c2e0
Create Date: 2026-05-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5b8c3d9a1f0"
down_revision: Union[str, None] = "d1f4a7b9c2e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DELETE FROM inventory_snapshot_items")
    op.execute("DELETE FROM inventory_snapshots")

    op.create_table(
        "inventory_boxes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("box_code", sa.String(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("box_date", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("removed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_inventory_boxes_id"), "inventory_boxes", ["id"])
    op.create_index(
        op.f("ix_inventory_boxes_box_code"),
        "inventory_boxes",
        ["box_code"],
        unique=True,
    )
    op.create_index(
        op.f("ix_inventory_boxes_box_date"), "inventory_boxes", ["box_date"]
    )

    op.alter_column(
        "inventory_snapshots",
        "file_path",
        existing_type=sa.String(),
        nullable=True,
    )
    op.add_column(
        "inventory_snapshot_items", sa.Column("box_id", sa.Integer(), nullable=False)
    )
    op.add_column(
        "inventory_snapshot_items", sa.Column("box_code", sa.String(), nullable=False)
    )
    op.add_column(
        "inventory_snapshot_items", sa.Column("box_date", sa.Date(), nullable=False)
    )
    op.create_foreign_key(
        "fk_inventory_snapshot_items_box_id_inventory_boxes",
        "inventory_snapshot_items",
        "inventory_boxes",
        ["box_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_inventory_snapshot_items_box_id_inventory_boxes",
        "inventory_snapshot_items",
        type_="foreignkey",
    )
    op.drop_column("inventory_snapshot_items", "box_date")
    op.drop_column("inventory_snapshot_items", "box_code")
    op.drop_column("inventory_snapshot_items", "box_id")
    op.alter_column(
        "inventory_snapshots",
        "file_path",
        existing_type=sa.String(),
        nullable=False,
    )
    op.drop_index(op.f("ix_inventory_boxes_box_date"), table_name="inventory_boxes")
    op.drop_index(op.f("ix_inventory_boxes_box_code"), table_name="inventory_boxes")
    op.drop_index(op.f("ix_inventory_boxes_id"), table_name="inventory_boxes")
    op.drop_table("inventory_boxes")
