"""backfill_legacy_snapshot_images

Revision ID: a7c9d1e2f3b4
Revises: f2b4c6d8e9a0
Create Date: 2026-05-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a7c9d1e2f3b4"
down_revision: Union[str, None] = "f2b4c6d8e9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO media_assets (
            file_path,
            original_filename,
            content_type,
            size_bytes,
            created_at
        )
        SELECT
            inventory_snapshots.file_path,
            regexp_replace(inventory_snapshots.file_path, '^.*/', ''),
            NULL,
            0,
            MIN(inventory_snapshots.created_at)
        FROM inventory_snapshots
        WHERE inventory_snapshots.file_path IS NOT NULL
            AND inventory_snapshots.file_path <> ''
            AND NOT EXISTS (
                SELECT 1
                FROM media_assets
                WHERE media_assets.file_path = inventory_snapshots.file_path
            )
        GROUP BY inventory_snapshots.file_path
        """
    )
    op.execute(
        """
        INSERT INTO snapshot_media_assets (
            snapshot_id,
            media_asset_id,
            sort_order,
            is_primary
        )
        SELECT
            inventory_snapshots.id,
            media_assets.id,
            0,
            TRUE
        FROM inventory_snapshots
        JOIN media_assets ON media_assets.file_path = inventory_snapshots.file_path
        WHERE inventory_snapshots.file_path IS NOT NULL
            AND inventory_snapshots.file_path <> ''
            AND NOT EXISTS (
                SELECT 1
                FROM snapshot_media_assets existing_links
                WHERE existing_links.snapshot_id = inventory_snapshots.id
            )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM snapshot_media_assets
        USING inventory_snapshots, media_assets
        WHERE snapshot_media_assets.snapshot_id = inventory_snapshots.id
            AND snapshot_media_assets.media_asset_id = media_assets.id
            AND inventory_snapshots.file_path = media_assets.file_path
        """
    )
    op.execute(
        """
        DELETE FROM media_assets
        WHERE EXISTS (
            SELECT 1
            FROM inventory_snapshots
            WHERE inventory_snapshots.file_path = media_assets.file_path
        )
            AND NOT EXISTS (
                SELECT 1
                FROM product_media_assets
                WHERE product_media_assets.media_asset_id = media_assets.id
            )
            AND NOT EXISTS (
                SELECT 1
                FROM snapshot_media_assets
                WHERE snapshot_media_assets.media_asset_id = media_assets.id
            )
        """
    )
