# 환경별 데이터베이스 설정 가이드

이 프로젝트는 하나의 소스코드로 개발환경과 배포환경을 모두 지원합니다.

## 개발환경 (기본값)

환경변수 설정 없이 그대로 사용하면 됩니다:
- 데이터베이스: `backend/travel_photos.db` (SQLite)
- 기존 개발 방식과 동일

```bash
cd backend
python -m uvicorn app.main:app --reload
```

## 배포환경 (환경변수 사용)

`deploy.txt`를 따라 진행하면 자동으로 설정됩니다:
- 데이터베이스: `/var/lib/triphoto/triphoto.db` (SQLite)
- `.env` 파일을 통한 환경변수 설정

```bash
# deploy.txt의 .env 파일 자동 생성
DATABASE_URL=sqlite:////var/lib/triphoto/triphoto.db
```

## 환경변수 우선순위

1. **시스템 환경변수** (최우선)
2. **`.env` 파일** (있으면 로드)
3. **기본값** (개발용 기본 설정)

## 수동 환경변수 설정 (선택사항)

### 개발환경에서 다른 경로 사용하려면:

```bash
export DATABASE_URL="sqlite:///./custom_database.db"
python -m uvicorn app.main:app --reload
```

### PostgreSQL 사용하려면:

```bash
export DATABASE_URL="postgresql://user:password@localhost/dbname"
```

## 장점

✅ **하나의 소스코드**로 모든 환경 관리
✅ **기존 개발 방식** 그대로 유지 (환경변수 없으면 기본값 사용)
✅ **배포 시 자동 설정** (deploy.txt가 환경변수 생성)
✅ **유연성** (필요시 환경변수로 커스터마이징 가능)

## 주의사항

- 개발환경: 환경변수 설정 없이 기본값 사용 권장
- 배포환경: deploy.txt를 따라 진행하면 자동으로 올바른 환경변수 설정
- PostgreSQL 사용 시: deploy.txt에서 주석 해제 후 사용