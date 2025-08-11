# Git을 통한 소스 배포 설정 가이드

## 1. 로컬 환경에서 Git 저장소 초기화

### 1.1 현재 프로젝트 디렉토리에서 Git 초기화
```bash
cd /Users/zstus_mini/Desktop/dev/triphoto

# Git 저장소 초기화
git init

# Git 사용자 정보 설정 (최초 1회만)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 또는 이 저장소에만 적용
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### 1.2 .gitignore 파일 생성
```bash
# .gitignore 파일 생성
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
env.bak/
venv.bak/
backend/venv/
*.egg-info/
dist/
build/

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
frontend/build/
frontend/node_modules/

# Database
*.db
*.sqlite
*.sqlite3
travel_photos.db

# Environment variables
.env
.env.local
.env.production
backend/.env

# Logs
*.log
logs/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Upload files
uploads/
backend/uploads/

# Backup files
*.bak
*.backup

# Temporary files
*.tmp
*.temp
EOF
```

### 1.3 초기 커밋 생성
```bash
# 모든 파일 추가
git add .

# 초기 커밋
git commit -m "Initial commit: Korean travel photo sharing platform

🚀 Features:
- FastAPI backend with SQLAlchemy
- React frontend with TypeScript
- Photo upload/download functionality
- Like/dislike system
- Room-based photo sharing
- Mobile responsive design

🔧 Tech Stack:
- Backend: Python, FastAPI, SQLite/PostgreSQL
- Frontend: React 19, TypeScript, Axios
- Database: SQLAlchemy ORM
- File Storage: UUID-based naming

📝 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

## 2. GitHub 저장소 생성 및 연결

