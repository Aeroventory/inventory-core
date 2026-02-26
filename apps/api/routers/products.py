from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.product import ProductCreate, ProductResponse
from services.product_service import get_all_products, create_product, delete_product

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("/", response_model=list[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    return get_all_products(db)


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def add_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    return create_product(db, product_in)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_product(product_id: int, db: Session = Depends(get_db)):
    deleted = delete_product(db, product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
