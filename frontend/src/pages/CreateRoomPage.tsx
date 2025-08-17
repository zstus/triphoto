import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '../services/api';
import MobileLayout from '../components/MobileLayout';
import { colors, spacing, shadows } from '../styles/responsive';

const CreateRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const creatorNameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const name = nameRef.current?.value || '';
    const description = descriptionRef.current?.value || '';
    const creator_name = creatorNameRef.current?.value || '';
    
    if (!name.trim() || !creator_name.trim()) return;

    setLoading(true);
    try {
      const formData = { name, description, creator_name };
      const room = await roomApi.createRoom(formData);
      
      // 방 생성자를 자동 로그인 처리
      localStorage.setItem('userName', creator_name);
      sessionStorage.setItem('userName', creator_name);
      
      // 방별 사용자 이름도 미리 설정 (중요: 로그인 모달 스킵을 위해)
      const roomUserData = JSON.parse(localStorage.getItem('roomUsers') || '{}');
      roomUserData[room.id] = creator_name;
      localStorage.setItem('roomUsers', JSON.stringify(roomUserData));
      
      // 방 생성자 자동 진입을 위한 임시 플래그 설정
      const autoLoginFlag = `autoLogin_${room.id}`;
      sessionStorage.setItem(autoLoginFlag, creator_name);
      console.log('🔐 Auto-login flag set:', autoLoginFlag, '=', creator_name);
      
      // 백엔드에 방 참가자로 등록 (방 생성자 자동 참가)
      try {
        await roomApi.joinRoom(room.id, { user_name: creator_name });
        console.log('✅ Room creator auto-joined successfully');
      } catch (error) {
        console.log('⚠️ Auto-join failed, but continuing (creator might already be joined):', error);
      }
      
      console.log('🏠 Room creator auto-login setup completed for:', creator_name);
      console.log('🆔 Room ID:', room.id);
      console.log('🔍 Verifying sessionStorage flag:', sessionStorage.getItem(autoLoginFlag));
      
      // 생성자임을 표시하는 쿼리 파라미터와 함께 방으로 이동
      navigate(`/room/${room.id}?creator=true`);
    } catch (error) {
      alert('방 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };


  const FormField = ({ 
    label, 
    required = false, 
    children 
  }: { 
    label: string; 
    required?: boolean; 
    children: React.ReactNode 
  }) => (
    <div style={{ marginBottom: spacing.lg }}>
      <label style={{ 
        display: 'block', 
        marginBottom: spacing.sm, 
        fontSize: '16px',
        fontWeight: '600',
        color: colors.text
      }}>
        {label} {required && <span style={{ color: colors.danger }}>*</span>}
      </label>
      {children}
    </div>
  );

  const inputStyle = {
    width: '100%',
    padding: spacing.md,
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxSizing: 'border-box' as const
  };

  return (
    <MobileLayout 
      title="새 방 만들기"
      showBackButton
      onBack={() => navigate('/')}
    >
      <form onSubmit={handleSubmit} style={{ paddingBottom: spacing.xl }}>
        <FormField label="방 이름" required>
          <input
            ref={nameRef}
            type="text"
            placeholder="예: 부산 여행 2024"
            style={inputStyle}
          />
        </FormField>

        <FormField label="방 설명">
          <textarea
            ref={descriptionRef}
            placeholder="여행에 대한 간단한 설명을 입력하세요"
            rows={4}
            style={{
              ...inputStyle,
              resize: 'vertical' as const,
              minHeight: '120px',
              fontFamily: 'inherit'
            }}
          />
        </FormField>

        <FormField label="내 이름" required>
          <input
            ref={creatorNameRef}
            type="text"
            placeholder="이름을 입력하세요"
            style={inputStyle}
          />
        </FormField>

        <div style={{ 
          display: 'flex', 
          gap: spacing.md, 
          marginTop: spacing.xl,
          position: 'sticky',
          bottom: spacing.md,
          backgroundColor: colors.light,
          padding: spacing.md,
          marginLeft: `-${spacing.md}`,
          marginRight: `-${spacing.md}`,
          borderRadius: '16px 16px 0 0'
        }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{ 
              flex: 1,
              padding: spacing.md,
              backgroundColor: colors.secondary,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
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
              backgroundColor: loading ? colors.secondary : colors.success,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
              position: 'relative'
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
                <span style={{ 
                  width: '20px', 
                  height: '20px', 
                  border: '2px solid transparent',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                생성 중...
              </span>
            ) : (
              '방 만들기 🚀'
            )}
          </button>
        </div>
      </form>

      <div style={{ 
        backgroundColor: colors.background,
        borderRadius: '16px',
        padding: spacing.lg,
        marginTop: spacing.lg,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.sm
      }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          marginBottom: spacing.md,
          gap: spacing.sm
        }}>
          <span style={{ fontSize: '20px' }}>💡</span>
          <strong style={{ color: colors.text, fontSize: '16px' }}>안내사항</strong>
        </div>
        <ul style={{ 
          margin: 0, 
          paddingLeft: spacing.lg,
          color: colors.textMuted,
          lineHeight: '1.6',
          fontSize: '14px'
        }}>
          <li style={{ marginBottom: spacing.sm }}>방을 만든 후 방 ID를 친구들에게 공유하세요</li>
          <li style={{ marginBottom: spacing.sm }}>참가자들은 여행 사진을 자유롭게 업로드할 수 있어요</li>
          <li style={{ marginBottom: spacing.sm }}>사진들은 촬영 날짜순으로 자동 정렬됩니다</li>
          <li>좋아요를 누르고 원하는 사진을 다운로드하세요!</li>
        </ul>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </MobileLayout>
  );
};

export default CreateRoomPage;