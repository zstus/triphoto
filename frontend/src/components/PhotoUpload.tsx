import React, { useState, useRef } from 'react';
import { photoApi, validateInput, sanitizeInput } from '../services/api';
import { colors, spacing, shadows } from '../styles/responsive';

interface PhotoUploadProps {
  roomId: string;
  onUploadSuccess: () => void;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ roomId, onUploadSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dragOver, setDragOver] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (files: FileList) => {
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    Array.from(files).forEach(file => {
      const validation = validateInput.file(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });
    
    setValidationErrors(errors);
    
    if (validFiles.length > 0) {
      const dt = new DataTransfer();
      validFiles.forEach(file => dt.items.add(file));
      setSelectedFiles(dt.files);
    }
    
    if (errors.length > 0) {
      setTimeout(() => setValidationErrors([]), 5000); // Clear errors after 5 seconds
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      processFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files) {
      processFiles(files);
    }
  };

  // Batch upload utility function
  const uploadFilesInBatches = async (files: File[], userName: string) => {
    const BATCH_SIZE = 5; // 5개씩 배치 업로드
    const BATCH_DELAY = 1000; // 배치 간 1초 대기
    
    const totalFiles = files.length;
    let completedFiles = 0;
    let skippedFiles = 0;
    const errors: string[] = [];

    // 파일을 배치로 분할
    const batches = [];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      batches.push(files.slice(i, i + BATCH_SIZE));
    }

    // 각 배치를 순차적으로 처리
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📦 배치 ${batchIndex + 1}/${batches.length} 업로드 시작 (${batch.length}개 파일)`);

      // 배치 내 파일들을 병렬 업로드
      const batchPromises = batch.map(async (file) => {
        try {
          await photoApi.uploadPhoto(roomId, file, userName);
          return { success: true, file, error: null };
        } catch (error: any) {
          return { success: false, file, error };
        }
      });

      // 배치 완료 대기
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 배치 결과 처리
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { success, file, error } = result.value;
          if (success) {
            completedFiles++;
          } else {
            if (error.response?.status === 409) {
              skippedFiles++;
              errors.push(`${file.name}: 이미 업로드된 사진입니다`);
            } else if (error.response?.status === 400) {
              errors.push(`${file.name}: ${error.response.data?.detail || '잘못된 요청'}`);
            } else if (error.response?.status === 413) {
              errors.push(`${file.name}: 파일 크기가 너무 큽니다 (최대 10MB)`);
            } else if (error.response?.status === 429) {
              errors.push(`${file.name}: 요청이 너무 많습니다. 잠시 후 다시 시도해주세요`);
            } else if (error.response?.status === 419) {
              errors.push(`${file.name}: 보안 토큰 오류. 페이지를 새로고침해주세요`);
            } else {
              errors.push(`${file.name}: 업로드 실패 (${error.message || '알 수 없는 오류'})`);
            }
          }
        } else {
          // Promise.allSettled에서 rejected된 경우
          errors.push(`알 수 없는 파일: 처리 실패`);
        }
      });

      // 진행률 업데이트
      const processedFiles = completedFiles + skippedFiles + errors.length;
      setUploadProgress((processedFiles / totalFiles) * 100);

      // 마지막 배치가 아니라면 대기
      if (batchIndex < batches.length - 1) {
        console.log(`⏳ 다음 배치까지 ${BATCH_DELAY/1000}초 대기...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    return { completedFiles, skippedFiles, errors };
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const userName = localStorage.getItem('userName');
    if (!userName) {
      alert('이름을 입력해주세요.');
      return;
    }

    // Validate username
    if (!validateInput.userName(userName)) {
      alert('유효하지 않은 사용자 이름입니다. 2-50자의 한글, 영문, 숫자, ., _, - 만 사용 가능합니다.');
      return;
    }

    // Validate room ID
    if (!validateInput.roomId(roomId)) {
      alert('유효하지 않은 방 ID입니다.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setValidationErrors([]);

    try {
      const files = Array.from(selectedFiles);
      console.log(`🚀 ${files.length}개 파일 배치 업로드 시작`);
      
      const { completedFiles, skippedFiles, errors } = await uploadFilesInBatches(files, userName);

      setSelectedFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      onUploadSuccess();
      
      let message = '';
      if (completedFiles > 0) {
        message += `${completedFiles}개의 사진이 성공적으로 업로드되었습니다! 📸`;
      }
      if (skippedFiles > 0) {
        message += `\n${skippedFiles}개의 중복 사진은 건너뛰었습니다. 🔄`;
      }
      if (errors.length > skippedFiles) {
        message += `\n${errors.length - skippedFiles}개의 사진 업로드에 실패했습니다. ❌`;
      }
      
      alert(message || '업로드할 새로운 사진이 없습니다.');
    } catch (error) {
      alert('사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeFile = (index: number) => {
    if (!selectedFiles) return;
    
    const dt = new DataTransfer();
    Array.from(selectedFiles).forEach((file, i) => {
      if (i !== index) dt.items.add(file);
    });
    setSelectedFiles(dt.files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      {/* 드래그 앤 드롭 영역 */}
      <div 
        style={{ 
          border: `2px dashed ${dragOver ? colors.primary : colors.border}`,
          borderRadius: '16px',
          padding: spacing.xl,
          textAlign: 'center',
          backgroundColor: dragOver ? `${colors.primary}10` : colors.background,
          marginBottom: spacing.lg,
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={{ fontSize: '48px', marginBottom: spacing.md }}>
          {dragOver ? '📤' : '📷'}
        </div>
        <h3 style={{ 
          margin: `0 0 ${spacing.sm} 0`,
          fontSize: '18px',
          fontWeight: '600',
          color: colors.text
        }}>
          사진 업로드
        </h3>
        <p style={{ 
          color: colors.textMuted,
          margin: 0,
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          {dragOver ? '파일을 여기에 놓으세요' : '클릭하거나 파일을 드래그해서 업로드'}
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* 유효성 검사 오류 메시지 */}
      {validationErrors.length > 0 && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          padding: spacing.md,
          marginBottom: spacing.lg
        }}>
          <div style={{
            color: '#dc2626',
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: spacing.xs
          }}>
            ⚠️ 파일 유효성 검사 오류:
          </div>
          {validationErrors.map((error, index) => (
            <div key={index} style={{
              color: '#dc2626',
              fontSize: '13px',
              marginBottom: '4px'
            }}>
              • {error}
            </div>
          ))}
        </div>
      )}
      
      {/* 선택된 파일 목록 */}
      {selectedFiles && selectedFiles.length > 0 && (
        <div style={{
          backgroundColor: colors.background,
          borderRadius: '16px',
          padding: spacing.lg,
          marginBottom: spacing.lg,
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.sm
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md
          }}>
            <h4 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: colors.text
            }}>
              선택된 파일 ({selectedFiles.length}개)
            </h4>
            <button
              onClick={() => {
                setSelectedFiles(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              style={{
                background: 'none',
                border: 'none',
                color: colors.danger,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              전체 삭제
            </button>
          </div>
          
          <div style={{ 
            maxHeight: '200px', 
            overflowY: 'auto'
          }}>
            {Array.from(selectedFiles).map((file, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: spacing.sm,
                marginBottom: spacing.xs,
                backgroundColor: colors.light,
                borderRadius: '8px',
                fontSize: '14px'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontWeight: '500',
                    color: colors.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {file.name}
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    color: colors.textMuted,
                    marginTop: '2px'
                  }}>
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.danger,
                    cursor: 'pointer',
                    fontSize: '20px',
                    padding: spacing.xs,
                    marginLeft: spacing.sm
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 업로드 진행률 */}
      {uploading && (
        <div style={{
          backgroundColor: colors.background,
          borderRadius: '16px',
          padding: spacing.lg,
          marginBottom: spacing.lg,
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.sm
        }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.sm
          }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
              업로드 중...
            </span>
            <span style={{ fontSize: '14px', color: colors.textMuted }}>
              {Math.round(uploadProgress)}%
            </span>
          </div>
          <div style={{ 
            width: '100%', 
            height: '8px', 
            backgroundColor: colors.light,
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${uploadProgress}%`,
              height: '100%',
              backgroundColor: colors.primary,
              transition: 'width 0.3s ease',
              borderRadius: '4px'
            }} />
          </div>
        </div>
      )}
      
      {/* 업로드 버튼 */}
      <button
        onClick={handleUpload}
        disabled={!selectedFiles || selectedFiles.length === 0 || uploading}
        style={{
          width: '100%',
          padding: spacing.md,
          backgroundColor: selectedFiles && selectedFiles.length > 0 && !uploading ? colors.primary : colors.secondary,
          color: 'white',
          border: 'none',
          borderRadius: '16px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: selectedFiles && selectedFiles.length > 0 && !uploading ? 'pointer' : 'not-allowed',
          transition: 'background-color 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm
        }}
      >
        {uploading ? (
          <>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid transparent',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            업로드 중...
          </>
        ) : (
          <>
            📤 업로드하기
            {selectedFiles && selectedFiles.length > 0 && ` (${selectedFiles.length}개)`}
          </>
        )}
      </button>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PhotoUpload;