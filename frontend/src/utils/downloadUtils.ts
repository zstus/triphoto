// iOS 및 모바일 디바이스 감지
export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// iOS Safari에서 이미지를 새 탭에서 열어 사용자가 저장할 수 있도록 함
export const downloadImageForIOS = async (imageUrl: string, filename: string): Promise<void> => {
  try {
    // 이미지를 새 탭에서 열기
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>${filename}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                margin: 0;
                padding: 20px;
                background: #000;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              }
              img {
                max-width: 100%;
                max-height: 80vh;
                object-fit: contain;
                border-radius: 8px;
              }
              .instructions {
                color: white;
                text-align: center;
                margin-top: 20px;
                padding: 15px;
                background: rgba(255,255,255,0.1);
                border-radius: 12px;
                backdrop-filter: blur(10px);
              }
              .instructions h3 {
                margin: 0 0 10px 0;
                font-size: 18px;
              }
              .instructions p {
                margin: 5px 0;
                font-size: 14px;
                opacity: 0.9;
              }
            </style>
          </head>
          <body>
            <img src="${imageUrl}" alt="${filename}" />
            <div class="instructions">
              <h3>📱 사진 저장하기</h3>
              <p>이미지를 길게 눌러서 "이미지 저장" 또는 "사진에 추가"를 선택하세요</p>
              <p>사진이 사진첩에 저장됩니다</p>
            </div>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  } catch (error) {
    console.error('Failed to open image for iOS download:', error);
    // 폴백: 일반적인 다운로드 방식 사용
    downloadImageGeneral(imageUrl, filename);
  }
};

// 일반적인 브라우저에서의 다운로드
export const downloadImageGeneral = async (imageUrl: string, filename: string): Promise<void> => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download image:', error);
    throw error;
  }
};

// 플랫폼에 따른 최적화된 다운로드
export const downloadImage = async (imageUrl: string, filename: string): Promise<void> => {
  if (isIOS()) {
    await downloadImageForIOS(imageUrl, filename);
  } else {
    await downloadImageGeneral(imageUrl, filename);
  }
};

// 이미지 미리보기 모달 (iOS용 대안)
export const showImagePreview = (imageUrl: string, filename: string, onClose: () => void): void => {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.9);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  `;

  const img = document.createElement('img');
  img.src = imageUrl;
  img.style.cssText = `
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: 8px;
  `;

  const instructions = document.createElement('div');
  instructions.style.cssText = `
    color: white;
    text-align: center;
    margin-top: 20px;
    padding: 15px;
    background: rgba(255,255,255,0.1);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    max-width: 300px;
  `;
  instructions.innerHTML = `
    <h3 style="margin: 0 0 10px 0; font-size: 18px;">📱 사진 저장하기</h3>
    <p style="margin: 5px 0; font-size: 14px; opacity: 0.9;">
      이미지를 길게 눌러서<br/>
      "이미지 저장" 또는 "사진에 추가"를<br/>
      선택하세요
    </p>
  `;

  const closeButton = document.createElement('button');
  closeButton.textContent = '✕ 닫기';
  closeButton.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(255,255,255,0.2);
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 20px;
    font-size: 14px;
    cursor: pointer;
    backdrop-filter: blur(10px);
  `;

  closeButton.onclick = () => {
    document.body.removeChild(overlay);
    onClose();
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
      onClose();
    }
  };

  overlay.appendChild(img);
  overlay.appendChild(instructions);
  overlay.appendChild(closeButton);
  document.body.appendChild(overlay);
};