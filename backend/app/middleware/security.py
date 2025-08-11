from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import re
import logging
from typing import List, Pattern

logger = logging.getLogger(__name__)

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Advanced security middleware with input validation and attack prevention
    """
    
    def __init__(self, app, **kwargs):
        super().__init__(app)
        self.suspicious_patterns = self._compile_patterns()
    
    def _compile_patterns(self) -> List[Pattern]:
        """Compile suspicious patterns for input validation"""
        patterns = [
            # SQL Injection patterns
            r"(?i)(union\s+select|drop\s+table|insert\s+into|delete\s+from)",
            r"(?i)(exec\s*\(|execute\s*\(|sp_executesql)",
            r"(?i)(\'\s*or\s*\'|\".*or.*\"|\'\s*=\s*\')",
            
            # XSS patterns
            r"(?i)(<script.*?>|javascript:|onload=|onerror=)",
            r"(?i)(eval\s*\(|expression\s*\(|vbscript:|data:text/html)",
            
            # Command injection
            r"(?i)(&&\s*|;\s*|\|\s*)(cat|ls|pwd|whoami|id|uname)",
            r"(?i)(wget\s|curl\s|nc\s|netcat\s)",
            
            # Path traversal
            r"(\.\./|\.\.\\\\|%2e%2e%2f|%2e%2e%5c)",
            
            # LDAP injection
            r"(\*\)|\(\*|\)\(|\(\|)",
        ]
        return [re.compile(pattern) for pattern in patterns]
    
    async def dispatch(self, request: Request, call_next):
        # Skip security checks for health and docs endpoints
        if request.url.path in ["/health", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        # Validate request
        if await self._is_suspicious_request(request):
            logger.warning(f"Suspicious request blocked: {request.url}")
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid request format"}
            )
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        self._add_security_headers(response)
        
        return response
    
    async def _is_suspicious_request(self, request: Request) -> bool:
        """Check if request contains suspicious patterns"""
        try:
            # Check URL parameters
            query_string = str(request.query_params)
            if self._contains_suspicious_pattern(query_string):
                return True
            
            # Check headers
            for header_name, header_value in request.headers.items():
                if self._contains_suspicious_pattern(header_value):
                    return True
            
            # Check body for POST/PUT requests
            if request.method in ["POST", "PUT", "PATCH"]:
                content_type = request.headers.get("content-type", "")
                if "application/json" in content_type:
                    # For JSON bodies, we'll check in the route handlers
                    pass
                elif "multipart/form-data" in content_type:
                    # File uploads - basic checks only
                    pass
        
        except Exception as e:
            logger.error(f"Error in security validation: {e}")
            return False
        
        return False
    
    def _contains_suspicious_pattern(self, text: str) -> bool:
        """Check if text contains any suspicious patterns"""
        if not text:
            return False
        
        for pattern in self.suspicious_patterns:
            if pattern.search(text):
                return True
        return False
    
    def _add_security_headers(self, response: Response):
        """Add security headers to response"""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"