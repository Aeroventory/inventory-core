from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.product import Product
from models.production_plan import ProductionPlan
from schemas.production_plan import PlanBulkCreate, PlanCreate, PlanUpdate


PLANNING_HORIZON_DAYS = 92


def _max_plan_date() -> date:
    return date.today() + timedelta(days=PLANNING_HORIZON_DAYS)


def _validate_date_range(
    from_date: date, to_date: date, *, enforce_planning_horizon: bool = False
) -> None:
    if from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from must be before or equal to to",
        )

    if not enforce_planning_horizon:
        return

    if to_date > _max_plan_date():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Plan date cannot be more than 3 months ahead",
        )

    if (to_date - from_date).days > PLANNING_HORIZON_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Plan range cannot exceed 3 months",
        )


def _validate_plan_date(plan_date: date) -> None:
    if plan_date > _max_plan_date():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Plan date cannot be more than 3 months ahead",
        )


def _get_product_or_404(db: Session, product_id: int) -> Product:
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def _get_duplicate_plan(
    db: Session, product_id: int, plan_date: date, exclude_plan_id: int | None = None
) -> ProductionPlan | None:
    query = db.query(ProductionPlan).filter(
        ProductionPlan.product_id == product_id,
        ProductionPlan.date == plan_date,
    )
    if exclude_plan_id is not None:
        query = query.filter(ProductionPlan.id != exclude_plan_id)
    return query.first()


def _commit_or_conflict(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Production plan already exists for this product and date",
        )


def get_production_plans(
    db: Session, from_date: date, to_date: date
) -> list[ProductionPlan]:
    _validate_date_range(from_date, to_date)
    return (
        db.query(ProductionPlan)
        .filter(
            ProductionPlan.date >= from_date,
            ProductionPlan.date <= to_date,
        )
        .order_by(ProductionPlan.date, ProductionPlan.product_id, ProductionPlan.id)
        .all()
    )


def create_production_plan(
    db: Session, plan_in: PlanCreate, created_by: int | None
) -> ProductionPlan:
    _get_product_or_404(db, plan_in.product_id)
    _validate_plan_date(plan_in.date)

    if _get_duplicate_plan(db, plan_in.product_id, plan_in.date):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Production plan already exists for this product and date",
        )

    plan = ProductionPlan(
        product_id=plan_in.product_id,
        target_quantity=plan_in.target_quantity,
        date=plan_in.date,
        created_by=created_by,
    )
    db.add(plan)
    _commit_or_conflict(db)
    db.refresh(plan)
    return plan


def bulk_create_production_plans(
    db: Session, plan_in: PlanBulkCreate, created_by: int | None
) -> list[ProductionPlan]:
    _get_product_or_404(db, plan_in.product_id)
    _validate_date_range(
        plan_in.from_date, plan_in.to_date, enforce_planning_horizon=True
    )

    existing_plans = (
        db.query(ProductionPlan)
        .filter(
            ProductionPlan.product_id == plan_in.product_id,
            ProductionPlan.date >= plan_in.from_date,
            ProductionPlan.date <= plan_in.to_date,
        )
        .all()
    )
    existing_by_date = {plan.date: plan for plan in existing_plans}

    current_date = plan_in.from_date
    while current_date <= plan_in.to_date:
        existing = existing_by_date.get(current_date)
        if existing is not None:
            existing.target_quantity = plan_in.target_quantity
        else:
            db.add(
                ProductionPlan(
                    product_id=plan_in.product_id,
                    target_quantity=plan_in.target_quantity,
                    date=current_date,
                    created_by=created_by,
                )
            )
        current_date += timedelta(days=1)

    _commit_or_conflict(db)

    return (
        db.query(ProductionPlan)
        .filter(
            ProductionPlan.product_id == plan_in.product_id,
            ProductionPlan.date >= plan_in.from_date,
            ProductionPlan.date <= plan_in.to_date,
        )
        .order_by(ProductionPlan.date, ProductionPlan.id)
        .all()
    )


def update_production_plan(
    db: Session, plan_id: int, plan_in: PlanUpdate
) -> ProductionPlan | None:
    plan = db.query(ProductionPlan).filter(ProductionPlan.id == plan_id).first()
    if plan is None:
        return None

    update_data = plan_in.model_dump(exclude_unset=True)
    if not update_data:
        return plan

    if any(value is None for value in update_data.values()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Production plan fields cannot be null",
        )

    if "product_id" in update_data:
        _get_product_or_404(db, update_data["product_id"])

    if "date" in update_data:
        _validate_plan_date(update_data["date"])

    next_product_id = update_data.get("product_id", plan.product_id)
    next_date = update_data.get("date", plan.date)
    if _get_duplicate_plan(db, next_product_id, next_date, exclude_plan_id=plan.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Production plan already exists for this product and date",
        )

    for key, value in update_data.items():
        setattr(plan, key, value)

    _commit_or_conflict(db)
    db.refresh(plan)
    return plan


def delete_production_plan(db: Session, plan_id: int) -> bool:
    plan = db.query(ProductionPlan).filter(ProductionPlan.id == plan_id).first()
    if plan is None:
        return False
    db.delete(plan)
    db.commit()
    return True
