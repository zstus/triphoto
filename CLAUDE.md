# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Korean travel photo sharing platform that allows multiple travelers to upload, view, like/dislike, and download photos from shared trip experiences. The application uses room-based organization where users join rooms using room IDs to share photos collaboratively.

**Tech Stack:**
- **Backend**: FastAPI, SQLAlchemy, SQLite, Pillow (Python)
- **Frontend**: React 19, TypeScript, React Router, Axios
- **Database**: SQLite with UUID-based primary keys
- **File Storage**: Local filesystem with UUID naming for photos

## Development Commands

### Backend Development
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run development server (with hot reload)
python run_server.py

# Server runs on http://localhost:8000
# API docs available at http://localhost:8000/docs
```

### Frontend Development
```bash
cd frontend

# Install dependencies  
npm install

# Run development server
npm start              # localhost only
npm run start-host     # accessible from other devices

# Frontend runs on http://localhost:3000

# Build for production
npm run build

# Run tests
npm test
```

### Full Stack Development
```bash
# Install all dependencies (from project root)
npm run install-all

# Run both backend and frontend concurrently
npm run dev
```

## Architecture Overview

### Data Models & Relationships
- **Room**: Contains travel photos, has UUID id, creator info, and activity status
- **Photo**: Belongs to room, stores file info, EXIF data, and taken_at timestamp  
- **Like/Dislike**: User reactions to photos, prevents duplicate votes per user

### Key Features Implementation
- **UUID-based file naming**: Prevents filename conflicts during concurrent uploads
- **EXIF date extraction**: Photos sorted by actual capture time using Pillow
- **Thumbnail generation**: Automatic thumbnail creation for gallery performance
- **Multi-user concurrency**: Database transactions and async processing
- **File validation**: Images only, content-type checking
- **Auto-login for creators**: Room creators automatically login after creation without login modal
- **Participant tracking**: Separate participant system tracks all room members, not just photo uploaders

### API Structure
```
/api/rooms/           # Room management (create, join, list)
/api/photos/          # Photo upload, retrieval, download
/api/likes/           # Like toggling and status checking  
/api/dislikes/        # Dislike functionality
```

### File Organization
```
backend/app/
├── database/         # SQLAlchemy setup, database connection
├── models/           # Data models and Pydantic schemas
├── routers/          # FastAPI route handlers by domain
├── services/         # Business logic (photo processing, etc.)
└── main.py          # FastAPI app configuration

frontend/src/
├── components/       # Reusable React components (PhotoGallery, etc.)
├── pages/           # Route-level page components  
├── services/        # API client with environment-aware URL handling
├── types/           # TypeScript interfaces
└── utils/           # Helper functions (download utilities)
```

## Important Implementation Details

### Database Configuration
- Uses async SQLite with databases library for non-blocking operations
- UUID primary keys across all models for better distribution and security
- File hash storage to detect duplicate uploads

### Photo Processing Pipeline
1. File validation (content-type, size limits)
2. UUID generation for safe filename
3. EXIF data extraction for proper date sorting
4. Thumbnail generation for gallery performance
5. Database record creation with metadata

### Single-Port Image Serving Solution

#### Problem Background
Images were uploading successfully but failing to display with 404 errors. The issue was a combination of path mismatches and Nginx proxy configuration.

#### Critical Fix: Path Resolution
**FastAPI Configuration** (`backend/app/main.py`):
- Files stored in `/opt/triphoto/backend/uploads/` not `/opt/triphoto/uploads/`
- Added absolute path conversion for StaticFiles mounting
- Added debugging logs for troubleshooting

```python
# Environment-based upload directory configuration
uploads_dir = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "..", "uploads"))

# 절대 경로로 변환 - Critical for production deployment
uploads_dir = os.path.abspath(uploads_dir)

# StaticFiles 마운트
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
```

#### Nginx Reverse Proxy Configuration
**Critical Fix** (`sites-available.txt`):
- Changed from problematic regex pattern to simple location block
- Direct proxy pass to FastAPI StaticFiles

```nginx
# 업로드된 파일 서빙 (FastAPI를 통해) - 단일 포트 최적화
location /uploads/ {
    proxy_pass http://127.0.0.1:8000/uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto http;
    
    # 이미지 캐시 설정 (성능 최적화)
    expires 1d;
    add_header Cache-Control "public";
}
```

#### Environment Configuration
**Production Setup** (`zstus.synology.me:8095`):

Backend (`.env`):
```env
UPLOAD_DIR=uploads
ALLOWED_ORIGINS=http://zstus.synology.me:8095,https://zstus.synology.me:8095
SECURITY_HEADERS_CSP_CONNECT_SRC=http://zstus.synology.me:8095 https://zstus.synology.me:8095
SECURITY_HEADERS_HSTS=false
```

Frontend (`.env.production`):
```env
REACT_APP_API_URL=http://zstus.synology.me:8095/api
```

#### Architecture Flow
1. **Frontend Request**: `zstus.synology.me:8095/uploads/file.jpg`
2. **Nginx Proxy**: Routes to `127.0.0.1:8000/uploads/file.jpg`
3. **FastAPI StaticFiles**: Serves from absolute path `/opt/triphoto/backend/uploads/`
4. **File Storage**: Actual files in `/opt/triphoto/backend/uploads/room_id/file.jpg`

#### Debugging Tools
Added debug endpoint for troubleshooting:
```python
@app.get("/debug/uploads")
async def debug_uploads(request: Request):
    # Returns upload directory status, contents, and path information
```

### Cross-Platform Network Access
The frontend API client (`services/api.ts`) automatically determines the correct API URL:
- Development: `http://localhost:8000/api`
- Network access: Uses current hostname with port 8000
- Production: Environment variable `REACT_APP_API_URL`

### Security Considerations
- CORS enabled for specific origins via environment variables
- File type validation (images only)
- SQL injection prevention via parameterized queries
- UUID-based resource identification
- Path traversal protection in file serving

## Common Development Patterns

### Adding New API Endpoints
1. Create router function in appropriate `/routers/` file
2. Define Pydantic schemas in `/models/schemas.py`
3. Add business logic to `/services/` if complex
4. Update frontend API client in `services/api.ts`
5. Add TypeScript types in `types/index.ts`

### Database Schema Changes
1. Modify models in `models/models.py`
2. Delete existing `travel_photos.db` for development
3. Restart backend server to recreate tables
4. Update corresponding Pydantic schemas

### Frontend Component Development
- Uses React 19 with modern hooks and concurrent features
- TypeScript strict mode enabled
- Components are mobile-responsive (see `MobileLayout.tsx`)
- API calls use async/await pattern with proper error handling

### Auto-Login Flow for Room Creators
When a user creates a new room, they are automatically logged in without seeing the login modal:

**CreateRoomPage Process**:
1. User fills out room creation form with their name
2. Room creation API call creates room and adds creator as first participant
3. Creator name is saved to both global and room-specific localStorage
4. Navigation to room page includes `?creator=true` parameter

**RoomPage Auto-Login Logic**:
1. Detects `creator=true` parameter from URL
2. Checks if room-specific username exists in localStorage
3. If valid, automatically calls `handleLogin()` with creator name
4. Removes `creator` parameter from URL for clean navigation
5. Falls back to login modal if auto-login setup fails

**Storage Strategy**:
- `localStorage.userName`: Global username across all rooms
- `localStorage.roomUsers`: Object mapping room IDs to usernames
- `sessionStorage.userName`: Session-specific backup

This eliminates the friction of room creators having to login immediately after creating their room.