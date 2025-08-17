import os
from pathlib import Path

class SecurityConfig:
    """Security configuration settings"""
    
    # JWT Configuration
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-super-secret-jwt-key-change-in-production")
    JWT_ALGORITHM = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS = 30
    
    # HTTPS Configuration
    FORCE_HTTPS = os.environ.get("FORCE_HTTPS", "false").lower() == "true"
    HSTS_MAX_AGE = 31536000  # 1 year
    
    # CORS Configuration - 환경변수 사용
    @classmethod
    def get_allowed_origins(cls):
        """Get allowed origins from environment variable"""
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
    
    # File Upload Configuration - 환경변수 사용
    MAX_FILE_SIZE = int(os.environ.get("MAX_FILE_SIZE", "10485760"))  # 10MB default
    ALLOWED_FILE_TYPES = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    UPLOAD_PATH = Path(os.environ.get("UPLOAD_DIR", "uploads"))
    
    # Rate Limiting Configuration
    RATE_LIMIT_PER_MINUTE = 60
    RATE_LIMIT_BURST = 100
    
    # Security Headers
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": f"max-age={HSTS_MAX_AGE}; includeSubDomains",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "media-src 'self'; "
            "object-src 'none'; "
            "child-src 'none'; "
            "worker-src 'none'; "
            "frame-ancestors 'none'; "
            "form-action 'self'; "
            "base-uri 'self'"
        )
    }
    
    # Input Validation
    MAX_STRING_LENGTH = 1000
    MAX_DESCRIPTION_LENGTH = 2000
    MIN_USERNAME_LENGTH = 2
    MAX_USERNAME_LENGTH = 50
    MIN_ROOM_NAME_LENGTH = 1
    MAX_ROOM_NAME_LENGTH = 100
    
    # Database Security
    DB_QUERY_TIMEOUT = 30  # seconds
    MAX_DB_CONNECTIONS = 20
    
    @classmethod
    def get_environment(cls) -> str:
        """Get current environment"""
        return os.environ.get("ENVIRONMENT", "development")
    
    @classmethod
    def is_production(cls) -> bool:
        """Check if running in production"""
        return cls.get_environment().lower() == "production"
    
    @classmethod
    def is_development(cls) -> bool:
        """Check if running in development"""
        return cls.get_environment().lower() == "development"