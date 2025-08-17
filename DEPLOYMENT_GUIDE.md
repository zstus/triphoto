# 🚀 TripPhoto 단일 포트 배포 가이드 (zstus.synology.me:8095)

이 가이드는 zstus.synology.me:8095 도메인에서 단일 포트(HTTP)를 사용하여 TripPhoto 애플리케이션을 배포하는 방법을 설명합니다.

## 📋 사전 준비사항

- Ubuntu 서버 (18.04 이상)
- Node.js 18.x
- Python 3.11
- Nginx
- Git

## 🔄 GitHub에서 소스코드 받기

```bash
# 기존 소스가 있다면 백업
cd /opt/triphoto
git stash  # 로컬 변경사항 임시 저장

# 최신 소스 받기
git pull origin main

# 필요시 stash 복원
# git stash pop
```

## ⚙️ 1. 백엔드 환경 설정

### 1.1 환경변수 파일 생성
```bash
cd /opt/triphoto/backend

# .env.example을 .env로 복사
cp .env.example .env

# 환경변수 수정
nano .env
```

### 1.2 .env 파일 설정 예시
```bash
# 데이터베이스 설정
DATABASE_URL=sqlite:////var/lib/triphoto/triphoto.db

# 보안 설정 - 실제 운영에서는 변경!
SECRET_KEY=your-unique-secret-key-here
JWT_SECRET_KEY=your-unique-jwt-secret-key-here

# 서버 설정
HOST=0.0.0.0
PORT=8000
DEBUG=False
ENVIRONMENT=production

# CORS 설정 - zstus.synology.me:8095
ALLOWED_ORIGINS=http://zstus.synology.me:8095,https://zstus.synology.me:8095

# 파일 업로드 설정
UPLOAD_DIR=/opt/triphoto/uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp

# 보안 헤더
SECURITY_HEADERS_HSTS=False
SECURITY_HEADERS_CSP_CONNECT_SRC=http://zstus.synology.me:8095,https://zstus.synology.me:8095

# 로깅
LOG_LEVEL=INFO
LOG_FILE=/var/log/triphoto/backend.log
```

### 1.3 의존성 설치 및 가상환경 설정
```bash
cd /opt/triphoto/backend

# 가상환경 생성 (없다면)
python3.11 -m venv venv
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt
```

## 🎨 2. 프론트엔드 환경 설정

### 2.1 환경변수 파일 수정
```bash
cd /opt/triphoto/frontend

# .env.production 파일 수정
nano .env.production
```

### 2.2 .env.production 설정 예시
```bash
# zstus.synology.me:8095 설정
REACT_APP_API_URL=http://zstus.synology.me:8095/api
REACT_APP_IMAGE_BASE_URL=http://zstus.synology.me:8095
GENERATE_SOURCEMAP=false
REACT_APP_NODE_ENV=production
```

### 2.3 프론트엔드 빌드
```bash
cd /opt/triphoto/frontend

# 의존성 설치
npm install

# 프로덕션 빌드
npm run build

# 빌드 파일을 웹 서버 디렉토리로 복사
sudo cp -r build/* /var/www/triphoto/
sudo chown -R www-data:www-data /var/www/triphoto
```

## 🌐 3. Nginx 설정 (단일 포트)

### 3.1 Nginx 사이트 설정
```bash
sudo nano /etc/nginx/sites-available/triphoto
```

### 3.2 Nginx 설정 내용
```nginx
server {
    listen 80;
    server_name zstus.synology.me;

    # 보안 헤더
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # 파일 업로드 크기 제한
    client_max_body_size 10M;

    # 정적 파일 (React 앱)
    location / {
        root /var/www/triphoto;
        try_files $uri $uri/ /index.html;
        
        # 캐시 설정
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 프록시 (FastAPI)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
        proxy_cache_bypass $http_upgrade;
        
        # 타임아웃 설정
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 업로드된 파일 서빙 (FastAPI를 통해)
    location ~ ^/(uploads)/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
        
        # 캐시 설정
        expires 1d;
        add_header Cache-Control "public";
    }

    # 로그 설정
    access_log /var/log/nginx/triphoto_access.log;
    error_log /var/log/nginx/triphoto_error.log;
}
```

### 3.3 Nginx 사이트 활성화
```bash
# 사이트 활성화
sudo ln -sf /etc/nginx/sites-available/triphoto /etc/nginx/sites-enabled/

# 기본 사이트 비활성화
sudo rm -f /etc/nginx/sites-enabled/default

# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl reload nginx
```

## 🔧 4. 서비스 관리 설정

### 4.1 Supervisor 설정 (백엔드 서비스 관리)
```bash
sudo nano /etc/supervisor/conf.d/triphoto-backend.conf
```

