from sqlalchemy.orm import Session
from models.product import Product
from schemas.product import ProductCreate


def get_all_products(db: Session) -> list[Product]:
    return db.query(Product).all()


def create_product(db: Session, product_in: ProductCreate) -> Product:
    product = Product(name=product_in.name)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: int) -> bool:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return False
    db.delete(product)
    db.commit()
    return True
