import secrets
import hashlib
import hmac
from typing import Optional
from fastapi import HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

logger = logging.getLogger(__name__)

class CSRFProtection:
    """CSRF Token generation and validation"""
    
    @staticmethod
    def generate_csrf_token() -> str:
        """Generate a secure CSRF token"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def validate_csrf_token(token: str, session_token: str) -> bool:
        """Validate CSRF token against session"""
        if not token or not session_token:
            return False
        return hmac.compare_digest(token, session_token)

class SecurityUtils:
    """General security utilities"""
    
    @staticmethod
    def generate_secure_filename(original_filename: str) -> str:
        """Generate a secure filename to prevent path traversal"""
        import os
        import uuid
        
        # Get file extension
        _, ext = os.path.splitext(original_filename)
        
        # Generate unique filename
        secure_name = f"{uuid.uuid4()}{ext.lower()}"
        return secure_name
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using bcrypt"""
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def generate_api_key() -> str:
        """Generate a secure API key"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def constant_time_compare(a: str, b: str) -> bool:
        """Constant time string comparison to prevent timing attacks"""
        return hmac.compare_digest(a, b)

class SecurityHeaders:
    """Security headers management"""
    
    @staticmethod
    def get_security_headers() -> dict:
        """Get all security headers"""
        from ..config.security import SecurityConfig
        return SecurityConfig.SECURITY_HEADERS
    
    @staticmethod
    def apply_security_headers(response, headers: Optional[dict] = None):
        """Apply security headers to response"""
        if headers is None:
            headers = SecurityHeaders.get_security_headers()
        
        for header, value in headers.items():
            response.headers[header] = value
        
        return response

class RateLimitUtils:
    """Rate limiting utilities"""
    
    @staticmethod
    def get_client_ip(request: Request) -> str:
        """Get client IP address from request"""
        # Check for forwarded headers in reverse proxy setups
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        return request.client.host if request.client else "unknown"
    
    @staticmethod
    def is_suspicious_request(request: Request) -> bool:
        """Basic suspicious request detection"""
        user_agent = request.headers.get("User-Agent", "")
        
        # Check for common bot patterns
        suspicious_agents = [
            "sqlmap", "nmap", "masscan", "zmap", "curl/7", "wget/",
            "python-requests", "python-urllib", "nikto", "scanner"
        ]
        
        user_agent_lower = user_agent.lower()
        for agent in suspicious_agents:
            if agent in user_agent_lower:
                return True
        
        # Check for missing User-Agent (common in automated attacks)
        if not user_agent:
            return True
        
        return False

class FileSecurityUtils:
    """File upload security utilities"""
    
    @staticmethod
    def validate_file_type(filename: str, allowed_types: set) -> bool:
        """Validate file type by extension"""
        import os
        _, ext = os.path.splitext(filename.lower())
        return ext in allowed_types
    
    @staticmethod
    def scan_file_for_malware(file_path: str) -> bool:
        """Basic file security scanning"""
        # In a real implementation, you would integrate with antivirus APIs
        # For now, just check file size and basic patterns
        import os
        
        try:
            file_size = os.path.getsize(file_path)
            
            # Check if file is too large (potential zip bomb)
            if file_size > 50 * 1024 * 1024:  # 50MB
                return False
            
            # Read first few bytes to check for malicious patterns
            with open(file_path, 'rb') as f:
                header = f.read(1024)
                
                # Check for executable signatures
                dangerous_signatures = [
                    b'\x4d\x5a',  # PE executable
                    b'\x7f\x45\x4c\x46',  # ELF executable
                    b'\xca\xfe\xba\xbe',  # Mach-O executable
                    b'<?php',  # PHP code
                    b'<script',  # JavaScript
                ]
                
                for sig in dangerous_signatures:
                    if sig in header.lower():
                        return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error scanning file {file_path}: {e}")
            return False
    
    @staticmethod
    def sanitize_upload_path(base_path: str, filename: str) -> str:
        """Sanitize file upload path to prevent directory traversal"""
        import os
        from pathlib import Path
        
        # Remove any path separators from filename
        clean_filename = os.path.basename(filename)
        
        # Create full path and resolve to prevent traversal
        full_path = Path(base_path) / clean_filename
        resolved_path = full_path.resolve()
        
        # Ensure the resolved path is within the base directory
        base_resolved = Path(base_path).resolve()
        if not str(resolved_path).startswith(str(base_resolved)):
            raise ValueError("Invalid file path")
        
        return str(resolved_path)