from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from ..database.database import get_database
from ..models.models import Room, Photo
from ..models.schemas import PhotoResponse
from ..services.photo_service import save_uploaded_file
from ..utils.validation import InputValidator, SafetyValidator
from ..utils.security import FileSecurityUtils

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

@router.post("/{room_id}/upload", response_model=PhotoResponse)
@limiter.limit("20/minute")
async def upload_photo(
    request: Request,
    room_id: str,
    uploader_name: str = Form(...),
    file: UploadFile = File(...),
    db = Depends(get_database)
):
    # Security validations
    try:
        validated_room_id = InputValidator.validate_uuid(room_id)
        validated_uploader = InputValidator.validate_username(uploader_name)
        if not SafetyValidator.validate_room_access(validated_room_id):
            raise HTTPException(status_code=403, detail="Access denied")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Validate file security
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    if not FileSecurityUtils.validate_file_type(file.filename, {'.jpg', '.jpeg', '.png', '.gif', '.webp'}):
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, GIF, and WebP files are allowed")
    
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Check file size before reading
    if file.size and file.size > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB")
    
    room_query = "SELECT * FROM rooms WHERE id = :room_id AND is_active = 1"
    room = await db.fetch_one(room_query, {"room_id": validated_room_id})
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    upload_dir = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "..", "uploads"))
    
    try:
        file_data = await save_uploaded_file(file, upload_dir, validated_room_id)
        
        # Additional security scan of the saved file
        if not FileSecurityUtils.scan_file_for_malware(file_data["file_path"]):
            # Remove the uploaded file if security scan fails
            if os.path.exists(file_data["file_path"]):
                os.remove(file_data["file_path"])
            if file_data["thumbnail_path"] and os.path.exists(file_data["thumbnail_path"]):
                os.remove(file_data["thumbnail_path"])
            raise HTTPException(status_code=400, detail="File failed security scan")
        
        # 중복 파일 검사 (같은 사용자가 같은 파일을 올렸는지 확인)
        duplicate_check_query = """
            SELECT id FROM photos 
            WHERE room_id = :room_id 
            AND uploader_name = :uploader_name 
            AND file_hash = :file_hash
        """
        existing_photo = await db.fetch_one(duplicate_check_query, {
            "room_id": validated_room_id,
            "uploader_name": validated_uploader,
            "file_hash": file_data["file_hash"]
        })
        
        if existing_photo:
            # 중복 파일이므로 업로드된 파일 삭제
            if os.path.exists(file_data["file_path"]):
                os.remove(file_data["file_path"])
            if file_data["thumbnail_path"] and os.path.exists(file_data["thumbnail_path"]):
                os.remove(file_data["thumbnail_path"])
            
            raise HTTPException(
                status_code=409, 
                detail="이미 동일한 사진을 업로드하셨습니다."
            )
        
        insert_query = """
            INSERT INTO photos (
                id, room_id, filename, original_filename, uploader_name,
                file_path, thumbnail_path, file_size, mime_type, file_hash, taken_at, uploaded_at
            ) VALUES (
                :id, :room_id, :filename, :original_filename, :uploader_name,
                :file_path, :thumbnail_path, :file_size, :mime_type, :file_hash, :taken_at, datetime('now')
            )
        """
        
        photo_id = file_data["file_id"]
        await db.execute(insert_query, {
            "id": photo_id,
            "room_id": validated_room_id,
            "filename": file_data["filename"],
            "original_filename": file.filename,
            "uploader_name": validated_uploader,
            "file_path": file_data["file_path"],
            "thumbnail_path": file_data["thumbnail_path"],
            "file_size": file_data["file_size"],
            "mime_type": file_data["mime_type"],
            "file_hash": file_data["file_hash"],
            "taken_at": file_data["taken_at"]
        })
        
        photo_query = """
            SELECT p.*, 
                   COUNT(l.id) as like_count,
                   COUNT(d.id) as dislike_count
            FROM photos p
            LEFT JOIN likes l ON p.id = l.photo_id
            LEFT JOIN dislikes d ON p.id = d.photo_id
            WHERE p.id = :photo_id
            GROUP BY p.id
        """
        photo = await db.fetch_one(photo_query, {"photo_id": photo_id})
        
        return PhotoResponse(
            id=photo["id"],
            room_id=photo["room_id"],
            filename=photo["filename"],
            original_filename=photo["original_filename"],  
            uploader_name=photo["uploader_name"],
            file_path=f"/uploads/{validated_room_id}/{photo['filename']}",
            thumbnail_path=f"/uploads/{validated_room_id}/thumb_{photo['filename']}" if photo["thumbnail_path"] else None,
            file_size=photo["file_size"],
            mime_type=photo["mime_type"],
            taken_at=photo["taken_at"],
            uploaded_at=photo["uploaded_at"],
            like_count=photo["like_count"],
            dislike_count=photo["dislike_count"]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload photo: {str(e)}")

@router.get("/{room_id}", response_model=List[PhotoResponse])
@limiter.limit("30/minute")
async def get_room_photos(request: Request, room_id: str, db = Depends(get_database)):
    # Security validations
    try:
        validated_room_id = InputValidator.validate_uuid(room_id)
        if not SafetyValidator.validate_room_access(validated_room_id):
            raise HTTPException(status_code=403, detail="Access denied")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    room_query = "SELECT * FROM rooms WHERE id = :room_id AND is_active = 1"
    room = await db.fetch_one(room_query, {"room_id": validated_room_id})
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    photos_query = """
        SELECT p.*, 
               COUNT(l.id) as like_count,
               COUNT(d.id) as dislike_count
        FROM photos p
        LEFT JOIN likes l ON p.id = l.photo_id
        LEFT JOIN dislikes d ON p.id = d.photo_id
        WHERE p.room_id = :room_id
        GROUP BY p.id
        ORDER BY 
            CASE 
                WHEN p.taken_at IS NOT NULL THEN p.taken_at 
                ELSE p.uploaded_at 
            END ASC
    """
    
    photos = await db.fetch_all(photos_query, {"room_id": validated_room_id})
    
    return [
        PhotoResponse(
            id=photo["id"],
            room_id=photo["room_id"],
            filename=photo["filename"],
            original_filename=photo["original_filename"],
            uploader_name=photo["uploader_name"],
            file_path=f"/uploads/{validated_room_id}/{photo['filename']}",
            thumbnail_path=f"/uploads/{validated_room_id}/thumb_{photo['filename']}" if photo["thumbnail_path"] else None,
            file_size=photo["file_size"],
            mime_type=photo["mime_type"],
            taken_at=photo["taken_at"],
            uploaded_at=photo["uploaded_at"],
            like_count=photo["like_count"],
            dislike_count=photo["dislike_count"]
        )
        for photo in photos
    ]

@router.get("/{room_id}/with-user-status", response_model=List[PhotoResponse])
@limiter.limit("30/minute")
async def get_room_photos_with_user_status(
    request: Request, 
    room_id: str, 
    user_name: str,
    db = Depends(get_database)
):
    # Security validations
    try:
        validated_room_id = InputValidator.validate_uuid(room_id)
        validated_user_name = InputValidator.validate_username(user_name)
        if not SafetyValidator.validate_room_access(validated_room_id):
            raise HTTPException(status_code=403, detail="Access denied")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    room_query = "SELECT * FROM rooms WHERE id = :room_id AND is_active = 1"
    room = await db.fetch_one(room_query, {"room_id": validated_room_id})
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Complex query to get all photo data with user status and filter out disliked photos
    photos_query = """
        SELECT p.*, 
               COUNT(l.id) as like_count,
               COUNT(d.id) as dislike_count,
               CASE WHEN ul.photo_id IS NOT NULL THEN 1 ELSE 0 END as user_liked,
               CASE WHEN ud.photo_id IS NOT NULL THEN 1 ELSE 0 END as user_disliked
        FROM photos p
        LEFT JOIN likes l ON p.id = l.photo_id
        LEFT JOIN dislikes d ON p.id = d.photo_id
        LEFT JOIN likes ul ON p.id = ul.photo_id AND ul.user_name = :user_name
        LEFT JOIN dislikes ud ON p.id = ud.photo_id AND ud.user_name = :user_name
        WHERE p.room_id = :room_id
        -- Filter out photos with any dislikes (hide photos that have been disliked by anyone)
        AND NOT EXISTS (
            SELECT 1 FROM dislikes dd WHERE dd.photo_id = p.id
        )
        GROUP BY p.id, ul.photo_id, ud.photo_id
        ORDER BY 
            CASE 
                WHEN p.taken_at IS NOT NULL THEN p.taken_at 
                ELSE p.uploaded_at 
            END ASC
    """
    
    photos = await db.fetch_all(photos_query, {
        "room_id": validated_room_id,
        "user_name": validated_user_name
    })
    
    return [
        PhotoResponse(
            id=photo["id"],
            room_id=photo["room_id"],
            filename=photo["filename"],
            original_filename=photo["original_filename"],
            uploader_name=photo["uploader_name"],
            file_path=f"/uploads/{validated_room_id}/{photo['filename']}",
            thumbnail_path=f"/uploads/{validated_room_id}/thumb_{photo['filename']}" if photo["thumbnail_path"] else None,
            file_size=photo["file_size"],
            mime_type=photo["mime_type"],
            taken_at=photo["taken_at"],
            uploaded_at=photo["uploaded_at"],
            like_count=photo["like_count"],
            dislike_count=photo["dislike_count"],
            user_liked=bool(photo["user_liked"]),
            user_disliked=bool(photo["user_disliked"])
        )
        for photo in photos
    ]

@router.get("/{room_id}/{photo_id}/download")
@limiter.limit("20/minute")
async def download_photo(request: Request, room_id: str, photo_id: str, db = Depends(get_database)):
    # Security validations
    try:
        validated_room_id = InputValidator.validate_uuid(room_id)
        validated_photo_id = InputValidator.validate_uuid(photo_id)
        if not SafetyValidator.validate_room_access(validated_room_id):
            raise HTTPException(status_code=403, detail="Access denied")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    photo_query = "SELECT * FROM photos WHERE id = :photo_id AND room_id = :room_id"
    photo = await db.fetch_one(photo_query, {"photo_id": validated_photo_id, "room_id": validated_room_id})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    file_path = photo["file_path"]
    
    # Validate file path to prevent directory traversal
    try:
        upload_base_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
        room_upload_dir = os.path.join(upload_base_dir, validated_room_id)
        safe_path = FileSecurityUtils.sanitize_upload_path(
            room_upload_dir, 
            os.path.basename(file_path)
        )
        # Ensure the actual file path matches the sanitized path
        if os.path.abspath(file_path) != safe_path:
            raise HTTPException(status_code=403, detail="Invalid file path")
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid file path")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        path=file_path,
        filename=photo["original_filename"],
        media_type=photo["mime_type"]
    )