from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.security import get_current_user
from db.session import get_db
from schemas.report import DailyDeltaResponse, PlanVsActualResponse, StockSummaryResponse
from services.comparison_service import (
    get_daily_delta,
    get_plan_vs_actual,
    get_stock_summary,
)


router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/daily-delta", response_model=DailyDeltaResponse)
def daily_delta(
    date: Date,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    report = get_daily_delta(db, date)
    if report is None:
        raise HTTPException(status_code=404, detail="No snapshot found for requested date")
    return report


@router.get("/stock-summary", response_model=StockSummaryResponse)
def stock_summary(
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    report = get_stock_summary(db)
    if report is None:
        raise HTTPException(status_code=404, detail="No snapshots found")
    return report


@router.get("/plan-vs-actual", response_model=PlanVsActualResponse)
def plan_vs_actual(
    from_date: Date = Query(..., alias="from"),
    to_date: Date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    if from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from must be before or equal to to",
        )
    return get_plan_vs_actual(db, from_date, to_date)
