from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.security import get_current_user, require_planner_or_admin
from db.session import get_db
from models.user import User
from schemas.production_plan import (
    PlanBulkCreate,
    PlanCreate,
    PlanResponse,
    PlanUpdate,
)
from services.production_plan_service import (
    bulk_create_production_plans,
    create_production_plan,
    delete_production_plan,
    get_production_plans,
    update_production_plan,
)

router = APIRouter(prefix="/production-plans", tags=["Production Plans"])


@router.get("", response_model=list[PlanResponse])
def list_production_plans(
    from_date: Date = Query(..., alias="from"),
    to_date: Date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    return get_production_plans(db, from_date, to_date)


@router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
def add_production_plan(
    plan_in: PlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_planner_or_admin),
):
    return create_production_plan(db, plan_in, current_user.id)


@router.post("/bulk", response_model=list[PlanResponse], status_code=status.HTTP_201_CREATED)
def add_production_plans_bulk(
    plan_in: PlanBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_planner_or_admin),
):
    return bulk_create_production_plans(db, plan_in, current_user.id)


@router.patch("/{plan_id}", response_model=PlanResponse)
def edit_production_plan(
    plan_id: int,
    plan_in: PlanUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_planner_or_admin),
):
    plan = update_production_plan(db, plan_id, plan_in)
    if plan is None:
        raise HTTPException(status_code=404, detail="Production plan not found")
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_production_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_planner_or_admin),
):
    deleted = delete_production_plan(db, plan_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Production plan not found")
