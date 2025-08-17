from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class RoomCreate(BaseModel):
    name: str
    description: Optional[str] = None
    creator_name: str

class RoomResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    creator_name: str
    created_at: datetime
    is_active: bool
    photo_count: int = 0
    
    class Config:
        from_attributes = True

class PhotoUpload(BaseModel):
    uploader_name: str

class PhotoResponse(BaseModel):
    id: str
    room_id: str
    filename: str
    original_filename: str
    uploader_name: str
    file_path: str
    thumbnail_path: Optional[str]
    file_size: Optional[int]
    mime_type: Optional[str]
    taken_at: Optional[datetime]
    uploaded_at: datetime
    like_count: int = 0
    dislike_count: int = 0
    user_liked: Optional[bool] = False
    user_disliked: Optional[bool] = False
    
    class Config:
        from_attributes = True

class LikeCreate(BaseModel):
    user_name: str

class LikeResponse(BaseModel):
    id: str
    photo_id: str
    user_name: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class DislikeCreate(BaseModel):
    user_name: str

class DislikeResponse(BaseModel):
    id: str
    photo_id: str
    user_name: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class RoomJoin(BaseModel):
    user_name: str

# 업로드 세션 관련 스키마
class UploadSessionCreate(BaseModel):
    room_id: str
    user_name: str
    total_files: int

class UploadSessionResponse(BaseModel):
    id: str
    room_id: str
    user_name: str
    total_files: int
    completed_files: int
    failed_files: int
    started_at: datetime
    completed_at: Optional[datetime]
    status: str
    
    class Config:
        from_attributes = True

class UploadSessionUpdate(BaseModel):
    completed_files: Optional[int] = None
    failed_files: Optional[int] = None
    status: Optional[str] = None
    completed_at: Optional[datetime] = None

# 업로드 로그 관련 스키마
class UploadLogCreate(BaseModel):
    session_id: str
    room_id: str
    original_filename: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    uploader_name: str

class UploadLogResponse(BaseModel):
    id: str
    session_id: str
    room_id: str
    original_filename: str
    file_size: Optional[int]
    mime_type: Optional[str]
    uploader_name: str
    status: str
    photo_id: Optional[str]
    error_message: Optional[str]
    retry_count: int
    started_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class UploadLogUpdate(BaseModel):
    status: Optional[str] = None
    photo_id: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: Optional[int] = None
    completed_at: Optional[datetime] = None

# 방 통계 관련 스키마
class RoomStatistics(BaseModel):
    total_photos: int
    hidden_photos: int  # 싫어요가 많은 사진
    visible_photos: int
    total_likes: int
    total_dislikes: int
    participants_count: int

# 업로드 결과 요약 스키마
class UploadResult(BaseModel):
    session_id: str
    total_files: int
    successful_uploads: int
    failed_uploads: int
    failed_files: List[UploadLogResponse]
    
class RetryRequest(BaseModel):
    log_ids: List[str]