import uvicorn
import os

if __name__ == "__main__":
    # 환경변수에서 업로드 디렉토리 설정 읽기
    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    if not os.path.isabs(upload_dir):
        upload_dir = os.path.join(os.path.dirname(__file__), upload_dir)
    os.makedirs(upload_dir, exist_ok=True)
    
    # 환경변수에서 설정 읽기
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("DEBUG", "True").lower() == "true"
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=debug,
        reload_dirs=["./app"] if debug else None
    )