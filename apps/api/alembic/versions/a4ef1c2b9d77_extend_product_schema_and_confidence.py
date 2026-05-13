"""extend_product_schema_and_confidence

Revision ID: a4ef1c2b9d77
Revises: 79b4056d6ad4
Create Date: 2026-05-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a4ef1c2b9d77"
down_revision: Union[str, None] = "79b4056d6ad4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("sku", sa.String(), nullable=True))
    op.add_column("products", sa.Column("qr_code_pattern", sa.String(), nullable=True))
    op.add_column("products", sa.Column("location_site", sa.String(), nullable=True))
    op.add_column("products", sa.Column("location_aisle", sa.String(), nullable=True))
    op.add_column("products", sa.Column("location_rack", sa.String(), nullable=True))
    op.add_column(
        "inventory_snapshot_items",
        sa.Column("confidence_score", sa.Float(), nullable=True),
    )

    op.execute("UPDATE products SET sku = 'LEGACY-' || id::text WHERE sku IS NULL")
    op.alter_column("products", "sku", existing_type=sa.String(), nullable=False)
    op.create_index(op.f("ix_products_sku"), "products", ["sku"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_products_sku"), table_name="products")
    op.drop_column("inventory_snapshot_items", "confidence_score")
    op.drop_column("products", "location_rack")
    op.drop_column("products", "location_aisle")
    op.drop_column("products", "location_site")
    op.drop_column("products", "qr_code_pattern")
    op.drop_column("products", "sku")
