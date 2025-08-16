import os
import shutil
import hashlib
from PIL import Image, ImageOps, ExifTags
from datetime import datetime
from typing import Optional, Tuple
import uuid

def create_thumbnail(image_path: str, thumbnail_path: str, size: Tuple[int, int] = (800, 800)) -> bool:
    try:
        with Image.open(image_path) as img:
            # EXIF Orientation 정보를 자동으로 적용하여 이미지 회전
            img = ImageOps.exif_transpose(img)
            
            img.thumbnail(size, Image.Resampling.LANCZOS)
            img.save(thumbnail_path, "JPEG", quality=85)
        return True
    except Exception as e:
        print(f"Failed to create thumbnail: {e}")
        return False

def get_photo_taken_date(image_path: str) -> Optional[datetime]:
    try:
        with Image.open(image_path) as img:
            exif = img._getexif()
            if exif is not None:
                for tag, value in exif.items():
                    decoded_tag = ExifTags.TAGS.get(tag, tag)
                    if decoded_tag == "DateTime" or decoded_tag == "DateTimeOriginal":
                        try:
                            return datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
                        except ValueError:
                            continue
    except Exception as e:
        print(f"Failed to extract EXIF data: {e}")
    
    try:
        stat = os.stat(image_path)
        return datetime.fromtimestamp(stat.st_mtime)
    except Exception:
        return datetime.now()

def get_file_hash(file_path: str) -> str:
    """파일의 MD5 해시를 계산하여 중복 검사에 사용"""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def get_file_info(file_path: str) -> dict:
    try:
        stat = os.stat(file_path)
        file_hash = get_file_hash(file_path)
        with Image.open(file_path) as img:
            return {
                "file_size": stat.st_size,
                "mime_type": f"image/{img.format.lower()}",
                "width": img.width,
                "height": img.height,
                "file_hash": file_hash
            }
    except Exception:
        stat = os.stat(file_path)
        file_hash = get_file_hash(file_path)
        return {
            "file_size": stat.st_size,
            "mime_type": "application/octet-stream",
            "file_hash": file_hash
        }

async def save_uploaded_file(file, upload_dir: str, room_id: str) -> dict:
    file_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1].lower()
    filename = f"{file_id}{file_extension}"
    
    room_dir = os.path.join(upload_dir, room_id)
    os.makedirs(room_dir, exist_ok=True)
    
    file_path = os.path.join(room_dir, filename)
    thumbnail_path = os.path.join(room_dir, f"thumb_{filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_info = get_file_info(file_path)
    taken_at = get_photo_taken_date(file_path)
    
    thumbnail_created = False
    if file_info.get("mime_type", "").startswith("image/"):
        thumbnail_created = create_thumbnail(file_path, thumbnail_path)
    
    # DB에는 상대 경로만 저장 (URL 생성용)
    relative_file_path = f"uploads/{room_id}/{filename}"
    relative_thumbnail_path = f"uploads/{room_id}/thumb_{filename}" if thumbnail_created else None
    
    return {
        "file_id": file_id,
        "filename": filename,
        "file_path": file_path,  # 실제 파일 시스템 경로 (파일 작업용)
        "relative_file_path": relative_file_path,  # DB 저장용 상대 경로
        "thumbnail_path": thumbnail_path if thumbnail_created else None,  # 실제 파일 시스템 경로
        "relative_thumbnail_path": relative_thumbnail_path,  # DB 저장용 상대 경로
        "taken_at": taken_at,
        **file_info
    }