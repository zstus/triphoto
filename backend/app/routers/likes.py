from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from ..database.database import get_database
from ..models.models import Photo, Like
from ..models.schemas import LikeCreate, LikeResponse

router = APIRouter()

@router.post("/{photo_id}", response_model=LikeResponse)
async def toggle_like(photo_id: str, like_data: LikeCreate, db = Depends(get_database)):
    photo_query = "SELECT * FROM photos WHERE id = :photo_id"
    photo = await db.fetch_one(photo_query, {"photo_id": photo_id})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    existing_like_query = "SELECT * FROM likes WHERE photo_id = :photo_id AND user_name = :user_name"
    existing_like = await db.fetch_one(existing_like_query, {
        "photo_id": photo_id,
        "user_name": like_data.user_name
    })
    
    if existing_like:
        delete_query = "DELETE FROM likes WHERE id = :like_id"
        await db.execute(delete_query, {"like_id": existing_like["id"]})
        return {"message": "Like removed", "liked": False}
    else:
        like_id = str(__import__('uuid').uuid4())
        insert_query = """
            INSERT INTO likes (id, photo_id, user_name, created_at)
            VALUES (:id, :photo_id, :user_name, datetime('now'))
        """
        await db.execute(insert_query, {
            "id": like_id,
            "photo_id": photo_id,
            "user_name": like_data.user_name
        })
        
        like_query = "SELECT * FROM likes WHERE id = :like_id"
        like = await db.fetch_one(like_query, {"like_id": like_id})
        
        return LikeResponse(
            id=like["id"],
            photo_id=like["photo_id"],
            user_name=like["user_name"],
            created_at=like["created_at"]
        )

@router.get("/{photo_id}", response_model=List[LikeResponse])
async def get_photo_likes(photo_id: str, db = Depends(get_database)):
    photo_query = "SELECT * FROM photos WHERE id = :photo_id"
    photo = await db.fetch_one(photo_query, {"photo_id": photo_id})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    likes_query = "SELECT * FROM likes WHERE photo_id = :photo_id ORDER BY created_at DESC"
    likes = await db.fetch_all(likes_query, {"photo_id": photo_id})
    
    return [
        LikeResponse(
            id=like["id"],
            photo_id=like["photo_id"],
            user_name=like["user_name"],
            created_at=like["created_at"]
        )
        for like in likes
    ]

@router.get("/{photo_id}/check/{user_name}")
async def check_user_like(photo_id: str, user_name: str, db = Depends(get_database)):
    like_query = "SELECT * FROM likes WHERE photo_id = :photo_id AND user_name = :user_name"
    like = await db.fetch_one(like_query, {"photo_id": photo_id, "user_name": user_name})
    
    return {"liked": like is not None}

@router.get("/{photo_id}/count")  
async def get_like_count(photo_id: str, db = Depends(get_database)):
    count_query = "SELECT COUNT(*) as count FROM likes WHERE photo_id = :photo_id"
    result = await db.fetch_one(count_query, {"photo_id": photo_id})
    
    return {"count": result["count"] if result else 0}