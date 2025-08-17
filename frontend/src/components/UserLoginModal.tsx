import React, { useState, useEffect } from 'react';
import { roomApi, validateInput, sanitizeInput } from '../services/api';
import { colors, spacing, shadows } from '../styles/responsive';

interface UserLoginModalProps {
  roomId: string;
  onLogin: (userName: string) => void;
  onClose: () => void;
}

const UserLoginModal: React.FC<UserLoginModalProps> = ({ roomId, onLogin, onClose }) => {
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roomInfoLoaded, setRoomInfoLoaded] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 이미 로드된 경우 다시 로드하지 않음
    if (roomInfoLoaded) return;
    
    const loadRoomInfo = async () => {
      console.log('🔍 UserLoginModal: Loading room info for:', roomId);
      try {
        // Validate room ID format before making API call
        if (!validateInput.roomId(roomId)) {
          setError('유효하지 않은 방 ID입니다.');
          return;
        }
        
        const room = await roomApi.getRoom(roomId);
        setRoomName(room.name);
        setRoomInfoLoaded(true);
        console.log('✅ UserLoginModal: Room info loaded successfully');
      } catch (err: any) {
        console.error('❌ UserLoginModal: Failed to load room info:', err);
        if (err.response?.status === 400) {
          setError('유효하지 않은 방 ID 형식입니다.');
        } else if (err.response?.status === 404) {
          setError('존재하지 않는 방입니다.');
        } else if (err.response?.status === 429) {
          setError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
        } else {
          setError('방 정보를 불러올 수 없습니다.');
        }
      }
    };
    loadRoomInfo();
  }, [roomId, roomInfoLoaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputValue = inputRef.current?.value || '';
    const trimmedName = inputValue.trim();
    
    if (!trimmedName) {
      setError('이름을 입력해주세요.');
      return;
    }

    // Validate username format
    if (!validateInput.userName(trimmedName)) {
      setError('이름은 2-50자의 한글, 영문, 숫자, ., _, - 만 사용 가능합니다.');
      return;
    }

    // Validate room ID again before join
    if (!validateInput.roomId(roomId)) {
      setError('유효하지 않은 방 ID입니다.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 방 참가 API 호출 (기존 사용자든 새 사용자든 상관없이)
      await roomApi.joinRoom(roomId, { user_name: trimmedName });
      
      // 로컬 스토리지와 세션 스토리지에 사용자 이름 저장 (sanitized)
      const sanitizedName = sanitizeInput(trimmedName);
      localStorage.setItem('userName', sanitizedName);
      sessionStorage.setItem('userName', sanitizedName);
      
      // 방별 사용자 이름도 업데이트 (기존 캐시 덮어쓰기)
      const roomUserData = JSON.parse(localStorage.getItem('roomUsers') || '{}');
      roomUserData[roomId] = sanitizedName;
      localStorage.setItem('roomUsers', JSON.stringify(roomUserData));
      
      console.log('💾 Username saved to both localStorage and sessionStorage:', sanitizedName);
      console.log('💾 Room-specific username updated for room:', roomId);
      
      // 부모 컴포넌트에 로그인 완료 알림
      onLogin(sanitizedName);
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError(err.response.data?.detail || '잘못된 요청입니다.');
      } else if (err.response?.status === 404) {
        setError('존재하지 않는 방입니다.');
      } else if (err.response?.status === 429) {
        setError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      } else if (err.response?.status === 419) {
        setError('보안 토큰 오류. 페이지를 새로고침해주세요.');
      } else if (err.response?.status === 403) {
        setError('방 접근 권한이 없습니다.');
      } else {
        setError('방 참가에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: spacing.lg
    }}>
      <div style={{
        backgroundColor: colors.background,
        borderRadius: '20px',
        padding: spacing.xl,
        width: '100%',
        maxWidth: '400px',
        boxShadow: shadows.lg,
        border: `1px solid ${colors.border}`
      }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          <div style={{ fontSize: '48px', marginBottom: spacing.md }}>🚪</div>
          <h2 style={{ 
            margin: `0 0 ${spacing.sm} 0`,
            fontSize: '24px',
            fontWeight: '600',
            color: colors.text
          }}>
            방 참가하기
          </h2>
          {roomName && (
            <p style={{ 
              color: colors.textMuted,
              margin: `0 0 ${spacing.sm} 0`,
              fontSize: '16px'
            }}>
              <strong style={{ color: colors.primary }}>{roomName}</strong>에 참가합니다
            </p>
          )}
          <p style={{ 
            color: colors.textMuted,
            margin: 0,
            fontSize: '14px',
            lineHeight: '1.4'
          }}>
            이 방의 사진을 보고 업로드하려면<br />먼저 이름을 입력해주세요
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: spacing.lg }}>
            <label style={{
              display: 'block',
              marginBottom: spacing.sm,
              fontSize: '14px',
              fontWeight: '600',
              color: colors.text
            }}>
              내 이름을 입력해주세요
            </label>
            <input
              ref={inputRef}
              type="text"
              placeholder="예: 김철수"
              autoFocus
              disabled={loading}
              onChange={() => setError('')}
              style={{
                width: '100%',
                padding: spacing.md,
                border: `2px solid ${error ? colors.danger : colors.border}`,
                borderRadius: '12px',
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
                backgroundColor: loading ? colors.light : 'white'
              }}
              onFocus={(e) => {
                if (!error) {
                  e.target.style.borderColor = colors.primary;
                }
              }}
              onBlur={(e) => {
                if (!error) {
                  e.target.style.borderColor = colors.border;
                }
              }}
            />
            {error && (
              <p style={{
                color: colors.danger,
                fontSize: '12px',
                margin: `${spacing.xs} 0 0 0`,
                fontWeight: '500'
              }}>
                {error}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: spacing.sm }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: spacing.md,
                backgroundColor: colors.light,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'background-color 0.2s ease'
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2,
                padding: spacing.md,
                backgroundColor: loading ? colors.secondary : colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                transition: 'background-color 0.2s ease'
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span>입장 중...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>입장하기</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div style={{
          marginTop: spacing.lg,
          padding: spacing.md,
          backgroundColor: colors.light,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <p style={{
            fontSize: '12px',
            color: colors.textMuted,
            margin: 0,
            lineHeight: '1.4',
            textAlign: 'center'
          }}>
            💡 입력한 이름으로 사진을 업로드하고 좋아요를 남길 수 있어요
          </p>
        </div>

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default UserLoginModal;