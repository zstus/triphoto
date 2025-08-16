import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '../services/api';
import { Room } from '../types';
import MobileLayout from '../components/MobileLayout';
import RoomPasswordModal from '../components/RoomPasswordModal';
import { colors, spacing, shadows } from '../styles/responsive';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const joinRoomIdRef = useRef<HTMLInputElement>(null);
  const userNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const roomList = await roomApi.listRooms();
      setRooms(roomList);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const roomId = joinRoomIdRef.current?.value.trim() || '';
    const userName = userNameRef.current?.value.trim() || '';
    
    if (!roomId || !userName) return;

    setLoading(true);
    try {
      await roomApi.joinRoom(roomId, { user_name: userName });
      
      // 사용자 이름을 방별로 저장 (roomId를 키로 사용)
      const roomUserData = JSON.parse(localStorage.getItem('roomUsers') || '{}');
      roomUserData[roomId] = userName;
      localStorage.setItem('roomUsers', JSON.stringify(roomUserData));
      
      // 전역 userName도 업데이트 (마지막 사용 이름으로)
      localStorage.setItem('userName', userName);
      sessionStorage.setItem('userName', userName);
      
      navigate(`/room/${roomId}`);
    } catch (error) {
      alert('방에 참가할 수 없습니다. 방 ID를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (inputRoomId: string, userName: string) => {
    if (!selectedRoom) return;

    setLoading(true);
    try {
      // 입력된 ID가 선택된 방의 실제 ID와 일치하는지 확인
      if (inputRoomId !== selectedRoom.id) {
        alert('올바르지 않은 방 ID입니다.');
        setLoading(false);
        return;
      }

      // 방 참가 API 호출
      await roomApi.joinRoom(inputRoomId, { user_name: userName });
      
      // 사용자 이름을 방별로 저장 (roomId를 키로 사용)
      const roomUserData = JSON.parse(localStorage.getItem('roomUsers') || '{}');
      roomUserData[inputRoomId] = userName;
      localStorage.setItem('roomUsers', JSON.stringify(roomUserData));
      
      // 전역 userName도 업데이트 (마지막 사용 이름으로)
      localStorage.setItem('userName', userName);
      sessionStorage.setItem('userName', userName);
      
      // 성공하면 방으로 이동
      navigate(`/room/${inputRoomId}`);
    } catch (error) {
      alert('방에 접근할 수 없습니다. 방 ID나 사용자 이름을 다시 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordModalClose = () => {
    setShowPasswordModal(false);
    setSelectedRoom(null);
    setLoading(false);
  };

  const ActionButtons = () => (
    <div style={{
      display: 'flex',
      gap: spacing.sm,
      marginBottom: spacing.lg
    }}>
      <button
        onClick={() => setShowJoinForm(!showJoinForm)}
        style={{
          flex: 1,
          padding: spacing.md,
          backgroundColor: showJoinForm ? colors.secondary : colors.primary,
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        {showJoinForm ? '취소' : '방 참가하기'}
      </button>
      <button
        onClick={() => navigate('/create')}
        style={{
          flex: 1,
          padding: spacing.md,
          backgroundColor: colors.success,
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        새 방 만들기
      </button>
    </div>
  );

  const JoinRoomForm = (): React.ReactElement | null => (
    showJoinForm ? (
      <div style={{
        backgroundColor: colors.background,
        borderRadius: '16px',
        padding: spacing.lg,
        marginBottom: spacing.lg,
        boxShadow: shadows.md,
        border: `1px solid ${colors.border}`
      }}>
        <h3 style={{
          margin: `0 0 ${spacing.md} 0`,
          fontSize: '18px',
          fontWeight: '600',
          color: colors.text
        }}>
          방 참가하기
        </h3>
        <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <input
            ref={joinRoomIdRef}
            type="text"
            placeholder="방 ID를 입력하세요"
            required
            style={{
              padding: spacing.md,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              fontSize: '16px',
              outline: 'none',
              transition: 'border-color 0.2s ease',
              boxSizing: 'border-box'
            }}
          />
          <input
            ref={userNameRef}
            type="text"
            placeholder="이름을 입력하세요"
            defaultValue={localStorage.getItem('userName') || ''}
            required
            style={{
              padding: spacing.md,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              fontSize: '16px',
              outline: 'none',
              transition: 'border-color 0.2s ease',
              boxSizing: 'border-box'
            }}
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{
              padding: spacing.md,
              backgroundColor: loading ? colors.secondary : colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease'
            }}
          >
            {loading ? '참가 중...' : '참가하기'}
          </button>
        </form>
      </div>
    ) : null
  );

  const RoomCard = ({ room }: { room: Room }) => (
    <div 
      onClick={() => handleRoomClick(room)}
      style={{ 
        backgroundColor: colors.background,
        borderRadius: '16px',
        padding: spacing.lg,
        boxShadow: shadows.md,
        border: `1px solid ${colors.border}`,
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        marginBottom: spacing.md
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.98)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm }}>
        <h3 style={{ 
          margin: 0,
          fontSize: '18px',
          fontWeight: '600',
          color: colors.text,
          flex: 1,
          marginRight: spacing.sm
        }}>
          {room.name}
        </h3>
        <div style={{
          backgroundColor: colors.primary,
          color: 'white',
          padding: `${spacing.xs} ${spacing.sm}`,
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '600',
          minWidth: '40px',
          textAlign: 'center'
        }}>
          {room.photo_count}
        </div>
      </div>
      
      {room.description && (
        <p style={{ 
          color: colors.textMuted,
          margin: `0 0 ${spacing.md} 0`,
          fontSize: '14px',
          lineHeight: '1.4'
        }}>
          {room.description}
        </p>
      )}
      
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: colors.textMuted
      }}>
        <span>👤 {room.creator_name}</span>
        <span>{new Date(room.created_at).toLocaleDateString('ko-KR')}</span>
      </div>
    </div>
  );

  const EmptyState = () => (
    <div style={{
      textAlign: 'center',
      padding: spacing.xxl,
      color: colors.textMuted
    }}>
      <div style={{ fontSize: '64px', marginBottom: spacing.lg }}>📸</div>
      <h3 style={{ margin: `0 0 ${spacing.md} 0`, color: colors.text }}>
        아직 생성된 방이 없어요
      </h3>
      <p style={{ margin: 0, lineHeight: '1.5' }}>
        새로운 여행 방을 만들어<br />
        친구들과 사진을 공유해보세요!
      </p>
    </div>
  );

  return (
    <MobileLayout 
      title="여행 사진 공유"
      rightAction={
        <button 
          onClick={loadRooms}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: spacing.xs,
            color: colors.primary
          }}
        >
          🔄
        </button>
      }
    >
      <ActionButtons />
      <JoinRoomForm />
      
      <div style={{ marginBottom: spacing.md }}>
        <h2 style={{
          margin: `0 0 ${spacing.md} 0`,
          fontSize: '20px',
          fontWeight: '600',
          color: colors.text
        }}>
          방 목록 ({rooms.length})
        </h2>
      </div>

      {rooms.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}

      {/* 방 패스워드 모달 */}
      {showPasswordModal && selectedRoom && (
        <RoomPasswordModal
          roomName={selectedRoom.name}
          onSubmit={handlePasswordSubmit}
          onClose={handlePasswordModalClose}
          loading={loading}
        />
      )}
    </MobileLayout>
  );
};

export default HomePage;