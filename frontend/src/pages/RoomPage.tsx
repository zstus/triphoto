import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { roomApi, photoApi } from '../services/api';
import { Room, Photo, Participant } from '../types';
import PhotoUpload from '../components/PhotoUpload';
import PhotoGallery from '../components/PhotoGallery';
import MobileLayout from '../components/MobileLayout';
import UserLoginModal from '../components/UserLoginModal';
import { colors, spacing, shadows } from '../styles/responsive';

const RoomPage: React.FC = () => {
  console.log('🏠 RoomPage component mounted');
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  console.log('🆔 Room ID from params:', roomId);
  
  const [room, setRoom] = useState<Room | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
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
        const [roomData, photosData, participantsData] = await Promise.all([
          roomApi.getRoom(roomId),
          userName && userName.trim().length >= 2 
            ? photoApi.getRoomPhotosWithUserStatus(roomId, userName)
            : photoApi.getRoomPhotos(roomId),
          roomApi.getParticipantsList(roomId)
        ]);
        setRoom(roomData);
        setPhotos(photosData);
        setParticipants(participantsData.participants);
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
        const [roomData, photosData, participantsData] = await Promise.all([
          roomApi.getRoom(roomId),
          userName && userName.trim().length >= 2 
            ? photoApi.getRoomPhotosWithUserStatus(roomId, userName)
            : photoApi.getRoomPhotos(roomId),
          roomApi.getParticipantsList(roomId)
        ]);
        setRoom(roomData);
        setPhotos(photosData);
        setParticipants(participantsData.participants);
        setActiveTab('gallery');
      } catch (error: any) {
        console.error('❌ Failed to refresh data after upload:', error);
      }
    }
  }, [roomId]);

  useEffect(() => {
    console.log('🔥 useEffect triggered with roomId:', roomId);
    if (!roomId) {
      console.log('❌ No roomId in useEffect');
      return;
    }

    // 먼저 방별 사용자 이름 확인
    const roomUserData = JSON.parse(localStorage.getItem('roomUsers') || '{}');
    let userName = roomUserData[roomId] || localStorage.getItem('userName');
    console.log('👤 Room-specific userName:', roomUserData[roomId]);
    console.log('👤 Global userName:', localStorage.getItem('userName'));
    console.log('👤 Final userName:', userName);
    console.log('🌐 Current hostname:', window.location.hostname);
    
    // 네트워크 IP 접근 시 사용자 이름이 없으면 sessionStorage도 확인
    if (!userName && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      // 세션 스토리지에서 확인 (같은 브라우저 세션 내에서 유지)
      const sessionUserName = sessionStorage.getItem('userName');
      if (sessionUserName) {
        userName = sessionUserName;
        localStorage.setItem('userName', userName);
        console.log('🔄 Recovered username from session:', userName);
      } else {
        // 네트워크 접근 시 임시로 기본 사용자 이름 생성 (무한 루프 방지)
        const tempUserName = 'NetworkUser';
        localStorage.setItem('userName', tempUserName);
        sessionStorage.setItem('userName', tempUserName);
        userName = tempUserName;
        console.log('🌐 Network access: using temporary username to prevent infinite loop:', userName);
      }
    }
    
    if (userName && userName.trim().length >= 2) {
      console.log('✅ Valid username found, loading room data directly');
      
      // loadRoomData 호출 대신 직접 실행
      const loadData = async () => {
        console.log('🔄 Loading room data for:', roomId);
        setLoading(true);
        try {
          console.log('📡 Making API requests...');
          console.log('👤 Username for API call:', userName);
          console.log('🌐 Will use new API:', userName && userName.trim().length >= 2);
          
          const roomData = await roomApi.getRoom(roomId);
          console.log('✅ Room data loaded');
          
          const photosData = userName && userName.trim().length >= 2 
            ? await photoApi.getRoomPhotosWithUserStatus(roomId, userName)
            : await photoApi.getRoomPhotos(roomId);
          console.log('✅ Photos data loaded:', photosData.length, 'photos');
          
          const participantsData = await roomApi.getParticipantsList(roomId);
          console.log('✅ Participants data loaded');
          
          setRoom(roomData);
          setPhotos(photosData);
          setParticipants(participantsData.participants);
        } catch (error: any) {
          console.error('❌ Failed to load room data:', error);
          console.error('❌ Error details:', {
            message: error?.message,
            response: error?.response,
            status: error?.response?.status,
            data: error?.response?.data
          });
          alert('방 정보를 불러올 수 없습니다.');
        } finally {
          setLoading(false);
        }
      };
      
      loadData();
    } else {
      console.log('🚪 Showing login modal');
      setShowLoginModal(true);
    }
  }, [roomId]); // roomId만 의존성으로 유지

  const handleLogin = async (userName: string) => {
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
      const [roomData, photosData, participantsData] = await Promise.all([
        roomApi.getRoom(roomId),
        userName && userName.trim().length >= 2 
          ? photoApi.getRoomPhotosWithUserStatus(roomId, userName)
          : photoApi.getRoomPhotos(roomId),
        roomApi.getParticipantsList(roomId)
      ]);
      
      console.log('✅ Room data loaded after login');
      setRoom(roomData);
      setPhotos(photosData);
      setParticipants(participantsData.participants);
    } catch (error: any) {
      console.error('❌ Failed to load room data after login:', error);
      alert('방 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

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
          marginLeft: spacing.sm
        }}>
          {selectedUploader ? filteredPhotos.length : photos.length}
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
            return roomUserData[roomId] || localStorage.getItem('userName') || '';
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
      
      <div style={{ 
        fontSize: '11px',
        color: colors.textMuted,
        fontFamily: 'monospace',
        backgroundColor: colors.light,
        padding: spacing.xs,
        borderRadius: '6px',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
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
        📷 갤러리 ({selectedUploader ? filteredPhotos.length : photos.length})
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

      {/* 로그인 모달 */}
      {showLoginModal && roomId && (
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