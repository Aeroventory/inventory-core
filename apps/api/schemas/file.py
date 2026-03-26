from pydantic import BaseModel


class FileUploadResponse(BaseModel):
    temp_filename: str


class FileSaveResponse(BaseModel):
    file_path: str
