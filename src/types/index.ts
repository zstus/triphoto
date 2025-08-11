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