from sqlalchemy import Column, Date, Float, Integer, ForeignKey, String
from sqlalchemy.orm import relationship
from db.session import Base


class InventorySnapshotItem(Base):
    __tablename__ = "inventory_snapshot_items"

    id = Column(Integer, primary_key=True, index=True)
    box_id = Column(Integer, ForeignKey("inventory_boxes.id"), nullable=False)
    box_code = Column(String, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    snapshot_id = Column(Integer, ForeignKey("inventory_snapshots.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    box_date = Column(Date, nullable=False)
    confidence_score = Column(Float, nullable=True)

    # Relationships (like Laravel's belongsTo)
    box = relationship("InventoryBox", back_populates="snapshot_items")
    product = relationship("Product")
    snapshot = relationship("InventorySnapshot", back_populates="items")
