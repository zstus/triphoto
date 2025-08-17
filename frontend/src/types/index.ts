export interface Room {
  id: string;
  name: string;
  description?: string;
  creator_name: string;
  created_at: string;
  is_active: boolean;
  photo_count: number;
}

export interface Photo {
  id: string;
  room_id: string;
  filename: string;
  original_filename: string;
  uploader_name: string;
  file_path: string;
  thumbnail_path?: string;
  file_size?: number;
  mime_type?: string;
  taken_at?: string;
  uploaded_at: string;
  like_count: number;
  dislike_count: number;
  user_liked?: boolean;
  user_disliked?: boolean;
}

export interface Like {
  id: string;
  photo_id: string;
  user_name: string;
  created_at: string;
}

export interface RoomCreate {
  name: string;
  description?: string;
  creator_name: string;
}

export interface PhotoUpload {
  uploader_name: string;
}

export interface LikeCreate {
  user_name: string;
}

export interface RoomJoin {
  user_name: string;
}

export interface Dislike {
  id: string;
  photo_id: string;
  user_name: string;
  created_at: string;
}

export interface DislikeCreate {
  user_name: string;
}

export interface Participant {
  name: string;
  photo_count: number;
  first_upload_at: string;
}

// 업로드 로깅 시스템 관련 타입들
export interface UploadSession {
  id: string;
  room_id: string;
  user_name: string;
  total_files: number;
  completed_files: number;
  failed_files: number;
  started_at: string;
  completed_at?: string;
  status: 'in_progress' | 'completed' | 'partially_failed' | 'failed';
}

export interface UploadSessionCreate {
  room_id: string;
  user_name: string;
  total_files: number;
}

export interface UploadLog {
  id: string;
  session_id: string;
  room_id: string;
  original_filename: string;
  file_size?: number;
  mime_type?: string;
  uploader_name: string;
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'retrying';
  photo_id?: string;
  error_message?: string;
  retry_count: number;
  started_at: string;
  completed_at?: string;
}

export interface UploadLogCreate {
  session_id: string;
  room_id: string;
  original_filename: string;
  file_size?: number;
  mime_type?: string;
  uploader_name: string;
}

export interface UploadResult {
  session_id: string;
  total_files: number;
  successful_uploads: number;
  failed_uploads: number;
  failed_files: UploadLog[];
}

export interface RoomStatistics {
  total_photos: number;
  hidden_photos: number;
  visible_photos: number;
  total_likes: number;
  total_dislikes: number;
  participants_count: number;
}

export interface RetryRequest {
  log_ids: string[];
}