import api from "./axios-config";

export const uploadFile = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<{ temp_filename: string }>("/files/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const saveFile = (tempFilename: string, folder: string = "") => {
  return api.post<{ file_path: string }>("/files/save", null, {
    params: { temp_filename: tempFilename, folder },
  });
};
