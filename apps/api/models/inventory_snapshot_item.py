from sqlalchemy import Column, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from db.session import Base


class InventorySnapshotItem(Base):
    __tablename__ = "inventory_snapshot_items"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    snapshot_id = Column(Integer, ForeignKey("inventory_snapshots.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    confidence_score = Column(Float, nullable=True)

    # Relationships (like Laravel's belongsTo)
    product = relationship("Product")
    snapshot = relationship("InventorySnapshot", back_populates="items")
