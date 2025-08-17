import os
import shutil
import hashlib
from PIL import Image, ImageOps, ExifTags
from datetime import datetime
from typing import Optional, Tuple
import uuid

# HEIC support registration
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC_SUPPORT = True
    print("🎉 HEIC support enabled")
except ImportError:
    HEIC_SUPPORT = False
    print("⚠️ HEIC support not available - pillow-heif not installed")

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

def convert_heic_to_jpeg(heic_path: str, jpeg_path: str, quality: int = 95) -> bool:
    """
    HEIC 파일을 JPEG로 변환
    
    Args:
        heic_path: 원본 HEIC 파일 경로
        jpeg_path: 변환될 JPEG 파일 경로
        quality: JPEG 품질 (1-100)
    
    Returns:
        bool: 변환 성공 여부
    """
    if not HEIC_SUPPORT:
        print("❌ HEIC support not available")
        return False
    
    try:
        with Image.open(heic_path) as img:
            # EXIF Orientation 정보를 자동으로 적용하여 이미지 회전
            img = ImageOps.exif_transpose(img)
            
            # RGB 모드로 변환 (HEIC가 다른 색상 모드일 수 있음)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # JPEG로 저장
            img.save(jpeg_path, "JPEG", quality=quality, optimize=True)
            
        print(f"✅ HEIC → JPEG 변환 성공: {os.path.basename(heic_path)} → {os.path.basename(jpeg_path)}")
        return True
        
    except Exception as e:
        print(f"❌ HEIC → JPEG 변환 실패: {e}")
        return False

def is_heic_file(filename: str, mime_type: str = None) -> bool:
    """
    파일이 HEIC 형식인지 확인
    
    Args:
        filename: 파일명
        mime_type: MIME 타입 (선택사항)
    
    Returns:
        bool: HEIC 파일 여부
    """
    # 확장자 기준 확인
    _, ext = os.path.splitext(filename.lower())
    if ext in ['.heic', '.heif']:
        return True
    
    # MIME 타입 기준 확인
    if mime_type and mime_type.lower() in ['image/heic', 'image/heif']:
        return True
    
    return False

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
    original_filename = file.filename
    file_extension = os.path.splitext(original_filename)[1].lower()
    
    # HEIC 파일 감지 및 처리
    is_heic = is_heic_file(original_filename, getattr(file, 'content_type', None))
    
    if is_heic and HEIC_SUPPORT:
        print(f"🔄 HEIC 파일 감지: {original_filename}")
        # HEIC 파일인 경우 JPEG 확장자로 변경
        final_extension = '.jpg'
        filename = f"{file_id}{final_extension}"
        temp_heic_filename = f"{file_id}_temp{file_extension}"
    else:
        # 일반 이미지 파일
        final_extension = file_extension
        filename = f"{file_id}{final_extension}"
    
    room_dir = os.path.join(upload_dir, room_id)
    os.makedirs(room_dir, exist_ok=True)
    
    final_file_path = os.path.join(room_dir, filename)
    thumbnail_path = os.path.join(room_dir, f"thumb_{filename}")
    
    # 파일 저장 로직
    if is_heic and HEIC_SUPPORT:
        # HEIC 파일인 경우: 임시로 저장 후 JPEG로 변환
        temp_heic_path = os.path.join(room_dir, temp_heic_filename)
        
        # 1단계: 원본 HEIC 파일 임시 저장
        with open(temp_heic_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 2단계: HEIC → JPEG 변환
        conversion_success = convert_heic_to_jpeg(temp_heic_path, final_file_path)
        
        # 3단계: 임시 HEIC 파일 삭제
        try:
            os.remove(temp_heic_path)
        except Exception as e:
            print(f"⚠️ 임시 HEIC 파일 삭제 실패: {e}")
        
        if not conversion_success:
            raise Exception("HEIC 파일 변환에 실패했습니다.")
    else:
        # 일반 이미지 파일인 경우: 직접 저장
        with open(final_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    
    # 파일 정보 추출 (변환된 파일 기준)
    file_info = get_file_info(final_file_path)
    taken_at = get_photo_taken_date(final_file_path)
    
    # HEIC 변환된 경우 MIME 타입을 JPEG로 강제 설정
    if is_heic and HEIC_SUPPORT:
        file_info["mime_type"] = "image/jpeg"
    
    # 썸네일 생성
    thumbnail_created = False
    if file_info.get("mime_type", "").startswith("image/"):
        thumbnail_created = create_thumbnail(final_file_path, thumbnail_path)
    
    # DB에는 상대 경로만 저장 (URL 생성용)
    relative_file_path = f"uploads/{room_id}/{filename}"
    relative_thumbnail_path = f"uploads/{room_id}/thumb_{filename}" if thumbnail_created else None
    
    return {
        "file_id": file_id,
        "filename": filename,
        "file_path": final_file_path,  # 실제 파일 시스템 경로 (파일 작업용)
        "relative_file_path": relative_file_path,  # DB 저장용 상대 경로
        "thumbnail_path": thumbnail_path if thumbnail_created else None,  # 실제 파일 시스템 경로
        "relative_thumbnail_path": relative_thumbnail_path,  # DB 저장용 상대 경로
        "taken_at": taken_at,
        **file_info
    }