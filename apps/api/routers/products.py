from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.security import get_current_user, require_admin
from db.session import get_db
from schemas.product import ProductCreate, ProductUpdate, ProductResponse
from services.product_service import get_all_products, create_product, update_product, delete_product

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("/", response_model=list[ProductResponse])
def list_products(
    db: Session = Depends(get_db), _current_user=Depends(get_current_user)
):
    return get_all_products(db)


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def add_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    return create_product(db, product_in)


@router.patch("/{product_id}", response_model=ProductResponse)
def edit_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    product = update_product(db, product_id, product_in)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_product(
    product_id: int,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    deleted = delete_product(db, product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
