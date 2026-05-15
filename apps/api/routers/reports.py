from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.security import get_current_user
from db.session import get_db
from schemas.report import DailyDeltaResponse, StockSummaryResponse
from services.comparison_service import get_daily_delta, get_stock_summary


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
