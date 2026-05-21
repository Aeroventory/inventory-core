from sqlalchemy import Column, Integer, String, Text
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
    raw_materials = Column(Text, nullable=True)

    media_links = relationship(
        "ProductMediaAsset",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductMediaAsset.sort_order",
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

#    snapshot_items = relationship("InventorySnapshotItem", back_populates="product")
