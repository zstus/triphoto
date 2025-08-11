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