### 2.1 GitHub에서 새 저장소 생성
1. GitHub (https://github.com) 로그인
2. "New repository" 클릭
3. 저장소 정보 입력:
   - Repository name: `triphoto` (또는 원하는 이름)
   - Description: `Korean travel photo sharing platform`
   - Public/Private 선택
   - **"Add a README file" 체크 해제** (이미 로컬에 파일들이 있으므로)
   - **"Add .gitignore" 선택 안함** (이미 생성했으므로)
   - **"Choose a license" 선택 안함** (나중에 추가 가능)

### 2.2 로컬 저장소와 GitHub 연결
```bash
# GitHub 저장소를 원격 저장소로 추가 (GitHub에서 제공하는 URL 사용)
git remote add origin https://github.com/YOUR_USERNAME/triphoto.git

# 또는 SSH 사용시 (SSH 키가 설정되어 있는 경우)
# git remote add origin git@github.com:YOUR_USERNAME/triphoto.git

# 원격 저장소 확인
git remote -v

# main 브랜치로 변경 (GitHub 기본 브랜치에 맞춤)
git branch -M main

# 첫 푸시
git push -u origin main
```

### 2.3 SSH 키 설정 (권장)
```bash
# SSH 키가 없는 경우 생성
ssh-keygen -t ed25519 -C "your.email@example.com"

# SSH 에이전트에 키 추가
ssh-add ~/.ssh/id_ed25519

# 공개 키 복사
cat ~/.ssh/id_ed25519.pub

# GitHub Settings > SSH and GPG keys에서 "New SSH key" 클릭하여 공개 키 추가
```

## 3. 프로덕션 환경에서 배포용 설정

### 3.1 환경별 설정 파일 분리
```bash
# 프로덕션용 환경 설정 예시 파일 생성
cat > backend/.env.production << 'EOF'
# 프로덕션 환경 변수 (실제 배포시 값 수정 필요)
DATABASE_URL=postgresql://triphoto:YOUR_SECURE_PASSWORD@localhost/triphoto_db
SECRET_KEY=your-production-secret-key
JWT_SECRET_KEY=your-production-jwt-secret
DEBUG=False
ENVIRONMENT=production
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
UPLOAD_DIR=/opt/triphoto/uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp
LOG_LEVEL=INFO
LOG_FILE=/var/log/triphoto/backend.log
EOF

# 프론트엔드 프로덕션 설정
cat > frontend/.env.production << 'EOF'
REACT_APP_API_URL=https://yourdomain.com/api
GENERATE_SOURCEMAP=false
EOF
```

### 3.2 배포 스크립트 생성
```bash
# 배포 스크립트 생성
cat > deploy.sh << 'EOF'
#!/bin/bash

# 트립포토 프로덕션 배포 스크립트

set -e  # 에러 발생시 스크립트 중단

echo "🚀 트립포토 배포 시작..."

# 1. 백업 실행
echo "📦 백업 생성 중..."
if [ -f "/usr/local/bin/triphoto-backup.sh" ]; then
    /usr/local/bin/triphoto-backup.sh
fi

# 2. 소스 코드 업데이트
echo "📥 소스 코드 업데이트 중..."
cd /opt/triphoto
git pull origin main

# 3. 백엔드 의존성 업데이트
echo "🔧 백엔드 의존성 업데이트 중..."
cd backend
source venv/bin/activate
pip install -r requirements.txt

# 4. 프론트엔드 빌드
echo "🏗️ 프론트엔드 빌드 중..."
cd ../frontend
npm install
npm run build

# 빌드 성공 확인
if [ -d "build" ] && [ -f "build/index.html" ]; then
    echo "✅ React 빌드 성공"
else
    echo "❌ React 빌드 실패"
    exit 1
fi

# 5. 정적 파일 배포
echo "📁 정적 파일 배포 중..."
cp -r build/* /var/www/triphoto/
chown -R www-data:www-data /var/www/triphoto

# 6. 서비스 재시작
echo "🔄 서비스 재시작 중..."
supervisorctl restart triphoto-backend
service nginx reload

# 7. 서비스 상태 확인
echo "🔍 서비스 상태 확인 중..."
sleep 5
if supervisorctl status triphoto-backend | grep -q "RUNNING"; then
    echo "✅ 백엔드 서비스 정상 동작"
else
    echo "❌ 백엔드 서비스 오류"
    exit 1
fi

if service nginx status | grep -q "active"; then
    echo "✅ Nginx 서비스 정상 동작"
else
    echo "❌ Nginx 서비스 오류"
    exit 1
fi

echo "🎉 배포 완료!"
echo "📝 웹사이트: https://yourdomain.com"
echo "📚 API 문서: https://yourdomain.com/api/docs"

EOF

# 실행 권한 부여
chmod +x deploy.sh

# .gitignore에 민감한 정보 추가
echo "" >> .gitignore
echo "# Deployment" >> .gitignore
echo "deploy.sh" >> .gitignore
echo ".env.production" >> .gitignore
```

## 4. Git을 통한 배포 과정

### 4.1 개발 환경에서 변경사항 커밋 및 푸시
```bash
# 변경사항 확인
git status
git diff

# 변경사항 추가
git add .

# 커밋 (의미있는 메시지 작성)
git commit -m "feat: Add new feature for photo filtering

- Implement dislike-based photo hiding
- Add photo count display
- Update mobile responsive design
- Fix ESLint warnings

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# GitHub에 푸시
git push origin main
```

### 4.2 프로덕션 서버에서 배포
```bash
# 프로덕션 서버에 SSH 접속
ssh root@your-server-ip

# 최초 배포시에만: 저장소 클론
git clone https://github.com/YOUR_USERNAME/triphoto.git /opt/triphoto
cd /opt/triphoto

# 이후 배포시: 업데이트
cd /opt/triphoto
git pull origin main

# 배포 스크립트 실행 (서버에 별도 작성)
# ./deploy.sh
```

## 5. 브랜치 전략 (권장)

### 5.1 개발용 브랜치 생성
```bash
# 개발용 브랜치 생성 및 전환
git checkout -b develop
git push -u origin develop

# 기능 개발시
git checkout -b feature/new-feature
git add .
git commit -m "feat: implement new feature"
git push -u origin feature/new-feature

# GitHub에서 Pull Request 생성 후 develop 브랜치로 머지
```

### 5.2 릴리즈 전략
```bash
# 릴리즈 준비
git checkout develop
git checkout -b release/v1.0.0

# 릴리즈 버전 커밋
git commit -m "chore: prepare release v1.0.0"
git push -u origin release/v1.0.0

# main 브랜치로 머지 후 태그 생성
git checkout main
git merge release/v1.0.0
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin main
git push origin v1.0.0
```

## 6. 자주 사용하는 Git 명령어

```bash
# 상태 확인
git status
git log --oneline -10

# 변경사항 확인
git diff
git diff --staged

# 브랜치 관리
git branch -a          # 모든 브랜치 확인
git checkout branch-name  # 브랜치 전환
git checkout -b new-branch  # 새 브랜치 생성 및 전환

# 되돌리기
git reset --soft HEAD~1   # 마지막 커밋 취소 (변경사항 유지)
git reset --hard HEAD~1   # 마지막 커밋 완전 삭제

# 원격 저장소 업데이트
git fetch origin        # 원격 변경사항 가져오기
git pull origin main    # 원격 변경사항 가져와서 머지
```

## 7. 보안 고려사항

```bash
# GitHub Personal Access Token 사용 (권장)
# GitHub Settings > Developer settings > Personal access tokens에서 생성

# 환경 변수로 토큰 저장
export GITHUB_TOKEN="your-personal-access-token"

# 토큰을 사용한 클론
git clone https://YOUR_USERNAME:$GITHUB_TOKEN@github.com/YOUR_USERNAME/triphoto.git
```

## 8. 문제 해결

### 8.1 인증 오류
```bash
# HTTP 인증 정보 캐시 삭제
git config --global --unset credential.helper
git config --unset credential.helper

# 새로 인증
git push origin main
```

### 8.2 머지 충돌
```bash
# 충돌 발생시
git status  # 충돌 파일 확인
# 충돌 파일 편집 후
git add .
git commit -m "resolve merge conflict"
```

이제 Git을 통해 안전하고 체계적으로 소스를 관리하고 배포할 수 있습니다!