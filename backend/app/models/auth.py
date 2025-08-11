from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Mapped, mapped_column
from fastapi_users.db import SQLAlchemyBaseUserTableUUID
import uuid
from datetime import datetime

from app.database.database import Base

class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "users"
    
    # Additional fields beyond FastAPI-Users defaults
    username: Mapped[str] = mapped_column(String(50), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)