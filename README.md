# 여행 사진 공유 플랫폼

여러 명이 함께 여행했을 때 각자 촬영한 사진을 공유하고, 좋아요를 누르고, 선택적으로 다운로드할 수 있는 웹 애플리케이션입니다.

## 주요 기능

- **방 생성/참가**: 여행의 주최자가 방을 생성하고, 다른 사람들이 방 ID로 참가
- **사진 업로드**: 각 참가자가 자신의 사진을 업로드 (EXIF 데이터 기반 날짜순 정렬)
- **사진 갤러리**: 업로드된 모든 사진을 날짜순으로 썸네일로 조회
- **좋아요 기능**: 각자 마음에 드는 사진에 좋아요 표시
- **선택적 다운로드**: 원하는 사진들을 선택하여 일괄 다운로드
- **다중 사용자 동시성**: 여러 사용자가 동시에 업로드/좋아요 가능

## 기술 스택

### 백엔드
- **FastAPI**: 고성능 Python 웹 프레임워크
- **SQLAlchemy**: ORM 및 데이터베이스 관리
- **SQLite**: 경량 데이터베이스
- **Pillow**: 이미지 처리 및 썸네일 생성
- **Databases**: 비동기 데이터베이스 연결

### 프론트엔드
- **React**: 사용자 인터페이스 라이브러리
- **TypeScript**: 타입 안전성
- **React Router**: 클라이언트 라우팅
- **Axios**: HTTP 클라이언트

## 설치 및 실행

### 백엔드 실행

```bash
cd backend

# 가상환경 생성 (선택사항)
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate

# 의존성 설치
pip install -r requirements.txt

# 서버 실행
python run_server.py
```

서버는 http://localhost:8000 에서 실행됩니다.

### 프론트엔드 실행

```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm start
```

프론트엔드는 http://localhost:3000 에서 실행됩니다.

## 사용 방법

1. **방 생성**: 여행 주최자가 방 이름, 설명, 자신의 이름을 입력하여 방 생성
2. **방 참가**: 다른 참가자들이 방 ID와 자신의 이름을 입력하여 방 참가
3. **사진 업로드**: 방에 참가한 사람들이 각자 여행 사진을 업로드
4. **사진 조회**: 업로드된 모든 사진이 촬영 날짜순으로 썸네일로 표시
5. **좋아요**: 마음에 드는 사진에 하트 아이콘 클릭
6. **다운로드**: 개별 사진 다운로드 또는 여러 사진 선택하여 일괄 다운로드

## API 문서

서버 실행 후 http://localhost:8000/docs 에서 Swagger UI로 API 문서를 확인할 수 있습니다.

## 주요 API 엔드포인트

### 방 관리
- `POST /api/rooms/` - 방 생성
- `GET /api/rooms/{room_id}` - 방 정보 조회
- `POST /api/rooms/{room_id}/join` - 방 참가
- `GET /api/rooms/` - 방 목록 조회

### 사진 관리
- `POST /api/photos/{room_id}/upload` - 사진 업로드
- `GET /api/photos/{room_id}` - 방의 사진 목록 조회
- `GET /api/photos/{room_id}/{photo_id}/download` - 사진 다운로드

### 좋아요
- `POST /api/likes/{photo_id}` - 좋아요 토글
- `GET /api/likes/{photo_id}` - 사진의 좋아요 목록
- `GET /api/likes/{photo_id}/check/{user_name}` - 사용자 좋아요 상태 확인

## 동시성 처리

- 데이터베이스 수준의 트랜잭션 보장
- 비동기 처리로 다중 사용자 동시 액세스 지원
- 파일 업로드 시 UUID 기반 파일명으로 충돌 방지
- 좋아요 토글 시 중복 방지 로직

## 보안 고려사항

- CORS 설정으로 프론트엔드에서만 API 접근 허용
- 파일 업로드 시 이미지 파일만 허용
- SQL Injection 방지를 위한 파라미터화된 쿼리 사용

## 디렉토리 구조

```
backend/
├── app/
│   ├── database/          # 데이터베이스 설정
│   ├── models/           # 데이터 모델 및 스키마
│   ├── routers/          # API 라우터
│   ├── services/         # 비즈니스 로직
│   └── main.py           # FastAPI 앱 설정
├── uploads/              # 업로드된 파일 저장소
└── requirements.txt      # Python 의존성

frontend/
├── src/
│   ├── components/       # React 컴포넌트
│   ├── pages/            # 페이지 컴포넌트
│   ├── services/         # API 클라이언트
│   └── types/            # TypeScript 타입 정의
└── package.json          # Node.js 의존성
```