### 4.2 Supervisor 설정 내용
```ini
[program:triphoto-backend]
command=/opt/triphoto/backend/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
directory=/opt/triphoto/backend
user=root
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/triphoto-backend.log
stderr_logfile=/var/log/supervisor/triphoto-backend-error.log
environment=PATH="/opt/triphoto/backend/venv/bin"
```

### 4.3 Supervisor 서비스 시작
```bash
# 설정 리로드
sudo supervisorctl reread
sudo supervisorctl update

# 서비스 시작
sudo supervisorctl start triphoto-backend

# 상태 확인
sudo supervisorctl status
```

## 🗄️ 5. 데이터베이스 설정

### 5.1 SQLite 데이터베이스 디렉토리 생성
```bash
# 데이터베이스 디렉토리 생성
sudo mkdir -p /var/lib/triphoto
sudo chown root:root /var/lib/triphoto
sudo chmod 755 /var/lib/triphoto
```

### 5.2 업로드 디렉토리 설정
```bash
# 업로드 디렉토리 권한 설정
sudo mkdir -p /opt/triphoto/uploads
sudo chown -R root:root /opt/triphoto/uploads
sudo chmod -R 755 /opt/triphoto/uploads
```

## ✅ 6. 배포 검증

### 6.1 서비스 상태 확인
```bash
# Nginx 상태 확인
sudo systemctl status nginx

# Supervisor 상태 확인
sudo supervisorctl status triphoto-backend

# 포트 사용 확인
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :8000
```

### 6.2 접속 테스트
```bash
# 로컬에서 API 테스트
curl -I http://localhost:8000/docs

# 웹사이트 접속 테스트
curl -I http://localhost:80

# 이미지 서빙 테스트 (실제 이미지 있을 때)
# curl -I http://localhost/uploads/room-id/image-filename.jpg
```

### 6.3 브라우저 테스트
1. `http://yourdomain.com` 접속
2. 룸 생성 및 접속
3. 이미지 업로드
4. 이미지 조회 및 다운로드
5. 개발자 도구에서 네트워크 탭 확인

## 🚨 7. 문제 해결

### 7.1 이미지가 보이지 않는 경우
```bash
# 1. 파일 권한 확인
ls -la /opt/triphoto/uploads/

# 2. FastAPI 로그 확인
sudo tail -f /var/log/supervisor/triphoto-backend-error.log

# 3. Nginx 로그 확인
sudo tail -f /var/log/nginx/triphoto_error.log

# 4. 이미지 URL 직접 테스트
curl -I http://localhost:8000/uploads/room-id/image-filename.jpg
```

### 7.2 API 접속 문제
```bash
# 1. 백엔드 서비스 상태 확인
sudo supervisorctl status triphoto-backend

# 2. 백엔드 재시작
sudo supervisorctl restart triphoto-backend

# 3. 포트 충돌 확인
sudo lsof -i :8000
```

### 7.3 환경변수 확인
```bash
# 백엔드 환경변수 확인
cd /opt/triphoto/backend
cat .env

# 프론트엔드 환경변수 확인
cd /opt/triphoto/frontend
cat .env.production
```

## 🔄 8. 업데이트 배포

### 8.1 자동 업데이트 스크립트
```bash
#!/bin/bash
# /usr/local/bin/triphoto-update.sh

cd /opt/triphoto

# 1. 백업
/usr/local/bin/triphoto-backup.sh

# 2. 최신 소스 받기
git pull origin main

# 3. 백엔드 의존성 업데이트 (필요시)
cd backend
source venv/bin/activate
pip install -r requirements.txt

# 4. 프론트엔드 빌드
cd ../frontend
npm install
npm run build
cp -r build/* /var/www/triphoto/
chown -R www-data:www-data /var/www/triphoto

# 5. 서비스 재시작
supervisorctl restart triphoto-backend
systemctl reload nginx

echo "배포 완료!"
```

### 8.2 업데이트 명령어
```bash
# 스크립트 실행 권한 부여
sudo chmod +x /usr/local/bin/triphoto-update.sh

# 업데이트 실행
sudo /usr/local/bin/triphoto-update.sh
```

## 📝 중요 참고사항

1. **도메인 설정**: `zstus.synology.me:8095`로 설정 완료
2. **보안 키**: `.env` 파일의 SECRET_KEY와 JWT_SECRET_KEY 변경
3. **Docker 포트 매핑**: Synology Docker에서 Host Port 8095 → Container Port 80 확인
4. **백업**: 정기적인 데이터베이스 및 파일 백업
5. **모니터링**: 로그 파일 정기 확인 및 모니터링 설정

이제 zstus.synology.me:8095에서 단일 포트를 통해 이미지가 정상적으로 표시되는 TripPhoto 서비스가 배포됩니다! 🎉