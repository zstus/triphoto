import re
import bleach
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, validator
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

class InputValidator:
    """
    Comprehensive input validation and sanitization utility
    """
    
    # Allowed HTML tags and attributes for content sanitization
    ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li']
    ALLOWED_ATTRIBUTES = {}
    
    # Regex patterns for validation
    PATTERNS = {
        'email': re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'),
        'uuid': re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
        'filename': re.compile(r'^[a-zA-Z0-9._-]+$'),
        'room_name': re.compile(r'^[가-힣a-zA-Z0-9\s._-]{1,100}$'),
        'username': re.compile(r'^[가-힣a-zA-Z0-9._-]{2,50}$'),
    }
    
    # Dangerous patterns that should be blocked
    DANGEROUS_PATTERNS = [
        # SQL Injection
        re.compile(r"(?i)(union\s+select|drop\s+table|insert\s+into|delete\s+from)", re.IGNORECASE),
        re.compile(r"(?i)(\'\s*or\s*\'|\".*or.*\"|\'\s*=\s*\')", re.IGNORECASE),
        re.compile(r"(?i)(exec\s*\(|execute\s*\(|sp_executesql)", re.IGNORECASE),
        
        # XSS
        re.compile(r"(?i)(<script.*?>|javascript:|onload=|onerror=)", re.IGNORECASE),
        re.compile(r"(?i)(eval\s*\(|expression\s*\(|vbscript:)", re.IGNORECASE),
        
        # Command Injection
        re.compile(r"(?i)(&&\s*|;\s*|\|\s*)(cat|ls|pwd|whoami)", re.IGNORECASE),
        
        # Path Traversal
        re.compile(r"(\.\./|\.\.\\\\|%2e%2e%2f)", re.IGNORECASE),
    ]
    
    @classmethod
    def validate_email(cls, email: str) -> str:
        """Validate email format"""
        if not email or not isinstance(email, str):
            raise ValueError("Email is required")
        
        email = email.strip().lower()
        if not cls.PATTERNS['email'].match(email):
            raise ValueError("Invalid email format")
        
        if len(email) > 254:  # RFC 5321 limit
            raise ValueError("Email too long")
        
        return email
    
    @classmethod
    def validate_uuid(cls, uuid_str: str) -> str:
        """Validate UUID format"""
        if not uuid_str or not isinstance(uuid_str, str):
            raise ValueError("UUID is required")
        
        uuid_str = uuid_str.strip().lower()
        if not cls.PATTERNS['uuid'].match(uuid_str):
            raise ValueError("Invalid UUID format")
        
        return uuid_str
    
    @classmethod
    def validate_room_name(cls, name: str) -> str:
        """Validate room name"""
        if not name or not isinstance(name, str):
            raise ValueError("Room name is required")
        
        name = name.strip()
        if len(name) < 1 or len(name) > 100:
            raise ValueError("Room name must be 1-100 characters")
        
        if not cls.PATTERNS['room_name'].match(name):
            raise ValueError("Room name contains invalid characters")
        
        return cls.sanitize_text(name)
    
    @classmethod
    def validate_username(cls, username: str) -> str:
        """Validate username"""
        if not username or not isinstance(username, str):
            raise ValueError("Username is required")
        
        username = username.strip()
        if len(username) < 2 or len(username) > 50:
            raise ValueError("Username must be 2-50 characters")
        
        if not cls.PATTERNS['username'].match(username):
            raise ValueError("Username contains invalid characters")
        
        return cls.sanitize_text(username)
    
    @classmethod
    def validate_description(cls, description: Optional[str]) -> Optional[str]:
        """Validate and sanitize description text"""
        if not description:
            return None
        
        if not isinstance(description, str):
            raise ValueError("Description must be a string")
        
        description = description.strip()
        if len(description) > 1000:
            raise ValueError("Description too long (max 1000 characters)")
        
        return cls.sanitize_text(description)
    
    @classmethod
    def sanitize_text(cls, text: str) -> str:
        """Sanitize text input to prevent XSS"""
        if not text:
            return ""
        
        # Check for dangerous patterns
        for pattern in cls.DANGEROUS_PATTERNS:
            if pattern.search(text):
                logger.warning(f"Dangerous pattern detected in input: {text[:100]}")
                raise ValueError("Input contains potentially dangerous content")
        
        # Remove HTML tags and sanitize
        sanitized = bleach.clean(
            text,
            tags=cls.ALLOWED_TAGS,
            attributes=cls.ALLOWED_ATTRIBUTES,
            strip=True
        )
        
        return sanitized.strip()
    
    @classmethod
    def validate_file_upload(cls, filename: str, file_size: int, max_size: int = 10 * 1024 * 1024) -> str:
        """Validate file upload parameters"""
        if not filename or not isinstance(filename, str):
            raise ValueError("Filename is required")
        
        # Check file size
        if file_size > max_size:
            raise ValueError(f"File too large (max {max_size // 1024 // 1024}MB)")
        
        # Check filename
        filename = filename.strip()
        if not filename:
            raise ValueError("Filename cannot be empty")
        
        # Check for dangerous characters
        if '..' in filename or '/' in filename or '\\' in filename:
            raise ValueError("Invalid filename")
        
        # Check file extension
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
        if not any(filename.lower().endswith(ext) for ext in allowed_extensions):
            raise ValueError("File type not allowed")
        
        return filename
    
    @classmethod
    def validate_pagination(cls, skip: int = 0, limit: int = 20) -> tuple[int, int]:
        """Validate pagination parameters"""
        if not isinstance(skip, int) or skip < 0:
            skip = 0
        
        if not isinstance(limit, int) or limit < 1:
            limit = 20
        elif limit > 100:  # Prevent excessive data retrieval
            limit = 100
        
        return skip, limit


class SafetyValidator:
    """Additional safety validations for sensitive operations"""
    
    @staticmethod
    def validate_room_access(room_id: str, user_context: Optional[Dict] = None) -> bool:
        """Validate room access permissions"""
        # Basic UUID validation
        try:
            InputValidator.validate_uuid(room_id)
        except ValueError:
            return False
        
        # Additional access controls can be added here
        return True
    
    @staticmethod
    def validate_photo_access(photo_id: str, user_context: Optional[Dict] = None) -> bool:
        """Validate photo access permissions"""
        try:
            InputValidator.validate_uuid(photo_id)
        except ValueError:
            return False
        
        return True
    
    @staticmethod
    def check_rate_limit_context(request_context: Dict) -> bool:
        """Additional rate limiting checks"""
        # Can implement additional business logic here
        return True