import React, { useState, useEffect, useCallback } from 'react';
import { Photo } from '../types';
import { likeApi, dislikeApi, photoApi, roomApi } from '../services/api';
import { colors, spacing, shadows } from '../styles/responsive';
import { downloadImage, isIOS, showImagePreview } from '../utils/downloadUtils';

interface PhotoGalleryProps {
  photos: Photo[];
  roomId: string;
  onPhotosUpdate: () => void;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos, roomId, onPhotosUpdate }) => {
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [userDislikes, setUserDislikes] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [localPhotos, setLocalPhotos] = useState<Photo[]>(photos);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [likesLoaded, setLikesLoaded] = useState(false);

  const userName = localStorage.getItem('userName') || '';

  const loadParticipantCount = useCallback(async () => {
    try {
      const result = await roomApi.getParticipantsCount(roomId);
      setParticipantCount(result.participant_count);
    } catch (error) {
      console.error('Failed to load participant count:', error);
    }
  }, [roomId]);

  // 숨겨야 할 사진 필터링 (싫어요가 하나라도 있으면 숨김)
  const visiblePhotos = localPhotos.filter(photo => {
    return photo.dislike_count === 0; // 싫어요가 0개일 때만 표시
  });


  useEffect(() => {
    console.log('📸 Photos updated, checking if they include user status');
    
    // photos 배열이 실제로 변경되었는지 확인 (ID 기준)
    const currentPhotoIds = photos.map(p => p.id).sort().join(',');
    const localPhotoIds = localPhotos.map(p => p.id).sort().join(',');
    
    if (currentPhotoIds !== localPhotoIds) {
      console.log('📸 Photo list changed, updating local photos');
      setLocalPhotos(photos);
      
      // 새 API에서 user status가 포함되어 있는지 확인
      if (photos.length > 0 && photos[0].user_liked !== undefined) {
        console.log('✅ Photos already include user status, updating local state');
        const likes = new Set<string>();
        const dislikes = new Set<string>();
        
        photos.forEach(photo => {
          if (photo.user_liked) likes.add(photo.id);
          if (photo.user_disliked) dislikes.add(photo.id);
        });
        
        setUserLikes(likes);
        setUserDislikes(dislikes);
        setLikesLoaded(true);
      } else {
        setLikesLoaded(false); // 기존 API 응답인 경우 likes 다시 로드
      }
    }
  }, [photos, localPhotos]);

  useEffect(() => {
    loadParticipantCount();
  }, [loadParticipantCount]);

  const handleLike = async (photoId: string) => {
    if (!userName) {
      alert('이름을 입력해주세요.');
      return;
    }

    try {
      await likeApi.toggleLike(photoId, { user_name: userName });
      
      // 사용자 좋아요 상태 업데이트
      setUserLikes(prev => {
        const newLikes = new Set(prev);
        if (newLikes.has(photoId)) {
          newLikes.delete(photoId);
        } else {
          newLikes.add(photoId);
        }
        return newLikes;
      });
      
      // 로컬 사진 데이터에서 좋아요 수 업데이트
      setLocalPhotos(prev => 
        prev.map(photo => {
          if (photo.id === photoId) {
            const isLiked = userLikes.has(photoId);
            return {
              ...photo,
              like_count: isLiked ? photo.like_count - 1 : photo.like_count + 1
            };
          }
          return photo;
        })
      );
      
    } catch (error) {
      alert('좋아요 처리에 실패했습니다.');
    }
  };

  const handleDislike = async (photoId: string) => {
    if (!userName) {
      alert('이름을 입력해주세요.');
      return;
    }

    try {
      await dislikeApi.toggleDislike(photoId, { user_name: userName });
      
      // 사용자 싫어요 상태 업데이트
      setUserDislikes(prev => {
        const newDislikes = new Set(prev);
        if (newDislikes.has(photoId)) {
          newDislikes.delete(photoId);
        } else {
          newDislikes.add(photoId);
        }
        return newDislikes;
      });
      
      // 로컬 사진 데이터에서 싫어요 수 업데이트
      setLocalPhotos(prev => 
        prev.map(photo => {
          if (photo.id === photoId) {
            const isDisliked = userDislikes.has(photoId);
            return {
              ...photo,
              dislike_count: isDisliked ? photo.dislike_count - 1 : photo.dislike_count + 1
            };
          }
          return photo;
        })
      );
      
    } catch (error) {
      alert('싫어요 처리에 실패했습니다.');
    }
  };

  const handlePhotoSelect = (photoId: string) => {
    setSelectedPhotos(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(photoId)) {
        newSelected.delete(photoId);
      } else {
        newSelected.add(photoId);
      }
      return newSelected;
    });
  };

  const handleDownload = async (photo: Photo) => {
    setDownloading(prev => new Set(prev).add(photo.id));
    
    try {
      if (isIOS()) {
        // iOS에서는 이미지 미리보기 모달을 표시
        const imageUrl = `${window.location.protocol}//${window.location.hostname}:8000${photo.file_path}`;
        showImagePreview(imageUrl, photo.original_filename, () => {
          setDownloading(prev => {
            const newDownloading = new Set(prev);
            newDownloading.delete(photo.id);
            return newDownloading;
          });
        });
      } else {
        // 다른 플랫폼에서는 일반적인 다운로드
        const blob = await photoApi.downloadPhoto(photo.room_id, photo.id);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = photo.original_filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        setDownloading(prev => {
          const newDownloading = new Set(prev);
          newDownloading.delete(photo.id);
          return newDownloading;
        });
      }
    } catch (error) {
      alert('다운로드에 실패했습니다.');
      setDownloading(prev => {
        const newDownloading = new Set(prev);
        newDownloading.delete(photo.id);
        return newDownloading;
      });
    }
  };

  const handleBatchDownload = async () => {
    if (selectedPhotos.size === 0) {
      alert('다운로드할 사진을 선택해주세요.');
      return;
    }

    const selectedPhotoObjects = visiblePhotos.filter(photo => selectedPhotos.has(photo.id));
    
    if (isIOS()) {
      // iOS에서는 각 이미지를 새 탭으로 열어서 사용자가 저장할 수 있도록 함
      alert(`${selectedPhotoObjects.length}개의 사진을 새 탭으로 엽니다. 각 탭에서 이미지를 길게 눌러 저장하세요.`);
      
      for (let i = 0; i < selectedPhotoObjects.length; i++) {
        const photo = selectedPhotoObjects[i];
        const imageUrl = `${window.location.protocol}//${window.location.hostname}:8000${photo.file_path}`;
        
        setTimeout(() => {
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(`
              <html>
                <head>
                  <title>${photo.original_filename}</title>
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
                    .info {
                      color: white;
                      text-align: center;
                      margin-top: 20px;
                      padding: 15px;
                      background: rgba(255,255,255,0.1);
                      border-radius: 12px;
                      backdrop-filter: blur(10px);
                    }
                  </style>
                </head>
                <body>
                  <img src="${imageUrl}" alt="${photo.original_filename}" />
                  <div class="info">
                    <h3>📱 ${photo.original_filename}</h3>
                    <p>이미지를 길게 눌러서 "사진에 추가"를 선택하세요</p>
                    <p>${i + 1} / ${selectedPhotoObjects.length}</p>
                  </div>
                </body>
              </html>
            `);
            newWindow.document.close();
          }
        }, i * 1000); // 1초 간격으로 열기
      }
    } else {
      // 다른 플랫폼에서는 순차적으로 다운로드
      for (const photo of selectedPhotoObjects) {
        await handleDownload(photo);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setSelectedPhotos(new Set());
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '날짜 정보 없음';
    return new Date(dateString).toLocaleString();
  };

  const EmptyGallery = () => (
    <div style={{
      textAlign: 'center',
      padding: spacing.xxl,
      color: colors.textMuted
    }}>
      <div style={{ fontSize: '64px', marginBottom: spacing.lg }}>📷</div>
      <h3 style={{ margin: `0 0 ${spacing.md} 0`, color: colors.text }}>
        아직 업로드된 사진이 없어요
      </h3>
      <p style={{ margin: 0, lineHeight: '1.5' }}>
        첫 번째 여행 사진을 업로드해보세요!
      </p>
    </div>
  );

  const BatchActions = (): React.ReactElement | null => (
    selectedPhotos.size > 0 ? (
      <div style={{
        position: 'sticky',
        top: '70px',
        backgroundColor: colors.primary,
        color: 'white',
        padding: spacing.md,
        borderRadius: '12px',
        marginBottom: spacing.lg,
        boxShadow: shadows.md,
        zIndex: 100
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>
            {selectedPhotos.size}개 선택됨
          </span>
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <button
              onClick={handleBatchDownload}
              style={{
                padding: `${spacing.xs} ${spacing.sm}`,
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
{isIOS() ? '📱 저장' : '📥 다운로드'}
            </button>
            <button
              onClick={() => setSelectedPhotos(new Set())}
              style={{
                padding: `${spacing.xs} ${spacing.sm}`,
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              ✕ 해제
            </button>
          </div>
        </div>
      </div>
    ) : null
  );

  const PhotoCard = ({ photo }: { photo: Photo }) => (
    <div 
      style={{ 
        backgroundColor: colors.background,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: shadows.md,
        border: `1px solid ${colors.border}`,
        position: 'relative',
        marginBottom: spacing.md
      }}
    >
      <div style={{ position: 'relative' }}>
        <img
          src={`${window.location.protocol}//${window.location.hostname}:8000${photo.thumbnail_path || photo.file_path}`}
          alt={photo.original_filename}
          style={{ 
            width: '100%', 
            height: 'auto',
            display: 'block',
            cursor: 'pointer'
          }}
          onClick={() => handlePhotoSelect(photo.id)}
        />
        
        {/* 선택 표시 */}
        {selectedPhotos.has(photo.id) && (
          <div style={{
            position: 'absolute',
            top: spacing.sm,
            right: spacing.sm,
            width: '28px',
            height: '28px',
            backgroundColor: colors.primary,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: shadows.md
          }}>
            <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>✓</span>
          </div>
        )}

        {/* 날짜 오버레이 */}
        <div style={{
          position: 'absolute',
          bottom: spacing.xs,
          left: spacing.xs,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: `${spacing.xs} ${spacing.sm}`,
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '500',
          backdropFilter: 'blur(4px)'
        }}>
          📅 {formatDate(photo.taken_at)}
        </div>
      </div>
      
      {/* 컴팩트 정보 바 */}
      <div style={{ 
        padding: `${spacing.sm} ${spacing.md}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm
      }}>
        {/* 좋아요/싫어요 버튼 */}
        <div style={{ display: 'flex', gap: spacing.xs }}>
          <button
            onClick={() => handleLike(photo.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              color: userLikes.has(photo.id) ? colors.danger : colors.textMuted,
              fontSize: '14px',
              fontWeight: '600',
              padding: `${spacing.xs} ${spacing.sm}`,
              borderRadius: '20px',
              transition: 'background-color 0.2s ease',
              minWidth: '50px'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.backgroundColor = colors.light;
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span style={{ fontSize: '16px' }}>
              {userLikes.has(photo.id) ? '❤️' : '🤍'}
            </span>
            <span style={{ fontSize: '12px' }}>{photo.like_count}</span>
          </button>
          
          <button
            onClick={() => handleDislike(photo.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              color: userDislikes.has(photo.id) ? colors.warning : colors.textMuted,
              fontSize: '14px',
              fontWeight: '600',
              padding: `${spacing.xs} ${spacing.sm}`,
              borderRadius: '20px',
              transition: 'background-color 0.2s ease',
              minWidth: '50px'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.backgroundColor = colors.light;
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span style={{ fontSize: '16px' }}>
              {userDislikes.has(photo.id) ? '👎' : '👎🏻'}
            </span>
            <span style={{ fontSize: '12px' }}>{photo.dislike_count}</span>
          </button>
        </div>
        
        {/* 업로더 이름 */}
        <div style={{ 
          fontSize: '12px', 
          color: colors.textMuted,
          fontWeight: '500',
          flex: 1,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          👤 {photo.uploader_name}
        </div>
        
        {/* 저장 버튼 */}
        <button
          onClick={() => handleDownload(photo)}
          disabled={downloading.has(photo.id)}
          style={{
            padding: `${spacing.xs} ${spacing.sm}`,
            backgroundColor: downloading.has(photo.id) ? colors.secondary : colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            cursor: downloading.has(photo.id) ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            transition: 'background-color 0.2s ease',
            minWidth: '70px',
            justifyContent: 'center'
          }}
        >
          {downloading.has(photo.id) ? (
            <>
              <div style={{
                width: '10px',
                height: '10px',
                border: '1.5px solid transparent',
                borderTop: '1.5px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '10px' }}>
                {isIOS() ? '열기중' : '다운중'}
              </span>
            </>
          ) : (
            <span style={{ fontSize: '10px' }}>
              {isIOS() ? '📱 저장' : '📥 저장'}
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <BatchActions />
      
      {visiblePhotos.length === 0 ? (
        <EmptyGallery />
      ) : (
        <div 
          className="photo-grid"
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
            gap: spacing.md,
            gridAutoRows: 'auto'
          }}
        >
          {visiblePhotos.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .photo-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PhotoGallery;