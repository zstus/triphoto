from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

from ..database.database import get_database
from ..models.models import UploadSession, UploadLog, Photo
from ..models.schemas import (
    UploadSessionCreate, UploadSessionResponse, UploadSessionUpdate,
    UploadLogCreate, UploadLogResponse, UploadLogUpdate,
    UploadResult, RetryRequest
)
from ..utils.validation import InputValidator, SafetyValidator

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

# 업로드 세션 생성
@router.post("/sessions/", response_model=UploadSessionResponse)
@limiter.limit("30/minute")
async def create_upload_session(
    request: Request, 
    session_data: UploadSessionCreate, 
    db = Depends(get_database)
):
    """새로운 업로드 세션을 생성합니다."""
    # 입력 검증
    try:
        validated_room_id = InputValidator.validate_uuid(session_data.room_id)
        validated_username = InputValidator.validate_username(session_data.user_name)
        if not SafetyValidator.validate_room_access(validated_room_id):
            raise HTTPException(status_code=403, detail="Access denied")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if session_data.total_files <= 0 or session_data.total_files > 100:
        raise HTTPException(status_code=400, detail="Total files must be between 1 and 100")
    
    # 방 존재 확인
    room_query = "SELECT id FROM rooms WHERE id = :room_id AND is_active = 1"
    room = await db.fetch_one(room_query, {"room_id": validated_room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # 업로드 세션 생성
    session_id = str(__import__('uuid').uuid4())
    insert_query = """
        INSERT INTO upload_sessions (id, room_id, user_name, total_files, started_at, status)
        VALUES (:id, :room_id, :user_name, :total_files, datetime('now'), 'in_progress')
    """
    
    await db.execute(insert_query, {
        "id": session_id,
        "room_id": validated_room_id,
        "user_name": validated_username,
        "total_files": session_data.total_files
    })
    
    # 생성된 세션 조회
    session_query = "SELECT * FROM upload_sessions WHERE id = :session_id"
    session = await db.fetch_one(session_query, {"session_id": session_id})
    
    return UploadSessionResponse(
        id=session["id"],
        room_id=session["room_id"],
        user_name=session["user_name"],
        total_files=session["total_files"],
        completed_files=session["completed_files"] or 0,
        failed_files=session["failed_files"] or 0,
        started_at=session["started_at"],
        completed_at=session["completed_at"],
        status=session["status"]
    )

# 업로드 세션 조회
@router.get("/sessions/{session_id}", response_model=UploadSessionResponse)
@limiter.limit("60/minute")
async def get_upload_session(
    request: Request,
    session_id: str,
    db = Depends(get_database)
):
    """업로드 세션 정보를 조회합니다."""
    try:
        validated_session_id = InputValidator.validate_uuid(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session_query = "SELECT * FROM upload_sessions WHERE id = :session_id"
    session = await db.fetch_one(session_query, {"session_id": validated_session_id})
    
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    return UploadSessionResponse(
        id=session["id"],
        room_id=session["room_id"],
        user_name=session["user_name"],
        total_files=session["total_files"],
        completed_files=session["completed_files"] or 0,
        failed_files=session["failed_files"] or 0,
        started_at=session["started_at"],
        completed_at=session["completed_at"],
        status=session["status"]
    )

# 업로드 세션 업데이트
@router.put("/sessions/{session_id}", response_model=UploadSessionResponse)
@limiter.limit("100/minute")
async def update_upload_session(
    request: Request,
    session_id: str,
    update_data: UploadSessionUpdate,
    db = Depends(get_database)
):
    """업로드 세션 정보를 업데이트합니다."""
    try:
        validated_session_id = InputValidator.validate_uuid(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    # 세션 존재 확인
    session_query = "SELECT * FROM upload_sessions WHERE id = :session_id"
    session = await db.fetch_one(session_query, {"session_id": validated_session_id})
    
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    # 업데이트할 필드 준비
    update_fields = []
    update_values = {"session_id": validated_session_id}
    
    if update_data.completed_files is not None:
        update_fields.append("completed_files = :completed_files")
        update_values["completed_files"] = update_data.completed_files
    
    if update_data.failed_files is not None:
        update_fields.append("failed_files = :failed_files")
        update_values["failed_files"] = update_data.failed_files
    
    if update_data.status is not None:
        update_fields.append("status = :status")
        update_values["status"] = update_data.status
    
    if update_data.completed_at is not None:
        update_fields.append("completed_at = :completed_at")
        update_values["completed_at"] = update_data.completed_at.isoformat()
    
    if update_fields:
        update_query = f"UPDATE upload_sessions SET {', '.join(update_fields)} WHERE id = :session_id"
        await db.execute(update_query, update_values)
    
    # 업데이트된 세션 조회
    updated_session = await db.fetch_one(session_query, {"session_id": validated_session_id})
    
    return UploadSessionResponse(
        id=updated_session["id"],
        room_id=updated_session["room_id"],
        user_name=updated_session["user_name"],
        total_files=updated_session["total_files"],
        completed_files=updated_session["completed_files"],
        failed_files=updated_session["failed_files"],
        started_at=updated_session["started_at"],
        completed_at=updated_session["completed_at"],
        status=updated_session["status"]
    )

# 업로드 로그 생성
@router.post("/logs/", response_model=UploadLogResponse)
@limiter.limit("200/minute")
async def create_upload_log(
    request: Request,
    log_data: UploadLogCreate,
    db = Depends(get_database)
):
    """새로운 업로드 로그를 생성합니다."""
    # 입력 검증
    try:
        validated_session_id = InputValidator.validate_uuid(log_data.session_id)
        validated_room_id = InputValidator.validate_uuid(log_data.room_id)
        validated_username = InputValidator.validate_username(log_data.uploader_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # 세션 존재 확인
    session_query = "SELECT id FROM upload_sessions WHERE id = :session_id"
    session = await db.fetch_one(session_query, {"session_id": validated_session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    # 업로드 로그 생성
    log_id = str(__import__('uuid').uuid4())
    insert_query = """
        INSERT INTO upload_logs (
            id, session_id, room_id, original_filename, file_size, 
            mime_type, uploader_name, status, started_at
        )
        VALUES (
            :id, :session_id, :room_id, :original_filename, :file_size,
            :mime_type, :uploader_name, 'pending', datetime('now')
        )
    """
    
    await db.execute(insert_query, {
        "id": log_id,
        "session_id": validated_session_id,
        "room_id": validated_room_id,
        "original_filename": log_data.original_filename,
        "file_size": log_data.file_size,
        "mime_type": log_data.mime_type,
        "uploader_name": validated_username
    })
    
    # 생성된 로그 조회
    log_query = "SELECT * FROM upload_logs WHERE id = :log_id"
    log = await db.fetch_one(log_query, {"log_id": log_id})
    
    return UploadLogResponse(
        id=log["id"],
        session_id=log["session_id"],
        room_id=log["room_id"],
        original_filename=log["original_filename"],
        file_size=log["file_size"],
        mime_type=log["mime_type"],
        uploader_name=log["uploader_name"],
        status=log["status"],
        photo_id=log["photo_id"],
        error_message=log["error_message"],
        retry_count=log["retry_count"] or 0,
        started_at=log["started_at"],
        completed_at=log["completed_at"]
    )

# 업로드 로그 업데이트
@router.put("/logs/{log_id}", response_model=UploadLogResponse)
@limiter.limit("200/minute")
async def update_upload_log(
    request: Request,
    log_id: str,
    update_data: UploadLogUpdate,
    db = Depends(get_database)
):
    """업로드 로그를 업데이트합니다."""
    try:
        validated_log_id = InputValidator.validate_uuid(log_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid log ID format")
    
    # 로그 존재 확인
    log_query = "SELECT * FROM upload_logs WHERE id = :log_id"
    log = await db.fetch_one(log_query, {"log_id": validated_log_id})
    
    if not log:
        raise HTTPException(status_code=404, detail="Upload log not found")
    
    # 업데이트할 필드 준비
    update_fields = []
    update_values = {"log_id": validated_log_id}
    
    if update_data.status is not None:
        update_fields.append("status = :status")
        update_values["status"] = update_data.status
    
    if update_data.photo_id is not None:
        update_fields.append("photo_id = :photo_id")
        update_values["photo_id"] = update_data.photo_id
    
    if update_data.error_message is not None:
        update_fields.append("error_message = :error_message")
        update_values["error_message"] = update_data.error_message
    
    if update_data.retry_count is not None:
        update_fields.append("retry_count = :retry_count")
        update_values["retry_count"] = update_data.retry_count
    
    if update_data.completed_at is not None:
        update_fields.append("completed_at = :completed_at")
        update_values["completed_at"] = update_data.completed_at.isoformat()
    
    if update_fields:
        update_query = f"UPDATE upload_logs SET {', '.join(update_fields)} WHERE id = :log_id"
        await db.execute(update_query, update_values)
    
    # 업데이트된 로그 조회
    updated_log = await db.fetch_one(log_query, {"log_id": validated_log_id})
    
    return UploadLogResponse(
        id=updated_log["id"],
        session_id=updated_log["session_id"],
        room_id=updated_log["room_id"],
        original_filename=updated_log["original_filename"],
        file_size=updated_log["file_size"],
        mime_type=updated_log["mime_type"],
        uploader_name=updated_log["uploader_name"],
        status=updated_log["status"],
        photo_id=updated_log["photo_id"],
        error_message=updated_log["error_message"],
        retry_count=updated_log["retry_count"],
        started_at=updated_log["started_at"],
        completed_at=updated_log["completed_at"]
    )

# 세션의 모든 로그 조회
@router.get("/sessions/{session_id}/logs", response_model=List[UploadLogResponse])
@limiter.limit("60/minute")
async def get_session_logs(
    request: Request,
    session_id: str,
    db = Depends(get_database)
):
    """특정 세션의 모든 업로드 로그를 조회합니다."""
    try:
        validated_session_id = InputValidator.validate_uuid(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    logs_query = """
        SELECT * FROM upload_logs 
        WHERE session_id = :session_id 
        ORDER BY started_at ASC
    """
    logs = await db.fetch_all(logs_query, {"session_id": validated_session_id})
    
    return [
        UploadLogResponse(
            id=log["id"],
            session_id=log["session_id"],
            room_id=log["room_id"],
            original_filename=log["original_filename"],
            file_size=log["file_size"],
            mime_type=log["mime_type"],
            uploader_name=log["uploader_name"],
            status=log["status"],
            photo_id=log["photo_id"],
            error_message=log["error_message"],
            retry_count=log["retry_count"] or 0,
            started_at=log["started_at"],
            completed_at=log["completed_at"]
        )
        for log in logs
    ]

# 실패한 로그들 재시도
@router.post("/retry", response_model=UploadResult)
@limiter.limit("10/minute")
async def retry_failed_uploads(
    request: Request,
    retry_data: RetryRequest,
    db = Depends(get_database)
):
    """실패한 업로드들을 재시도 상태로 변경합니다."""
    if not retry_data.log_ids:
        raise HTTPException(status_code=400, detail="No log IDs provided")
    
    # 로그 ID들 검증
    validated_log_ids = []
    for log_id in retry_data.log_ids:
        try:
            validated_log_ids.append(InputValidator.validate_uuid(log_id))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid log ID format: {log_id}")
    
    # 실패한 로그들만 재시도 상태로 변경
    placeholders = ','.join([f':log_id_{i}' for i in range(len(validated_log_ids))])
    update_query = f"""
        UPDATE upload_logs 
        SET status = 'pending', retry_count = retry_count + 1, completed_at = NULL
        WHERE id IN ({placeholders}) AND status = 'failed'
    """
    
    update_params = {f'log_id_{i}': log_id for i, log_id in enumerate(validated_log_ids)}
    await db.execute(update_query, update_params)
    
    # 업데이트된 로그들 조회
    select_query = f"""
        SELECT * FROM upload_logs 
        WHERE id IN ({placeholders})
        ORDER BY started_at ASC
    """
    updated_logs = await db.fetch_all(select_query, update_params)
    
    failed_logs = [
        UploadLogResponse(
            id=log["id"],
            session_id=log["session_id"],
            room_id=log["room_id"],
            original_filename=log["original_filename"],
            file_size=log["file_size"],
            mime_type=log["mime_type"],
            uploader_name=log["uploader_name"],
            status=log["status"],
            photo_id=log["photo_id"],
            error_message=log["error_message"],
            retry_count=log["retry_count"] or 0,
            started_at=log["started_at"],
            completed_at=log["completed_at"]
        )
        for log in updated_logs
    ]
    
    return UploadResult(
        session_id=updated_logs[0]["session_id"] if updated_logs else "",
        total_files=len(updated_logs),
        successful_uploads=len([log for log in updated_logs if log["status"] == "success"]),
        failed_uploads=len([log for log in updated_logs if log["status"] in ["failed", "pending"]]),
        failed_files=failed_logs
    )