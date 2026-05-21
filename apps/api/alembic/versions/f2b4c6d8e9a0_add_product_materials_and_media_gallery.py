"""add_product_materials_and_media_gallery

Revision ID: f2b4c6d8e9a0
Revises: e5b8c3d9a1f0
Create Date: 2026-05-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2b4c6d8e9a0"
down_revision: Union[str, None] = "e5b8c3d9a1f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("raw_materials", sa.Text(), nullable=True))
    op.create_table(
        "media_assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=True),
        sa.Column("content_type", sa.String(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("uploaded_by_user_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("file_path"),
    )
    op.create_index(op.f("ix_media_assets_id"), "media_assets", ["id"])
    op.create_table(
        "product_media_assets",
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("media_asset_id", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(
            ["media_asset_id"], ["media_assets.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("product_id", "media_asset_id"),
        sa.UniqueConstraint(
            "product_id",
            "media_asset_id",
            name="uq_product_media_assets_product_media",
        ),
    )
    op.create_table(
        "snapshot_media_assets",
        sa.Column("snapshot_id", sa.Integer(), nullable=False),
        sa.Column("media_asset_id", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(
            ["media_asset_id"], ["media_assets.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_id"], ["inventory_snapshots.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("snapshot_id", "media_asset_id"),
        sa.UniqueConstraint(
            "snapshot_id",
            "media_asset_id",
            name="uq_snapshot_media_assets_snapshot_media",
        ),
    )


def downgrade() -> None:
    op.drop_table("snapshot_media_assets")
    op.drop_table("product_media_assets")
    op.drop_index(op.f("ix_media_assets_id"), table_name="media_assets")
    op.drop_table("media_assets")
    op.drop_column("products", "raw_materials")
