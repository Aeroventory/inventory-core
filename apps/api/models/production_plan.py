from sqlalchemy import Column, Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from db.session import Base


class ProductionPlan(Base):
    __tablename__ = "production_plans"
    __table_args__ = (
        UniqueConstraint("product_id", "date", name="uq_production_plans_product_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    target_quantity = Column(Integer, nullable=False)
    date = Column(Date, nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    product = relationship("Product")
    creator = relationship("User")
