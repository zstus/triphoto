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

### Cross-Platform Network Access
The frontend API client (`services/api.ts`) automatically determines the correct API URL:
- Development: `http://localhost:8000/api`
- Network access: Uses current hostname with port 8000
- Production: Environment variable `REACT_APP_API_URL`

### Security Considerations
- CORS enabled for all origins (development setup)
- File type validation (images only)
- SQL injection prevention via parameterized queries
- UUID-based resource identification

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