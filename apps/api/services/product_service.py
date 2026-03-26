from sqlalchemy.orm import Session
from models.product import Product
from schemas.product import ProductCreate, ProductUpdate


def get_all_products(db: Session) -> list[Product]:
    return db.query(Product).all()


def create_product(db: Session, product_in: ProductCreate) -> Product:
    product = Product(name=product_in.name, value=product_in.value)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update_product(db: Session, product_id: int, product_in: ProductUpdate) -> Product | None:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None
    update_data = product_in.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(product, key, val)
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
