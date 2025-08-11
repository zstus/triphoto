from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
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