import uuid
import shutil
from pathlib import Path
from fastapi import UploadFile, HTTPException

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
TEMP_DIR = STORAGE_DIR / "temp"
UPLOADS_DIR = STORAGE_DIR / "uploads"


def _ensure_dirs():
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def upload_file(file: UploadFile) -> str:
    _ensure_dirs()

    ext = Path(file.filename).suffix if file.filename else ""
    temp_name = f"{uuid.uuid4()}{ext}"
    temp_path = TEMP_DIR / temp_name

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")
    finally:
        file.file.close()

    return temp_name


def save_file(temp_filename: str, folder: str = "") -> str:
    temp_path = (TEMP_DIR / temp_filename).resolve()
    if not temp_path.is_relative_to(TEMP_DIR):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not temp_path.exists():
        raise HTTPException(status_code=404, detail=f"Temp file not found: {temp_filename}")

    dest_dir = UPLOADS_DIR / folder if folder else UPLOADS_DIR
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest_path = dest_dir / temp_filename
    shutil.move(str(temp_path), str(dest_path))

    return str(dest_path.relative_to(UPLOADS_DIR))


def delete_file(relative_path: str) -> bool:
    file_path = (UPLOADS_DIR / relative_path).resolve()
    if file_path.is_relative_to(UPLOADS_DIR) and file_path.exists() and file_path.is_file():
        file_path.unlink()
        return True
    return False


def delete_temp_file(temp_filename: str) -> bool:
    file_path = (TEMP_DIR / temp_filename).resolve()
    if file_path.is_relative_to(TEMP_DIR) and file_path.exists() and file_path.is_file():
        file_path.unlink()
        return True
    return False
