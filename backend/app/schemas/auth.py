from fastapi_users import schemas
from pydantic import BaseModel, Field
from typing import Optional
import uuid
from datetime import datetime

class UserRead(schemas.BaseUser[uuid.UUID]):
    username: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class UserCreate(schemas.BaseUserCreate):
    username: Optional[str] = Field(None, min_length=2, max_length=50)

class UserUpdate(schemas.BaseUserUpdate):
    username: Optional[str] = Field(None, min_length=2, max_length=50)