from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from ..database.database import get_database
from ..models.models import Photo, Dislike
from ..models.schemas import DislikeCreate, DislikeResponse

router = APIRouter()

@router.post("/{photo_id}", response_model=DislikeResponse)
async def toggle_dislike(photo_id: str, dislike_data: DislikeCreate, db = Depends(get_database)):
    # 사진이 존재하는지 확인
    photo_query = "SELECT * FROM photos WHERE id = :photo_id"
    photo = await db.fetch_one(photo_query, {"photo_id": photo_id})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # 기존 싫어요가 있는지 확인
    existing_dislike_query = """
        SELECT * FROM dislikes 
        WHERE photo_id = :photo_id AND user_name = :user_name
    """
    existing_dislike = await db.fetch_one(existing_dislike_query, {
        "photo_id": photo_id,
        "user_name": dislike_data.user_name
    })
    
    if existing_dislike:
        # 기존 싫어요 제거
        delete_query = "DELETE FROM dislikes WHERE id = :dislike_id"
        await db.execute(delete_query, {"dislike_id": existing_dislike["id"]})
        
        return DislikeResponse(
            id=existing_dislike["id"],
            photo_id=photo_id,
            user_name=dislike_data.user_name,
            created_at=existing_dislike["created_at"]
        )
    else:
        # 새 싫어요 추가
        import uuid
        dislike_id = str(uuid.uuid4())
        
        insert_query = """
            INSERT INTO dislikes (id, photo_id, user_name, created_at)
            VALUES (:id, :photo_id, :user_name, datetime('now'))
        """
        await db.execute(insert_query, {
            "id": dislike_id,
            "photo_id": photo_id,
            "user_name": dislike_data.user_name
        })
        
        # 새로 생성된 싫어요 조회
        new_dislike_query = "SELECT * FROM dislikes WHERE id = :dislike_id"
        new_dislike = await db.fetch_one(new_dislike_query, {"dislike_id": dislike_id})
        
        return DislikeResponse(
            id=new_dislike["id"],
            photo_id=photo_id,
            user_name=dislike_data.user_name,
            created_at=new_dislike["created_at"]
        )

@router.get("/{photo_id}/check/{user_name}")
async def check_user_dislike(photo_id: str, user_name: str, db = Depends(get_database)):
    dislike_query = """
        SELECT * FROM dislikes 
        WHERE photo_id = :photo_id AND user_name = :user_name
    """
    dislike = await db.fetch_one(dislike_query, {
        "photo_id": photo_id,
        "user_name": user_name
    })
    
    return {"disliked": dislike is not None}