from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status

from core.security import require_admin
from schemas.file import FileUploadResponse, FileSaveResponse
from services.file_service import upload_file, save_file, delete_file, delete_temp_file

router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
def upload(file: UploadFile = File(...), _admin_user=Depends(require_admin)):
    temp_filename = upload_file(file)
    return {"temp_filename": temp_filename}


@router.post("/save", response_model=FileSaveResponse)
def save(temp_filename: str, folder: str = "", _admin_user=Depends(require_admin)):
    file_path = save_file(temp_filename, folder)
    return {"file_path": file_path}


@router.delete("/temp/{temp_filename}", status_code=status.HTTP_204_NO_CONTENT)
def remove_temp(temp_filename: str, _admin_user=Depends(require_admin)):
    deleted = delete_temp_file(temp_filename)
    if not deleted:
        raise HTTPException(status_code=404, detail="Temp file not found")


@router.delete("/{file_path:path}", status_code=status.HTTP_204_NO_CONTENT)
def remove(file_path: str, _admin_user=Depends(require_admin)):
    deleted = delete_file(file_path)
    if not deleted:
        raise HTTPException(status_code=404, detail="File not found")
