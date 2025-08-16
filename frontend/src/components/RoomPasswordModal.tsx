import React, { useRef, useState } from 'react';
import { colors, spacing, shadows } from '../styles/responsive';

interface RoomPasswordModalProps {
  roomName: string;
  onSubmit: (roomId: string, userName: string) => void;
  onClose: () => void;
  loading?: boolean;
}

const RoomPasswordModal: React.FC<RoomPasswordModalProps> = ({ 
  roomName, 
  onSubmit, 
  onClose, 
  loading = false 
}) => {
  const [error, setError] = useState('');
  const roomIdRef = useRef<HTMLInputElement>(null);
  const userNameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const roomId = roomIdRef.current?.value.trim() || '';
    const userName = userNameRef.current?.value.trim() || '';
    
    if (!roomId) {
      setError('방 ID를 입력해주세요.');
      return;
    }

    if (roomId.length < 10) {
      setError('올바른 방 ID를 입력해주세요.');
      return;
    }

    if (!userName) {
      setError('사용자 이름을 입력해주세요.');
      return;
    }

    if (userName.length < 2) {
      setError('사용자 이름은 2글자 이상이어야 합니다.');
      return;
    }

    setError('');
    onSubmit(roomId, userName);
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
          <div style={{ fontSize: '48px', marginBottom: spacing.md }}>🔐</div>
          <h2 style={{ 
            margin: `0 0 ${spacing.sm} 0`,
            fontSize: '24px',
            fontWeight: '600',
            color: colors.text
          }}>
            방 입장
          </h2>
          <p style={{ 
            color: colors.textMuted,
            margin: 0,
            fontSize: '16px'
          }}>
            <strong style={{ color: colors.primary }}>{roomName}</strong>에 입장하려면<br />
            방 ID와 사용자 이름을 입력해주세요
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: spacing.md }}>
            <label style={{
              display: 'block',
              marginBottom: spacing.sm,
              fontSize: '14px',
              fontWeight: '600',
              color: colors.text
            }}>
              방 ID
            </label>
            <input
              ref={roomIdRef}
              type="text"
              placeholder="예: 6fc09a59-5624-4aa6-a395-841144da1ca5"
              autoFocus
              disabled={loading}
              onChange={() => setError('')}
              style={{
                width: '100%',
                padding: spacing.md,
                border: `2px solid ${error ? colors.danger : colors.border}`,
                borderRadius: '12px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
                backgroundColor: loading ? colors.light : 'white',
                fontFamily: 'monospace'
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
          </div>

          <div style={{ marginBottom: spacing.lg }}>
            <label style={{
              display: 'block',
              marginBottom: spacing.sm,
              fontSize: '14px',
              fontWeight: '600',
              color: colors.text
            }}>
              사용자 이름
            </label>
            <input
              ref={userNameRef}
              type="text"
              placeholder="예: 김철수"
              defaultValue={localStorage.getItem('userName') || ''}
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
                  <span>확인 중...</span>
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
            💡 방 ID는 방 생성자에게 문의하거나 초대 링크를 통해 확인할 수 있어요
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

export default RoomPasswordModal;