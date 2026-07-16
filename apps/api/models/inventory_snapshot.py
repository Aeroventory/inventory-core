from datetime import datetime
from sqlalchemy import CheckConstraint, Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from db.session import Base


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"
    __table_args__ = (
        CheckConstraint(
            "snapshot_type IN ('manual', 'AI', 'drone')",
            name="ck_inventory_snapshots_snapshot_type",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    snapshot_type = Column(String, nullable=False, default="manual", server_default="manual")
    file_path = Column(String, nullable=True)

    # A snapshot has many items
    items = relationship("InventorySnapshotItem", back_populates="snapshot", cascade="all, delete-orphan")
    media_links = relationship(
        "SnapshotMediaAsset",
        back_populates="snapshot",
        cascade="all, delete-orphan",
        order_by="SnapshotMediaAsset.sort_order",
    )

    @property
    def images(self):
        return [link.media_asset for link in self.media_links]

    @property
    def primary_image(self):
        primary_link = next((link for link in self.media_links if link.is_primary), None)
        if primary_link:
            return primary_link.media_asset
        return self.media_links[0].media_asset if self.media_links else None
