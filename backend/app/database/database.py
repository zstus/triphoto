from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from databases import Database
import os
from dotenv import load_dotenv

# .env 파일 로드 (개발환경에서는 선택사항, 배포환경에서는 필수)
load_dotenv()

# 환경변수에서 DATABASE_URL을 가져오고, 없으면 개발용 기본값 사용
# 절대 경로로 데이터베이스 위치 지정
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
default_db_path = os.path.join(backend_dir, "travel_photos.db")
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{default_db_path}")

database = Database(DATABASE_URL)

# SQLite 사용시에만 check_same_thread=False 설정
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_database():
    return database