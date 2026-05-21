from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    false,
)
from sqlalchemy.orm import relationship

from db.session import Base


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, nullable=False, unique=True)
    original_filename = Column(String, nullable=True)
    content_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=False, default=0)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    uploaded_by = relationship("User")
    product_links = relationship(
        "ProductMediaAsset",
        back_populates="media_asset",
        cascade="all, delete-orphan",
    )
    snapshot_links = relationship(
        "SnapshotMediaAsset",
        back_populates="media_asset",
        cascade="all, delete-orphan",
    )


class ProductMediaAsset(Base):
    __tablename__ = "product_media_assets"
    __table_args__ = (
        UniqueConstraint(
            "product_id",
            "media_asset_id",
            name="uq_product_media_assets_product_media",
        ),
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        primary_key=True,
    )
    media_asset_id = Column(
        Integer,
        ForeignKey("media_assets.id", ondelete="CASCADE"),
        primary_key=True,
    )
    sort_order = Column(Integer, nullable=False, default=0)
    is_primary = Column(Boolean, nullable=False, default=False, server_default=false())

    product = relationship("Product", back_populates="media_links")
    media_asset = relationship("MediaAsset", back_populates="product_links")


class SnapshotMediaAsset(Base):
    __tablename__ = "snapshot_media_assets"
    __table_args__ = (
        UniqueConstraint(
            "snapshot_id",
            "media_asset_id",
            name="uq_snapshot_media_assets_snapshot_media",
        ),
    )

    snapshot_id = Column(
        Integer,
        ForeignKey("inventory_snapshots.id", ondelete="CASCADE"),
        primary_key=True,
    )
    media_asset_id = Column(
        Integer,
        ForeignKey("media_assets.id", ondelete="CASCADE"),
        primary_key=True,
    )
    sort_order = Column(Integer, nullable=False, default=0)
    is_primary = Column(Boolean, nullable=False, default=False, server_default=false())

    snapshot = relationship("InventorySnapshot", back_populates="media_links")
    media_asset = relationship("MediaAsset", back_populates="snapshot_links")
