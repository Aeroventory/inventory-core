from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from db.session import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    value = Column(Integer, nullable=False)
    sku = Column(String, nullable=False, unique=True, index=True)
    qr_code_pattern = Column(String, nullable=True)
    location_site = Column(String, nullable=True)
    location_aisle = Column(String, nullable=True)
    location_rack = Column(String, nullable=True)

#    snapshot_items = relationship("InventorySnapshotItem", back_populates="product")
