from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
from models.media import ProductMediaAsset
from models.product import Product
from schemas.product import ProductCreate, ProductUpdate


def _product_query(db: Session):
    return db.query(Product).options(
        joinedload(Product.media_links).joinedload(ProductMediaAsset.media_asset)
    )


def get_all_products(db: Session) -> list[Product]:
    return _product_query(db).order_by(Product.id).all()


def create_product(db: Session, product_in: ProductCreate) -> Product:
    if db.query(Product).filter(Product.sku == product_in.sku).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists")

    product = Product(**product_in.model_dump())
    db.add(product)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists")
    return _product_query(db).filter(Product.id == product.id).first()


def update_product(db: Session, product_id: int, product_in: ProductUpdate) -> Product | None:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None
    update_data = product_in.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(product, key, val)
    db.commit()
    return _product_query(db).filter(Product.id == product.id).first()


def delete_product(db: Session, product_id: int) -> bool:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return False
    db.delete(product)
    db.commit()
    return True
