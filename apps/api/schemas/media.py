from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MediaAssetResponse(BaseModel):
    id: int
    file_path: str
    original_filename: Optional[str] = None
    content_type: Optional[str] = None
    size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    created_at: datetime
    uploaded_by_user_id: Optional[int] = None

    class Config:
        from_attributes = True


class MediaAttachmentInput(BaseModel):
    media_asset_id: int
    sort_order: Optional[int] = None
    is_primary: bool = False


class MediaAttachmentUpdate(BaseModel):
    attachments: list[MediaAttachmentInput] = Field(default_factory=list)
