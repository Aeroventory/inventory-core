from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from db.session import Base


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    file_path = Column(String, nullable=False)

    # A snapshot has many items
    items = relationship("InventorySnapshotItem", back_populates="snapshot", cascade="all, delete-orphan")
