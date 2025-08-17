from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import os
import shutil
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from ..database.database import get_database
from ..models.models import Room, Photo
from ..models.schemas import RoomCreate, RoomResponse, RoomJoin
from ..utils.validation import InputValidator, SafetyValidator

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

@router.post("/", response_model=RoomResponse)
@limiter.limit("20/minute")
async def create_room(request: Request, room_data: RoomCreate, db = Depends(get_database)):
    query = """
        INSERT INTO rooms (id, name, description, creator_name, created_at, is_active)
        VALUES (:id, :name, :description, :creator_name, datetime('now'), 1)
    """
    
    # Validate and sanitize input
    try:
        validated_name = InputValidator.validate_room_name(room_data.name)
        validated_creator = InputValidator.validate_username(room_data.creator_name)
        validated_description = InputValidator.validate_description(room_data.description)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    room_id = str(__import__('uuid').uuid4())
    
    await db.execute(query, {
        "id": room_id,
        "name": validated_name,
        "description": validated_description,
        "creator_name": validated_creator
    })
    
    room_query = "SELECT * FROM rooms WHERE id = :room_id"
    room = await db.fetch_one(room_query, {"room_id": room_id})
    
    if not room:
        raise HTTPException(status_code=500, detail="Failed to create room")
    
    return RoomResponse(
        id=room["id"],
        name=room["name"],
        description=room["description"],
        creator_name=room["creator_name"],
        created_at=room["created_at"],
        is_active=room["is_active"],
        photo_count=0
    )

@router.get("/{room_id}", response_model=RoomResponse)
@limiter.limit("30/minute")
async def get_room(request: Request, room_id: str, db = Depends(get_database)):
    # Validate room_id format and access
    try:
        validated_room_id = InputValidator.validate_uuid(room_id)
        if not SafetyValidator.validate_room_access(validated_room_id):
            raise HTTPException(status_code=403, detail="Access denied")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid room ID format")
    
    room_query = "SELECT * FROM rooms WHERE id = :room_id AND is_active = 1"
    room = await db.fetch_one(room_query, {"room_id": validated_room_id})
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    photo_count_query = "SELECT COUNT(*) as count FROM photos WHERE room_id = :room_id"
    photo_count = await db.fetch_one(photo_count_query, {"room_id": validated_room_id})
    
    return RoomResponse(
        id=room["id"],
        name=room["name"],
        description=room["description"],
        creator_name=room["creator_name"],
        created_at=room["created_at"],
        is_active=room["is_active"],
        photo_count=photo_count["count"] if photo_count else 0
    )

@router.post("/{room_id}/join")
@limiter.limit("30/minute")
async def join_room(request: Request, room_id: str, join_data: RoomJoin, db = Depends(get_database)):
    # Validate inputs
    try:
        validated_room_id = InputValidator.validate_uuid(room_id)
        validated_username = InputValidator.validate_username(join_data.user_name)
        if not SafetyValidator.validate_room_access(validated_room_id):
            raise HTTPException(status_code=403, detail="Access denied")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    room_query = "SELECT * FROM rooms WHERE id = :room_id AND is_active = 1"
    room = await db.fetch_one(room_query, {"room_id": validated_room_id})
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return {
        "message": f"{validated_username} successfully joined room",
        "room_id": validated_room_id,
        "room_name": room["name"]
    }

@router.get("/{room_id}/participants")
@limiter.limit("20/minute")
async def get_room_participants_count(request: Request, room_id: str, db = Depends(get_database)):
    # Validate room_id
    try:
        validated_room_id = InputValidator.validate_uuid(room_id)
        if not SafetyValidator.validate_room_access(validated_room_id):
            raise HTTPException(status_code=403, detail="Access denied")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid room ID format")
    
    room_query = "SELECT * FROM rooms WHERE id = :room_id AND is_active = 1"
    room = await db.fetch_one(room_query, {"room_id": validated_room_id})
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # 방에 사진을 업로드한 고유 사용자 수 계산
    participants_query = """
        SELECT COUNT(DISTINCT uploader_name) as participant_count
        FROM photos 
        WHERE room_id = :room_id
    """
    result = await db.fetch_one(participants_query, {"room_id": validated_room_id})
    
    return {"participant_count": result["participant_count"] if result else 0}

@router.get("/{room_id}/participants/list")
@limiter.limit("20/minute")
async def get_room_participants_list(request: Request, room_id: str, db = Depends(get_database)):
    # Validate room_id
    try:
        validated_room_id = InputValidator.validate_uuid(room_id)
        if not SafetyValidator.validate_room_access(validated_room_id):
            raise HTTPException(status_code=403, detail="Access denied")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid room ID format")
    
    room_query = "SELECT * FROM rooms WHERE id = :room_id AND is_active = 1"
    room = await db.fetch_one(room_query, {"room_id": validated_room_id})
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # 방 생성자도 포함하여 모든 참가자 목록 조회
    participants_query = """
        SELECT DISTINCT uploader_name as name, 
               COUNT(*) as photo_count,
               MIN(uploaded_at) as first_upload_at
        FROM photos 
        WHERE room_id = :room_id
        GROUP BY uploader_name
        ORDER BY first_upload_at ASC
    """
    participants = await db.fetch_all(participants_query, {"room_id": validated_room_id})
    
    # 방 생성자가 사진을 올리지 않았다면 추가
    creator_in_list = any(p["name"] == room["creator_name"] for p in participants)
    result_participants = list(participants)
    
    if not creator_in_list:
        result_participants.insert(0, {
            "name": room["creator_name"],
            "photo_count": 0,
            "first_upload_at": room["created_at"]
        })
    
    return {"participants": result_participants}

