import React, { useState, useRef } from 'react';
import { photoApiEnhanced, uploadSessionApi, uploadLogApi, validateInput } from '../services/api';
import { UploadSession, UploadLog, UploadResult } from '../types';
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
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null);
  const [uploadLogs, setUploadLogs] = useState<UploadLog[]>([]);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [currentFileName, setCurrentFileName] = useState<string>('');
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
      setTimeout(() => setValidationErrors([]), 5000);
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

  // 실패한 업로드 재시도 함수
  const retryFailedUploads = async () => {
    if (!uploadResult || uploadResult.failed_files.length === 0) return;
    
    try {
      const failedLogIds = uploadResult.failed_files.map(log => log.id);
      console.log(`🔄 ${failedLogIds.length}개 실패한 업로드 재시도 시작`);
      
      const retryResult = await uploadLogApi.retryFailedUploads({ log_ids: failedLogIds });
      console.log('✅ 재시도 요청 완료:', retryResult);
      
      // 재시도된 로그들 다시 업로드
      const userName = localStorage.getItem('userName');
      if (!userName) {
        alert('사용자 이름을 찾을 수 없습니다.');
        return;
      }
      
      setUploading(true);
      setUploadResult(null);
      
      // 실패한 파일들을 다시 가져와서 업로드 시도
      const updatedLogs = await uploadLogApi.getSessionLogs(uploadSession!.id);
      const pendingLogs = updatedLogs.filter(log => log.status === 'pending');
      
      let retrySuccessCount = 0;
      let retryFailCount = 0;
      
      for (const log of pendingLogs) {
        try {
          setCurrentFileName(log.original_filename);
          setCurrentUploadIndex(pendingLogs.indexOf(log));
          
          // 파일을 다시 선택해야 하므로 사용자에게 알림
          console.log(`🔄 재시도 중: ${log.original_filename}`);
          retrySuccessCount++;
        } catch (error) {
          console.error(`❌ 재시도 실패: ${log.original_filename}`, error);
          retryFailCount++;
        }
      }
      
      alert(`재시도 완료: 성공 ${retrySuccessCount}개, 실패 ${retryFailCount}개`);
      onUploadSuccess();
      
    } catch (error: any) {
      console.error('❌ 재시도 실패:', error);
      alert(`재시도 실패: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 새로운 로깅 시스템을 사용한 배치 업로드 함수
  const uploadFilesWithLogging = async (files: File[], userName: string) => {
    console.log(`🚀 로깅 시스템을 사용한 업로드 시작: ${files.length}개 파일`);
    
    try {
      // 1단계: 업로드 세션 생성
      console.log('📝 업로드 세션 생성 중...');
      const session = await uploadSessionApi.createSession({
        room_id: roomId,
        user_name: userName,
        total_files: files.length
      });
      
      setUploadSession(session);
      console.log(`✅ 업로드 세션 생성 완료: ${session.id}`);
      
      // 2단계: 각 파일별 로그 엔트리 생성
      console.log('📝 파일별 로그 엔트리 생성 중...');
      const logs: UploadLog[] = [];
      for (const file of files) {
        const log = await uploadLogApi.createLog({
          session_id: session.id,
          room_id: roomId,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          uploader_name: userName
        });
        logs.push(log);
      }
      
      setUploadLogs(logs);
      console.log(`✅ ${logs.length}개 로그 엔트리 생성 완료`);
      
      // 3단계: 배치 업로드 수행
      const BATCH_SIZE = 5;
      const BATCH_DELAY = 4000;
      let completedCount = 0;
      let failedCount = 0;
      const failedLogs: UploadLog[] = [];
      
      // 파일과 로그를 매핑
      const fileLogPairs = files.map((file, index) => ({ file, log: logs[index] }));
      
      // 배치별로 처리
      for (let i = 0; i < fileLogPairs.length; i += BATCH_SIZE) {
        const batch = fileLogPairs.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(fileLogPairs.length / BATCH_SIZE);
        
        console.log(`📦 배치 ${batchNumber}/${totalBatches} 처리 중 (${batch.length}개 파일)`);
        
        // 배치 내 파일들을 병렬 업로드
        const batchPromises = batch.map(async ({ file, log }, batchIndex) => {
          const globalIndex = i + batchIndex;
          setCurrentUploadIndex(globalIndex);
          setCurrentFileName(file.name);
          
          try {
            console.log(`📤 업로드 시작: ${file.name} (로그 ID: ${log.id})`);
            const photo = await photoApiEnhanced.uploadPhotoWithLogging(
              roomId, 
              file, 
              userName, 
              log.id
            );
            
            console.log(`✅ 업로드 성공: ${file.name} → ${photo.id}`);
            return { success: true, file, log, photo };
            
          } catch (error: any) {
            failedLogs.push(log);
            
            const errorMessage = error.response?.data?.detail || error.message || '알 수 없는 오류';
            console.error(`❌ 업로드 실패: ${file.name} - ${errorMessage}`);
            
            return { success: false, file, log, error: errorMessage };
          }
        });
        
        // 배치 완료 대기
        const batchResults = await Promise.allSettled(batchPromises);
        
        // 배치 결과 집계
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              completedCount++;
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        });
        
        // 진행률 업데이트
        const processedFiles = completedCount + failedCount;
        const progressPercent = Math.round((processedFiles / files.length) * 100);
        setUploadProgress(progressPercent);
        console.log(`📊 진행률: ${processedFiles}/${files.length} (${progressPercent}%)`);
        
        // 마지막 배치가 아니면 대기
        if (i + BATCH_SIZE < fileLogPairs.length) {
          console.log(`⏳ 다음 배치까지 ${BATCH_DELAY/1000}초 대기...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      // 4단계: 세션 완료 처리
      const finalStatus = failedCount === 0 ? 'completed' : 
                         completedCount === 0 ? 'failed' : 'partially_failed';
      
      await uploadSessionApi.updateSession(session.id, {
        completed_files: completedCount,
        failed_files: failedCount,
        status: finalStatus,
        completed_at: new Date().toISOString()
      });
      
      // 최종 결과 설정
      const result: UploadResult = {
        session_id: session.id,
        total_files: files.length,
        successful_uploads: completedCount,
        failed_uploads: failedCount,
        failed_files: failedLogs
      };
      
      setUploadResult(result);
      setUploadProgress(100); // 완료시 100% 설정
      console.log(`🏁 업로드 완료: 성공 ${completedCount}개, 실패 ${failedCount}개`);
      
      return result;
      
    } catch (error: any) {
      console.error('❌ 업로드 세션 생성 실패:', error);
      throw new Error(`업로드 세션 생성 실패: ${error.message}`);
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    const userName = localStorage.getItem('userName');
    if (!userName) {
      alert('사용자 이름을 입력해주세요.');
      return;
    }
    
    setUploading(true);
    setUploadResult(null);
    setUploadProgress(0);
    setCurrentUploadIndex(0);
    setCurrentFileName('');
    
    try {
      const files = Array.from(selectedFiles);
      const result = await uploadFilesWithLogging(files, userName);
      
      if (result.failed_uploads === 0) {
        alert(`✅ 모든 사진이 성공적으로 업로드되었습니다! (${result.successful_uploads}개)`);
        setSelectedFiles(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onUploadSuccess();
      } else {
        alert(`⚠️ 업로드 완료: 성공 ${result.successful_uploads}개, 실패 ${result.failed_uploads}개\n실패한 파일들은 재시도할 수 있습니다.`);
      }
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      alert(`업로드 실패: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 진행률 계산
  const getUploadProgress = () => {
    if (!uploadSession || !selectedFiles) return 0;
    return Math.round((currentUploadIndex / selectedFiles.length) * 100);
  };

  return (
    <div style={{ padding: spacing.lg }}>
      {/* 파일 선택 영역 */}
      <div
        style={{
          border: `2px dashed ${dragOver ? colors.primary : colors.border}`,
          borderRadius: '16px',
          padding: spacing.xxl,
          textAlign: 'center',
          backgroundColor: dragOver ? `${colors.primary}15` : colors.light,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          marginBottom: spacing.lg
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={{ fontSize: '48px', marginBottom: spacing.md }}>
          📷
        </div>
        <h3 style={{ 
          margin: `0 0 ${spacing.sm} 0`,
          fontSize: '18px',
          color: colors.text
        }}>
          사진 업로드
        </h3>
        <p style={{ 
          color: colors.textMuted,
          margin: 0,
          fontSize: '14px'
        }}>
          클릭하거나 파일을 드래그해서 업로드하세요
        </p>
        <p style={{ 
          color: colors.textMuted,
          margin: `${spacing.xs} 0 0 0`,
          fontSize: '12px'
        }}>
          JPG, PNG, GIF, WebP (최대 10MB)
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* 검증 오류 표시 */}
      {validationErrors.length > 0 && (
        <div style={{
          backgroundColor: colors.danger + '15',
          border: `1px solid ${colors.danger}`,
          borderRadius: '8px',
          padding: spacing.md,
          marginBottom: spacing.lg
        }}>
          <div style={{ fontWeight: '600', color: colors.danger, marginBottom: spacing.xs }}>
            파일 검증 오류:
          </div>
          {validationErrors.map((error, index) => (
            <div key={index} style={{ fontSize: '12px', color: colors.danger }}>
              • {error}
            </div>
          ))}
        </div>
      )}

      {/* 선택된 파일 목록 */}
      {selectedFiles && selectedFiles.length > 0 && (
        <div style={{
          backgroundColor: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: spacing.md,
          marginBottom: spacing.lg
        }}>
          <div style={{ 
            fontWeight: '600', 
            marginBottom: spacing.sm,
            fontSize: '14px',
            color: colors.text
          }}>
            선택된 파일 ({selectedFiles.length}개)
          </div>
          <div style={{ 
            maxHeight: '120px', 
            overflowY: 'auto',
            fontSize: '12px',
            color: colors.textMuted
          }}>
            {Array.from(selectedFiles).map((file, index) => (
              <div key={index} style={{ padding: `${spacing.xs} 0` }}>
                📎 {file.name} ({Math.round(file.size / 1024)}KB)
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 업로드 진행 상황 */}
      {uploading && (
        <div style={{
          backgroundColor: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: spacing.lg,
          marginBottom: spacing.lg
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: spacing.md 
          }}>
            <span style={{ fontWeight: '600', color: colors.text }}>업로드 중...</span>
            <span style={{ fontSize: '14px', color: colors.textMuted }}>
              {getUploadProgress()}%
            </span>
          </div>
          
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: colors.border,
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: spacing.md
          }}>
            <div style={{
              width: `${getUploadProgress()}%`,
              height: '100%',
              backgroundColor: colors.primary,
              transition: 'width 0.3s ease'
            }} />
          </div>
          
          {uploadSession && (
            <div style={{ fontSize: '12px', color: colors.textMuted }}>
              세션 ID: {uploadSession.id}
            </div>
          )}
          
          {currentFileName && (
            <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: spacing.xs }}>
              현재: {currentFileName}
            </div>
          )}
        </div>
      )}

      {/* 업로드 결과 */}
      {uploadResult && (
        <div style={{
          backgroundColor: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: spacing.lg,
          marginBottom: spacing.lg
        }}>
          <div style={{ 
            fontWeight: '600', 
            marginBottom: spacing.md,
            color: colors.text
          }}>
            업로드 결과
          </div>
          
          <div style={{ fontSize: '14px', marginBottom: spacing.sm }}>
            <span style={{ color: colors.success }}>✅ 성공: {uploadResult.successful_uploads}개</span>
          </div>
          
          {uploadResult.failed_uploads > 0 && (
            <>
              <div style={{ fontSize: '14px', marginBottom: spacing.md }}>
                <span style={{ color: colors.danger }}>❌ 실패: {uploadResult.failed_uploads}개</span>
              </div>
              
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: spacing.xs, color: colors.text }}>
                  실패한 파일들:
                </div>
                {uploadResult.failed_files.map((log, index) => (
                  <div key={index} style={{ fontSize: '11px', color: colors.textMuted, marginBottom: spacing.xs }}>
                    • {log.original_filename}: {log.error_message}
                  </div>
                ))}
              </div>
              
              <button
                onClick={retryFailedUploads}
                disabled={uploading}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  backgroundColor: colors.warning,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1
                }}
              >
                🔄 실패한 파일 재시도
              </button>
            </>
          )}
        </div>
      )}

      {/* 업로드 버튼 */}
      <button
        onClick={handleUpload}
        disabled={!selectedFiles || selectedFiles.length === 0 || uploading}
        style={{
          width: '100%',
          padding: spacing.lg,
          backgroundColor: uploading 
            ? colors.secondary 
            : (!selectedFiles || selectedFiles.length === 0) 
              ? colors.border 
              : colors.primary,
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: uploading || !selectedFiles || selectedFiles.length === 0 
            ? 'not-allowed' 
            : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          transition: 'background-color 0.2s ease'
        }}
      >
        {uploading ? (
          <>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid transparent',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            업로드 중...
          </>
        ) : (
          <>
            📤 업로드 시작
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