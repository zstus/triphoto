from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from .database.database import engine, database
from .models import models
from .models.auth import User
from .routers import rooms, photos, likes, dislikes
from .auth.auth import auth_backend, fastapi_users
from .schemas.auth import UserRead, UserCreate

models.Base.metadata.create_all(bind=engine)

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="Travel Photo Sharing API", 
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    # Skip rate limiting for CORS preflight requests
    if request.method == "OPTIONS":
        response = await call_next(request)
    else:
        response = await call_next(request)
    
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Only add HSTS for HTTPS environments
    if os.getenv("SECURITY_HEADERS_HSTS", "True").lower() == "true":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Dynamic CSP connect-src based on environment
    connect_src = os.getenv("SECURITY_HEADERS_CSP_CONNECT_SRC", "http://localhost:3000")
    response.headers["Content-Security-Policy"] = f"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' {connect_src}"
    return response

# Environment-based CORS configuration
def get_allowed_origins():
    # Get from environment variable or use defaults
    origins_env = os.getenv("ALLOWED_ORIGINS", "")
    if origins_env:
        return [origin.strip() for origin in origins_env.split(",") if origin.strip()]
    
    # Fallback to development defaults
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

allowed_origins = get_allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Accept", "Accept-Language", "Content-Language", "Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token", "X-Content-Type-Options"],
    expose_headers=["X-Total-Count"],
)

# Environment-based upload directory configuration
uploads_dir = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "..", "uploads"))
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

# Authentication routes
app.include_router(
    fastapi_users.get_auth_router(auth_backend), prefix="/auth/jwt", tags=["auth"]
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserCreate),
    prefix="/users",
    tags=["users"],
)

# Application routes with rate limiting
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])
app.include_router(photos.router, prefix="/api/photos", tags=["photos"])
app.include_router(likes.router, prefix="/api/likes", tags=["likes"])
app.include_router(dislikes.router, prefix="/api/dislikes", tags=["dislikes"])

@app.get("/")
@limiter.limit("10/minute")
async def root(request: Request):
    return {"message": "Travel Photo Sharing API", "version": "1.0.0"}

@app.get("/health")
@limiter.limit("30/minute")
async def health_check(request: Request):
    return {"status": "healthy", "database": "connected"}