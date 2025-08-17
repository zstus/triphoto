import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { roomApi, photoApi } from '../services/api';
import { Room, Photo, Participant, RoomStatistics } from '../types';
import PhotoUpload from '../components/PhotoUpload';
import PhotoGallery from '../components/PhotoGallery';
import MobileLayout from '../components/MobileLayout';
import UserLoginModal from '../components/UserLoginModal';
import { colors, spacing, shadows } from '../styles/responsive';

const RoomPage: React.FC = () => {
  console.log('🏠 RoomPage component mounted');
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  console.log('🆔 Room ID from params:', roomId);
  
  // 생성자 플래그 확인
  const isCreator = searchParams.get('creator') === 'true';
  console.log('👑 Is creator:', isCreator);
  
  const [room, setRoom] = useState<Room | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [roomStatistics, setRoomStatistics] = useState<RoomStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gallery' | 'upload'>('gallery');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLinkShareModal, setShowLinkShareModal] = useState(false);
  const [selectedUploader, setSelectedUploader] = useState<string | null>(null);
  const userNameRef = useRef<HTMLInputElement>(null);

  const refreshRoomData = useCallback(async () => {
    console.log('🔄 Refreshing photos after update');
    if (roomId) {
      const userName = localStorage.getItem('userName');
      try {
        const [roomData, photosData, participantsData, statisticsData] = await Promise.all([
          roomApi.getRoom(roomId),
          userName && userName.trim().length >= 2 
            ? photoApi.getRoomPhotosWithUserStatus(roomId, userName)
            : photoApi.getRoomPhotos(roomId),
          roomApi.getParticipantsList(roomId),
          roomApi.getRoomStatistics(roomId)
        ]);
        setRoom(roomData);
        setPhotos(photosData);
        setParticipants(participantsData.participants);
        setRoomStatistics(statisticsData);
      } catch (error: any) {
        console.error('❌ Failed to refresh data:', error);
      }
    }
  }, [roomId]);

  const handleUploadSuccess = useCallback(async () => {
    console.log('🔄 Refreshing after upload');
    if (roomId) {
      const userName = localStorage.getItem('userName');
      try {
        const [roomData, photosData, participantsData, statisticsData] = await Promise.all([
          roomApi.getRoom(roomId),
          userName && userName.trim().length >= 2 
            ? photoApi.getRoomPhotosWithUserStatus(roomId, userName)
            : photoApi.getRoomPhotos(roomId),
          roomApi.getParticipantsList(roomId),
          roomApi.getRoomStatistics(roomId)
        ]);
        setRoom(roomData);
        setPhotos(photosData);
        setParticipants(participantsData.participants);
        setRoomStatistics(statisticsData);
        setActiveTab('gallery');
      } catch (error: any) {
        console.error('❌ Failed to refresh data after upload:', error);
      }
    }
  }, [roomId]);

  const handleLogin = useCallback(async (userName: string) => {
    console.log('🔑 handleLogin called with userName:', userName);
    console.log('🔑 Setting login modal to false and loading room data');
    setShowLoginModal(false);
    
    if (!roomId) {
      console.log('❌ No roomId in handleLogin');
      return;
    }
    
    console.log('🔄 Loading room data after login');
    setLoading(true);
    try {
      // 약간의 지연을 주어 백엔드에서 참가자 추가가 완료되도록 함
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const [roomData, photosData, participantsData, statisticsData] = await Promise.all([
        roomApi.getRoom(roomId),
        userName && userName.trim().length >= 2 
          ? photoApi.getRoomPhotosWithUserStatus(roomId, userName)
          : photoApi.getRoomPhotos(roomId),
        roomApi.getParticipantsList(roomId),
        roomApi.getRoomStatistics(roomId)
      ]);
      
      console.log('✅ Room data loaded after login');
      console.log('👥 Participants after login:', participantsData.participants);
      setRoom(roomData);
      setPhotos(photosData);
      setParticipants(participantsData.participants);
      setRoomStatistics(statisticsData);
    } catch (error: any) {
      console.error('❌ Failed to load room data after login:', error);
      alert('방 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    console.log('🔥 useEffect triggered with roomId:', roomId);
    if (!roomId) {
      console.log('❌ No roomId in useEffect');
      return;
    }

    // 방 생성 직후 자동 진입 플래그 확인 (최우선)
    const autoLoginName = sessionStorage.getItem(`autoLogin_${roomId}`);
    console.log('🔍 Checking auto-login flag for room:', roomId, 'Found name:', autoLoginName);
    
    if (autoLoginName && autoLoginName.trim()) {
      console.log('🚀 Auto-login flag detected - immediate room entry for:', autoLoginName);
      sessionStorage.removeItem(`autoLogin_${roomId}`); // 플래그 제거
      
      // localStorage에도 사용자 정보 설정 (중복 로그인 방지)
      localStorage.setItem('userName', autoLoginName);
      const roomUserData = JSON.parse(localStorage.getItem('roomUsers') || '{}');
      roomUserData[roomId] = autoLoginName;
      localStorage.setItem('roomUsers', JSON.stringify(roomUserData));
      
      // 자동 로그인된 사용자로 방 데이터 로드
      handleLogin(autoLoginName);
      return;
    }

    // 기존 로그인 정보 확인 - 방별 로그인 기록만 확인 (globalName 제거)
    const roomUserData = JSON.parse(localStorage.getItem('roomUsers') || '{}');
    const roomSpecificName = roomUserData[roomId];
    
    console.log('🔍 Existing room login check - Room specific:', roomSpecificName, 'Is creator:', isCreator);
    
    // 해당 방에 로그인한 기록이 있는 경우에만 자동 로그인 (isCreator 제거)
    if (roomSpecificName && roomSpecificName.trim()) {
      console.log('✅ Found existing room login - loading room directly with:', roomSpecificName);
      handleLogin(roomSpecificName);
      return;
    }

    // 로그인 정보가 없는 경우 로그인 모달 표시
    console.log('🚪 No room-specific login found - showing login modal');
    setShowLoginModal(true);
    setLoading(false);
  }, [roomId, isCreator, navigate, handleLogin]);

  const handleParticipantClick = (participantName: string) => {
    if (selectedUploader === participantName) {
      // 같은 참가자를 다시 클릭하면 필터 해제
      setSelectedUploader(null);
    } else {
      // 다른 참가자를 클릭하면 해당 참가자로 필터링
      setSelectedUploader(participantName);
    }
  };

  // 필터링된 사진 목록
  const filteredPhotos = selectedUploader 
    ? photos.filter(photo => photo.uploader_name === selectedUploader)
    : photos;

  const getUserName = () => {
    return userNameRef.current?.value || '';
  };

  const copyToClipboard = (text: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // 최신 브라우저의 Clipboard API 시도
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
          .then(() => resolve(true))
          .catch(() => resolve(false));
      } else {
        // Fallback: 임시 textarea 사용
        try {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const result = document.execCommand('copy');
          document.body.removeChild(textArea);
          resolve(result);
        } catch (err) {
          resolve(false);
        }
      }
    });
  };

  const copyRoomId = async () => {
    if (roomId) {
      const success = await copyToClipboard(roomId);
      if (success) {
        alert('방 ID가 복사되었습니다! 📋');
      } else {
        alert(`복사에 실패했습니다. 방 ID: ${roomId}`);
      }
    }
  };

  const getNetworkLink = () => {
    // 현재 호스트가 localhost인 경우 실제 네트워크 IP로 변경
    const currentUrl = new URL(window.location.href);
    
    if (currentUrl.hostname === 'localhost' || currentUrl.hostname === '127.0.0.1') {
      // 환경변수에서 네트워크 IP를 가져오거나 기본값 사용
      const networkIP = process.env.REACT_APP_NETWORK_IP || '192.168.26.92';
      currentUrl.hostname = networkIP;
    }
    
    return currentUrl.toString();
  };

  const copyRoomLink = async () => {
    const currentHost = window.location.hostname;
    const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
    
    if (isLocalhost) {
      // localhost에서 접근 중일 때: 모달을 통해 선택 제공
      setShowLinkShareModal(true);
    } else {
      // 이미 네트워크 IP로 접근 중일 때
      const link = window.location.href;
      const success = await copyToClipboard(link);
      if (success) {
        alert('방 링크가 복사되었습니다! 🔗\n다른 기기에서도 접근 가능합니다.');
      } else {
        alert(`복사에 실패했습니다. 링크: ${link}`);
      }
    }
  };

  const handleLinkShare = async (useNetworkLink: boolean) => {
    const linkToShare = useNetworkLink ? getNetworkLink() : window.location.href;
    const success = await copyToClipboard(linkToShare);
    
    setShowLinkShareModal(false);
    
    if (success) {
      alert(
        useNetworkLink 
          ? '네트워크 링크가 복사되었습니다! 🌐\n같은 Wi-Fi에 연결된 다른 기기에서 접근할 수 있습니다.'
          : '로컬 링크가 복사되었습니다! 💻\n이 기기에서만 접근 가능합니다.'
      );
    } else {
      alert(`복사에 실패했습니다. 링크: ${linkToShare}`);
    }
  };

  const handleDeleteRoom = async () => {
    if (!room || !roomId) return;
    
    const confirmMessage = `⚠️ 경고: 방 삭제\n\n방 "${room.name}"과(와) 모든 관련 데이터가 영구적으로 삭제됩니다:\n\n• 업로드된 모든 사진 (${photos.length}개)\n• 좋아요/싫어요 데이터\n• 참가자 정보\n• 방 정보\n\n이 작업은 되돌릴 수 없습니다.\n정말로 삭제하시겠습니까?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      const result = await roomApi.deleteRoom(roomId);
      alert(`✅ 삭제 완료\n\n방 "${result.room_name}"이(가) 성공적으로 삭제되었습니다.\n\n삭제된 내용:\n• 사진 ${result.deleted_photos_count}개\n• 관련 데이터베이스 레코드\n• 업로드 폴더`);
      navigate('/');
    } catch (error: any) {
      console.error('❌ Failed to delete room:', error);
      if (error.response?.status === 403) {
        alert('❌ 권한이 없습니다.\n방 삭제는 특별한 권한이 필요합니다.');
      } else {
        alert(`❌ 방 삭제에 실패했습니다.\n\n오류: ${error.response?.data?.detail || error.message}`);
      }
    }
  };

  if (loading) {
    return (
      <MobileLayout title="로딩 중...">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh',
          flexDirection: 'column',
          gap: spacing.lg
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: `3px solid ${colors.border}`,
            borderTop: `3px solid ${colors.primary}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: colors.textMuted }}>방 정보를 불러오는 중...</p>
        </div>
      </MobileLayout>
    );
  }

  // 로그인 모달이 표시되는 동안 뒤의 내용을 숨김
  if (showLoginModal) {
    return (
      <MobileLayout title="방 접근">
        {/* 로그인 모달 */}
        {roomId && (
          <UserLoginModal
            roomId={roomId}
            onLogin={handleLogin}
            onClose={() => {
              console.log('🚪 Login modal closed, navigating to home');
              setShowLoginModal(false);
              navigate('/', { replace: true });
            }}
          />
        )}
      </MobileLayout>
    );
  }

  if (!room) {
    return (
      <MobileLayout title="오류" showBackButton onBack={() => navigate('/')}>
        <div style={{ 
          textAlign: 'center', 
          padding: spacing.xxl,
          color: colors.textMuted
        }}>
          <div style={{ fontSize: '64px', marginBottom: spacing.lg }}>😵</div>
          <h2 style={{ color: colors.text, marginBottom: spacing.md }}>방을 찾을 수 없어요</h2>
          <p style={{ marginBottom: spacing.xl }}>방 ID를 다시 확인해주세요.</p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: spacing.md,
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            홈으로 돌아가기
          </button>
        </div>
      </MobileLayout>
    );
  }

  const RoomInfo = () => (
    <div style={{
      backgroundColor: colors.background,
      borderRadius: '16px',
      padding: spacing.lg,
      marginBottom: spacing.lg,
      border: `1px solid ${colors.border}`,
      boxShadow: shadows.sm
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ 
            margin: `0 0 ${spacing.sm} 0`,
            fontSize: '20px',
            fontWeight: '600',
            color: colors.text
          }}>
            {room.name}
          </h2>
          {room.description && (
            <p style={{ 
              color: colors.textMuted,
              margin: `0 0 ${spacing.sm} 0`,
              fontSize: '14px',
              lineHeight: '1.4'
            }}>
              {room.description}
            </p>
          )}
        </div>
        <div style={{
          backgroundColor: colors.primary,
          color: 'white',
          padding: `${spacing.xs} ${spacing.sm}`,
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '600',
          marginLeft: spacing.sm,
          textAlign: 'center',
          minWidth: '60px'
        }}>
          {selectedUploader ? filteredPhotos.length : (roomStatistics?.visible_photos || photos.length)}
        </div>
      </div>
      
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: colors.textMuted,
        marginBottom: spacing.md
      }}>
        <span>👤 {room.creator_name}</span>
        <span>{new Date(room.created_at).toLocaleDateString('ko-KR')}</span>
      </div>

      {/* 상세 통계 정보 */}
      {roomStatistics && (
        <div style={{
          backgroundColor: colors.light,
          borderRadius: '12px',
          padding: spacing.md,
          marginBottom: spacing.md,
          border: `1px solid ${colors.border}`
        }}>
          <div style={{
            fontSize: '12px',
            color: colors.textMuted,
            marginBottom: spacing.sm,
            fontWeight: '600'
          }}>
            📊 방 통계
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: spacing.sm,
            fontSize: '11px'
          }}>
            <div style={{
              textAlign: 'center',
              padding: spacing.xs,
              backgroundColor: colors.background,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{ fontWeight: '600', color: colors.primary, fontSize: '14px' }}>
                {roomStatistics.total_photos}
              </div>
              <div style={{ color: colors.textMuted, marginTop: '2px' }}>
                전체 업로드
              </div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: spacing.xs,
              backgroundColor: colors.background,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{ fontWeight: '600', color: colors.success, fontSize: '14px' }}>
                {roomStatistics.visible_photos}
              </div>
              <div style={{ color: colors.textMuted, marginTop: '2px' }}>
                보이는 사진
              </div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: spacing.xs,
              backgroundColor: colors.background,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{ fontWeight: '600', color: colors.warning, fontSize: '14px' }}>
                {roomStatistics.hidden_photos}
              </div>
              <div style={{ color: colors.textMuted, marginTop: '2px' }}>
                숨겨진 사진
              </div>
            </div>
          </div>
          {roomStatistics.hidden_photos > 0 && (
            <div style={{
              fontSize: '10px',
              color: colors.textMuted,
              textAlign: 'center',
              marginTop: spacing.xs,
              fontStyle: 'italic'
            }}>
              💡 싫어요가 많은 사진은 자동으로 숨겨집니다
            </div>
          )}
        </div>
      )}

      {/* 참가자 태그들 */}
      {participants.length > 0 && (
        <div style={{ marginBottom: spacing.md }}>
          <div style={{
            fontSize: '12px',
            color: colors.textMuted,
            marginBottom: spacing.xs,
            fontWeight: '600'
          }}>
            참가자 ({participants.length}명)
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing.xs
          }}>
            {participants.map((participant) => (
              <button
                key={participant.name}
                onClick={() => handleParticipantClick(participant.name)}
                style={{
                  padding: `${spacing.xs} ${spacing.sm}`,
                  backgroundColor: selectedUploader === participant.name 
                    ? colors.primary 
                    : colors.light,
                  color: selectedUploader === participant.name 
                    ? 'white' 
                    : colors.text,
                  border: `1px solid ${selectedUploader === participant.name 
                    ? colors.primary 
                    : colors.border}`,
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (selectedUploader !== participant.name) {
                    e.currentTarget.style.backgroundColor = colors.border;
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedUploader !== participant.name) {
                    e.currentTarget.style.backgroundColor = colors.light;
                  }
                }}
              >
                <span>{participant.name}</span>
                <span style={{
                  backgroundColor: selectedUploader === participant.name 
                    ? 'rgba(255,255,255,0.2)' 
                    : colors.secondary,
                  color: selectedUploader === participant.name 
                    ? 'white' 
                    : 'white',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: '700'
                }}>
                  {participant.photo_count}
                </span>
              </button>
            ))}
          </div>
          {selectedUploader && (
            <div style={{
              marginTop: spacing.xs,
              fontSize: '11px',
              color: colors.textMuted,
              fontStyle: 'italic'
            }}>
              💡 {selectedUploader}님의 사진만 표시 중 (다시 클릭하면 전체 보기)
            </div>
          )}
        </div>
      )}

      {/* 사용자 이름 입력 */}
      <div style={{ marginBottom: spacing.md }}>
        <label style={{ 
          display: 'block',
          marginBottom: spacing.sm,
          fontSize: '14px',
          fontWeight: '600',
          color: colors.text
        }}>
          내 이름
        </label>
        <input
          ref={userNameRef}
          type="text"
          placeholder="이름을 입력하세요"
          defaultValue={(() => {
            if (!roomId) return '';
            const roomUserData = JSON.parse(localStorage.getItem('roomUsers') || '{}');
            const roomSpecificName = roomUserData[roomId];
            const globalName = localStorage.getItem('userName');
            console.log('🔍 Username loading - Room:', roomId, 'RoomSpecific:', roomSpecificName, 'Global:', globalName);
            return roomSpecificName || globalName || '';
          })()}
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && roomId) {
              // 방별 사용자 이름 저장
              const roomUserData = JSON.parse(localStorage.getItem('roomUsers') || '{}');
              roomUserData[roomId] = name;
              localStorage.setItem('roomUsers', JSON.stringify(roomUserData));
              
              // 전역 userName도 업데이트
              localStorage.setItem('userName', name);
              sessionStorage.setItem('userName', name);
              console.log('💾 Username updated for room:', roomId, 'name:', name);
            }
          }}
          style={{
            width: '100%',
            padding: spacing.md,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* 공유 버튼들 */}
      <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.sm }}>
        <button
          onClick={copyRoomId}
          style={{
            flex: 1,
            padding: spacing.sm,
            backgroundColor: colors.light,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          📋 ID 복사
        </button>
        <button
          onClick={copyRoomLink}
          style={{
            flex: 1,
            padding: spacing.sm,
            backgroundColor: colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          🔗 링크 공유
        </button>
      </div>
      
      {/* 백도어: '이성일'로 로그인한 사용자에게만 관리자 기능 표시 */}
      {(() => {
        const currentUserName = localStorage.getItem('userName') || '';
        return currentUserName === '이성일';
      })() && (
        <div style={{ marginTop: spacing.md }}>
          <button
            onClick={handleDeleteRoom}
            style={{
              width: '100%',
              padding: spacing.md,
              backgroundColor: colors.danger,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              transition: 'background-color 0.2s ease',
              marginBottom: spacing.sm
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = colors.danger;
            }}
          >
            🗑️ 방 삭제 (관리자)
          </button>
          
          {/* 디버깅용 localStorage 초기화 버튼 */}
          <button
            onClick={() => {
              if (window.confirm('localStorage를 초기화하시겠습니까?\n모든 저장된 사용자 이름이 삭제됩니다.')) {
                localStorage.removeItem('userName');
                localStorage.removeItem('roomUsers');
                sessionStorage.removeItem('userName');
                alert('localStorage가 초기화되었습니다.\n페이지를 새로고침해주세요.');
                window.location.reload();
              }
            }}
            style={{
              width: '100%',
              padding: spacing.sm,
              backgroundColor: colors.warning,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs
            }}
          >
            🔧 캐시 초기화 (디버깅)
          </button>
          
          <div style={{
            fontSize: '10px',
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: spacing.xs,
            fontStyle: 'italic'
          }}>
            ⚠️ 관리자 전용 기능입니다
          </div>
        </div>
      )}

      <div style={{ 
        fontSize: '11px',
        color: colors.textMuted,
        fontFamily: 'monospace',
        backgroundColor: colors.light,
        padding: spacing.xs,
        borderRadius: '6px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        marginTop: spacing.md
      }}>
        {roomId}
      </div>
    </div>
  );

  const TabNavigation = () => (
    <div style={{
      display: 'flex',
      backgroundColor: colors.background,
      borderRadius: '12px',
      padding: spacing.xs,
      marginBottom: spacing.lg,
      border: `1px solid ${colors.border}`
    }}>
      <button
        onClick={() => setActiveTab('gallery')}
        style={{
          flex: 1,
          padding: spacing.md,
          backgroundColor: activeTab === 'gallery' ? colors.primary : 'transparent',
          color: activeTab === 'gallery' ? 'white' : colors.text,
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        📷 갤러리 ({selectedUploader ? filteredPhotos.length : (roomStatistics?.visible_photos || photos.length)})
      </button>
      <button
        onClick={() => setActiveTab('upload')}
        style={{
          flex: 1,
          padding: spacing.md,
          backgroundColor: activeTab === 'upload' ? colors.primary : 'transparent',
          color: activeTab === 'upload' ? 'white' : colors.text,
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        📤 업로드
      </button>
    </div>
  );

  return (
    <MobileLayout 
      title={room.name}
      showBackButton
      onBack={() => navigate('/')}
    >
      <RoomInfo />
      <TabNavigation />
      
      {activeTab === 'gallery' ? (
        <PhotoGallery 
          photos={filteredPhotos} 
          roomId={roomId || ''}
          onPhotosUpdate={refreshRoomData}
        />
      ) : (
        <PhotoUpload 
          roomId={roomId || ''} 
          onUploadSuccess={handleUploadSuccess}
        />
      )}


      {/* 링크 공유 모달 */}
      {showLinkShareModal && (
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
              <div style={{ fontSize: '48px', marginBottom: spacing.md }}>🔗</div>
              <h2 style={{ 
                margin: `0 0 ${spacing.sm} 0`,
                fontSize: '24px',
                fontWeight: '600',
                color: colors.text
              }}>
                링크 공유 방식 선택
              </h2>
              <p style={{ 
                color: colors.textMuted,
                margin: 0,
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                어떤 방식으로 링크를 공유하시겠어요?
              </p>
            </div>

            <div style={{ marginBottom: spacing.lg }}>
              <div style={{
                backgroundColor: colors.light,
                borderRadius: '12px',
                padding: spacing.md,
                marginBottom: spacing.md,
                border: `1px solid ${colors.border}`
              }}>
                <div style={{ fontWeight: '600', color: colors.text, marginBottom: spacing.xs }}>
                  🌐 네트워크 링크 (추천)
                </div>
                <div style={{ fontSize: '12px', color: colors.textMuted, lineHeight: '1.4' }}>
                  같은 Wi-Fi에 연결된 다른 기기에서도 접근할 수 있습니다.
                  <br />
                  예: {getNetworkLink().replace(window.location.pathname, '').replace(window.location.search, '')}
                </div>
              </div>

              <div style={{
                backgroundColor: colors.light,
                borderRadius: '12px',
                padding: spacing.md,
                border: `1px solid ${colors.border}`
              }}>
                <div style={{ fontWeight: '600', color: colors.text, marginBottom: spacing.xs }}>
                  💻 로컬 링크
                </div>
                <div style={{ fontSize: '12px', color: colors.textMuted, lineHeight: '1.4' }}>
                  현재 기기에서만 접근할 수 있습니다.
                  <br />
                  예: localhost:3000
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: spacing.sm }}>
              <button
                onClick={() => handleLinkShare(false)}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  backgroundColor: colors.light,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
              >
                💻 로컬 링크
              </button>
              <button
                onClick={() => handleLinkShare(true)}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  backgroundColor: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
              >
                🌐 네트워크 링크
              </button>
            </div>

            <button
              onClick={() => setShowLinkShareModal(false)}
              style={{
                width: '100%',
                marginTop: spacing.md,
                padding: spacing.sm,
                backgroundColor: 'transparent',
                color: colors.textMuted,
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </MobileLayout>
  );
};

export default RoomPage;