@router.get("/")
@limiter.limit("60/minute")
async def list_rooms(request: Request, db = Depends(get_database)):
    query = """
        SELECT r.*, COUNT(p.id) as photo_count 
        FROM rooms r 
        LEFT JOIN photos p ON r.id = p.room_id 
        WHERE r.is_active = 1 
        GROUP BY r.id 
        ORDER BY r.created_at DESC
    """
    rooms = await db.fetch_all(query)
    
    return [
        RoomResponse(
            id=room["id"],
            name=room["name"],
            description=room["description"],
            creator_name=room["creator_name"],
            created_at=room["created_at"],
            is_active=room["is_active"],
            photo_count=room["photo_count"]
        )
        for room in rooms
    ]

@router.delete("/{room_id}")
@limiter.limit("5/minute")
async def delete_room(request: Request, room_id: str, db = Depends(get_database)):
    """
    방 삭제 API - 백도어 기능 (creator_name이 '이성일'인 경우만)
    방 데이터베이스 레코드, 관련 사진, 좋아요/싫어요, 업로드 폴더 모두 삭제
    """
    # Validate room_id
    try:
        validated_room_id = InputValidator.validate_uuid(room_id)
        if not SafetyValidator.validate_room_access(validated_room_id):
            raise HTTPException(status_code=403, detail="Access denied")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid room ID format")
    
    # 방 정보 조회
    room_query = "SELECT * FROM rooms WHERE id = :room_id"
    room = await db.fetch_one(room_query, {"room_id": validated_room_id})
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # 백도어 체크: creator_name이 '이성일'인지 확인
    if room["creator_name"] != "이성일":
        raise HTTPException(status_code=403, detail="Only the special creator can delete rooms")
    
    try:
        # 1. 사진 파일들의 경로 조회 (물리적 파일 삭제를 위해)
        photos_query = "SELECT file_path, thumbnail_path FROM photos WHERE room_id = :room_id"
        photos = await db.fetch_all(photos_query, {"room_id": validated_room_id})
        
        # 2. 데이터베이스에서 관련 데이터 삭제 (순서 중요 - 외래키 제약조건)
        # 2-1. 좋아요 삭제
        await db.execute("DELETE FROM likes WHERE photo_id IN (SELECT id FROM photos WHERE room_id = :room_id)", 
                        {"room_id": validated_room_id})
        
        # 2-2. 싫어요 삭제
        await db.execute("DELETE FROM dislikes WHERE photo_id IN (SELECT id FROM photos WHERE room_id = :room_id)", 
                        {"room_id": validated_room_id})
        
        # 2-3. 사진 레코드 삭제
        await db.execute("DELETE FROM photos WHERE room_id = :room_id", {"room_id": validated_room_id})
        
        # 2-4. 방 레코드 삭제
        await db.execute("DELETE FROM rooms WHERE id = :room_id", {"room_id": validated_room_id})
        
        # 3. 물리적 파일 및 폴더 삭제
        uploads_dir = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
        uploads_dir = os.path.abspath(uploads_dir)
        room_folder_path = os.path.join(uploads_dir, validated_room_id)
        
        # 개별 사진 파일 삭제 (안전성을 위해)
        for photo in photos:
            if photo["file_path"]:
                file_path = os.path.join(uploads_dir, photo["file_path"].lstrip('/'))
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        print(f"🗑️ Deleted file: {file_path}")
                    except Exception as e:
                        print(f"⚠️ Failed to delete file {file_path}: {e}")
            
            if photo["thumbnail_path"]:
                thumb_path = os.path.join(uploads_dir, photo["thumbnail_path"].lstrip('/'))
                if os.path.exists(thumb_path):
                    try:
                        os.remove(thumb_path)
                        print(f"🗑️ Deleted thumbnail: {thumb_path}")
                    except Exception as e:
                        print(f"⚠️ Failed to delete thumbnail {thumb_path}: {e}")
        
        # 방 폴더 전체 삭제
        if os.path.exists(room_folder_path):
            try:
                shutil.rmtree(room_folder_path)
                print(f"🗑️ Deleted room folder: {room_folder_path}")
            except Exception as e:
                print(f"⚠️ Failed to delete room folder {room_folder_path}: {e}")
        
        return {
            "message": f"Room '{room['name']}' and all associated data have been permanently deleted",
            "room_id": validated_room_id,
            "room_name": room["name"],
            "deleted_photos_count": len(photos),
            "deleted_by": room["creator_name"]
        }
        
    except Exception as e:
        print(f"❌ Error during room deletion: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete room: {str(e)}")