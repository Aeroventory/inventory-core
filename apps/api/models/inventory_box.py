from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, true
from sqlalchemy.orm import relationship

from db.session import Base


class InventoryBox(Base):
    __tablename__ = "inventory_boxes"

    id = Column(Integer, primary_key=True, index=True)
    box_code = Column(String, nullable=False, unique=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    box_date = Column(Date, nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default=true())
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    removed_at = Column(DateTime, nullable=True)

    product = relationship("Product")
    snapshot_items = relationship("InventorySnapshotItem", back_populates="box")
