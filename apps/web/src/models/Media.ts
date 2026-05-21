export interface MediaAsset {
  id: number;
  file_path: string;
  original_filename?: string | null;
  content_type?: string | null;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  created_at: string;
  uploaded_by_user_id?: number | null;
}
