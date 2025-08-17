from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database.database import Base
import uuid

class Room(Base):
    __tablename__ = "rooms"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text)
    creator_name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    photos = relationship("Photo", back_populates="room", cascade="all, delete-orphan")

class Photo(Base):
    __tablename__ = "photos"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    uploader_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    thumbnail_path = Column(String)
    file_size = Column(Integer)
    mime_type = Column(String)
    file_hash = Column(String, nullable=False)
    taken_at = Column(DateTime)
    uploaded_at = Column(DateTime, server_default=func.now())
    
    room = relationship("Room", back_populates="photos")
    likes = relationship("Like", back_populates="photo", cascade="all, delete-orphan")
    dislikes = relationship("Dislike", back_populates="photo", cascade="all, delete-orphan")

class Like(Base):
    __tablename__ = "likes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    photo_id = Column(String, ForeignKey("photos.id"), nullable=False)
    user_name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    photo = relationship("Photo", back_populates="likes")

class Dislike(Base):
    __tablename__ = "dislikes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    photo_id = Column(String, ForeignKey("photos.id"), nullable=False)
    user_name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    photo = relationship("Photo", back_populates="dislikes")

class Participant(Base):
    __tablename__ = "participants"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    user_name = Column(String, nullable=False)
    joined_at = Column(DateTime, server_default=func.now())
    
    # 유니크 제약조건 (같은 방에 같은 이름으로 중복 참가 방지)
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )

class UploadSession(Base):
    __tablename__ = "upload_sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    user_name = Column(String, nullable=False)
    total_files = Column(Integer, nullable=False)
    completed_files = Column(Integer, default=0)
    failed_files = Column(Integer, default=0)
    started_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)
    status = Column(String, default='in_progress')  # 'in_progress', 'completed', 'partially_failed', 'failed'
    
    # 관계 설정
    upload_logs = relationship("UploadLog", back_populates="session", cascade="all, delete-orphan")

class UploadLog(Base):
    __tablename__ = "upload_logs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("upload_sessions.id"), nullable=False)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    original_filename = Column(String, nullable=False)
    file_size = Column(Integer)
    mime_type = Column(String)
    uploader_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default='pending')  # 'pending', 'uploading', 'success', 'failed', 'retrying'
    photo_id = Column(String, ForeignKey("photos.id"))  # 성공시 생성된 photo ID
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    started_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)
    
    # 관계 설정
    session = relationship("UploadSession", back_populates="upload_logs")
    photo = relationship("Photo")