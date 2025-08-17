import axios from 'axios';
import { Room, Photo, Like, Dislike, RoomCreate, RoomJoin, LikeCreate, DislikeCreate, Participant } from '../types';

// CSRF Token management
let csrfToken: string | null = null;

const getCSRFToken = (): string | null => {
  // Try to get CSRF token from meta tag
  const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
  if (metaTag) {
    return metaTag.getAttribute('content');
  }
  
  // Try to get from cookie
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf_token') {
      return decodeURIComponent(value);
    }
  }
  
  return csrfToken;
};

const setCSRFToken = (token: string) => {
  csrfToken = token;
};

// API URL 결정 로직 - 환경 변수 우선, 그 다음 동적 결정
const getApiBaseUrl = () => {
  // 환경 변수가 설정되어 있으면 그것을 사용 (프로덕션 환경)
  if (process.env.REACT_APP_API_URL) {
    console.log('🌟 Using environment variable API URL:', process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }
  
  // 개발 환경에서는 현재 접속 방식에 따라 API URL을 동적으로 결정
  const currentHostname = window.location.hostname;
  console.log('🔍 Current hostname:', currentHostname);
  
  // 개발 환경에서 동적 포트 설정 사용
  const defaultPort = process.env.REACT_APP_API_PORT || '8000';
  
  // localhost/127.0.0.1로 접근하는 경우: localhost API 사용 (개발 환경)
  if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
    console.log('💻 Localhost access detected - using localhost API');
    return `http://localhost:${defaultPort}/api`;
  }
  
  // 네트워크 IP로 접근하는 경우: 해당 IP의 API 사용
  const networkApiUrl = `http://${currentHostname}:${defaultPort}/api`;
  console.log('🌐 Network access detected - using network API:', networkApiUrl);
  return networkApiUrl;
};

const API_BASE_URL = getApiBaseUrl();
console.log('🔗 Final API Base URL:', API_BASE_URL);

// 이미지 URL을 위한 base URL - 별도 포트 사용 가능
export const getImageBaseUrl = (): string => {
  // 환경 변수로 이미지 전용 URL이 설정되어 있으면 사용
  if (process.env.REACT_APP_IMAGE_BASE_URL) {
    console.log('🖼️ Using dedicated image base URL:', process.env.REACT_APP_IMAGE_BASE_URL);
    return process.env.REACT_APP_IMAGE_BASE_URL;
  }
  
  // 기본값: API URL에서 /api만 제거 (기존 방식)
  const imageBaseUrl = API_BASE_URL.replace('/api', '');
  console.log('🖼️ Using API-derived image base URL:', imageBaseUrl);
  return imageBaseUrl;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // CSRF protection
  },
});

// Request interceptor to add CSRF token and validate requests
api.interceptors.request.use(
  (config) => {
    // Add CSRF token to requests
    const token = getCSRFToken();
    if (token && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      config.headers['X-CSRF-Token'] = token;
    }
    
    // Add basic XSS protection headers
    config.headers['X-Content-Type-Options'] = 'nosniff';
    
    // Validate URL to prevent SSRF
    if (config.url && !config.url.startsWith('/') && !config.url.startsWith(API_BASE_URL)) {
      throw new Error('Invalid request URL');
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and security
api.interceptors.response.use(
  (response) => {
    // Update CSRF token if provided in response
    const newToken = response.headers['x-csrf-token'];
    if (newToken) {
      setCSRFToken(newToken);
    }
    
    return response;
  },
  (error) => {
    // Enhanced error logging for network issues
    console.error('🚨 API Request Error:', {
      url: error.config?.url,
      method: error.config?.method,
      baseURL: error.config?.baseURL,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      code: error.code
    });
    
    // Handle common security-related errors
    if (error.response?.status === 419) {
      // CSRF token mismatch
      console.error('CSRF token mismatch. Please refresh the page.');
    } else if (error.response?.status === 429) {
      // Rate limit exceeded
      console.error('Too many requests. Please slow down.');
    } else if (error.response?.status === 403) {
      // Forbidden - might be security related
      console.error('Access denied. Please check your permissions.');
    } else if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      console.error('🌐 Network connection failed. Check if backend server is running on:', API_BASE_URL);
    }
    
    return Promise.reject(error);
  }
);

export const roomApi = {
  createRoom: async (roomData: RoomCreate): Promise<Room> => {
    // Validate and sanitize input
    if (!validateInput.roomName(roomData.name)) {
      throw new Error('Invalid room name');
    }
    
    if (!validateInput.userName(roomData.creator_name)) {
      throw new Error('Invalid creator name');
    }
    
    const sanitizedData = {
      ...roomData,
      name: sanitizeInput(roomData.name),
      creator_name: sanitizeInput(roomData.creator_name),
      description: roomData.description ? sanitizeInput(roomData.description) : undefined
    };
    
    const response = await api.post('/rooms/', sanitizedData);
    return response.data;
  },

  getRoom: async (roomId: string): Promise<Room> => {
    if (!validateInput.roomId(roomId)) {
      throw new Error('Invalid room ID format');
    }
    
    const response = await api.get(`/rooms/${roomId}`);
    return response.data;
  },

  joinRoom: async (roomId: string, joinData: RoomJoin): Promise<any> => {
    if (!validateInput.roomId(roomId)) {
      throw new Error('Invalid room ID format');
    }
    
    if (!validateInput.userName(joinData.user_name)) {
      throw new Error('Invalid username');
    }
    
    const sanitizedData = {
      user_name: sanitizeInput(joinData.user_name)
    };
    
    const response = await api.post(`/rooms/${roomId}/join`, sanitizedData);
    return response.data;
  },

  listRooms: async (): Promise<Room[]> => {
    const response = await api.get('/rooms/');
    return response.data;
  },

  getParticipantsCount: async (roomId: string): Promise<{ participant_count: number }> => {
    if (!validateInput.roomId(roomId)) {
      throw new Error('Invalid room ID format');
    }
    
    const response = await api.get(`/rooms/${roomId}/participants`);
    return response.data;
  },

  getParticipantsList: async (roomId: string): Promise<{ participants: Participant[] }> => {
    if (!validateInput.roomId(roomId)) {
      throw new Error('Invalid room ID format');
    }
    
    const response = await api.get(`/rooms/${roomId}/participants/list`);
    return response.data;
  },

  deleteRoom: async (roomId: string): Promise<{ message: string; room_id: string; room_name: string; deleted_photos_count: number; deleted_by: string }> => {
    if (!validateInput.roomId(roomId)) {
      throw new Error('Invalid room ID format');
    }
    
    const response = await api.delete(`/rooms/${roomId}`);
    return response.data;
  },
};

// Input validation helpers
const validateInput = {
  roomId: (roomId: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(roomId);
  },
  
  userName: (userName: string): boolean => {
    return userName.length >= 2 && userName.length <= 50 && /^[가-힣a-zA-Z0-9._-]+$/.test(userName);
  },
  
  roomName: (roomName: string): boolean => {
    return roomName.length >= 1 && roomName.length <= 100 && /^[가-힣a-zA-Z0-9\s._-]+$/.test(roomName);
  },
  
  file: (file: File): { valid: boolean; error?: string } => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' };
    }
    
    if (file.size > maxSize) {
      return { valid: false, error: 'File too large. Maximum size is 10MB.' };
    }
    
    // Check for suspicious filenames
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      return { valid: false, error: 'Invalid filename.' };
    }
    
    return { valid: true };
  }
};

// Sanitize user input to prevent XSS
const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
};

export const photoApi = {
  uploadPhoto: async (roomId: string, file: File, uploaderName: string): Promise<Photo> => {
    // Validate inputs
    if (!validateInput.roomId(roomId)) {
      throw new Error('Invalid room ID format');
    }
    
    if (!validateInput.userName(uploaderName)) {
      throw new Error('Invalid username');
    }
    
    const fileValidation = validateInput.file(file);
    if (!fileValidation.valid) {
      throw new Error(fileValidation.error || 'Invalid file');
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploader_name', sanitizeInput(uploaderName));

    const response = await api.post(`/photos/${roomId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getRoomPhotos: async (roomId: string): Promise<Photo[]> => {
    if (!validateInput.roomId(roomId)) {
      throw new Error('Invalid room ID format');
    }
    
    const response = await api.get(`/photos/${roomId}`);
    return response.data;
  },

  getRoomPhotosWithUserStatus: async (roomId: string, userName: string): Promise<Photo[]> => {
    console.log('🔍 getRoomPhotosWithUserStatus called with:', { roomId, userName });
    
    if (!validateInput.roomId(roomId)) {
      throw new Error('Invalid room ID format');
    }
    
    if (!validateInput.userName(userName)) {
      throw new Error('Invalid username');
    }
    
    const sanitizedUserName = sanitizeInput(userName);
    console.log('🧹 Sanitized username:', sanitizedUserName);
    
    const url = `/photos/${roomId}/with-user-status`;
    console.log('🌐 Making request to:', url);
    console.log('📊 With params:', { user_name: sanitizedUserName });
    
    const response = await api.get(url, {
      params: {
        user_name: sanitizedUserName
      }
    });
    
    console.log('✅ getRoomPhotosWithUserStatus response:', response.data.length, 'photos');
    return response.data;
  },

  downloadPhoto: async (roomId: string, photoId: string): Promise<Blob> => {
    if (!validateInput.roomId(roomId)) {
      throw new Error('Invalid room ID format');
    }
    
    if (!validateInput.roomId(photoId)) { // Photos also use UUID format
      throw new Error('Invalid photo ID format');
    }
    
    const response = await api.get(`/photos/${roomId}/${photoId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export const likeApi = {
  toggleLike: async (photoId: string, likeData: LikeCreate): Promise<Like> => {
    if (!validateInput.roomId(photoId)) { // Photos use UUID format
      throw new Error('Invalid photo ID format');
    }
    
    if (!validateInput.userName(likeData.user_name)) {
      throw new Error('Invalid username');
    }
    
    const sanitizedData = {
      user_name: sanitizeInput(likeData.user_name)
    };
    
    const response = await api.post(`/likes/${photoId}`, sanitizedData);
    return response.data;
  },

  getPhotoLikes: async (photoId: string): Promise<Like[]> => {
    if (!validateInput.roomId(photoId)) {
      throw new Error('Invalid photo ID format');
    }
    
    const response = await api.get(`/likes/${photoId}`);
    return response.data;
  },

  checkUserLike: async (photoId: string, userName: string): Promise<{ liked: boolean }> => {
    if (!validateInput.roomId(photoId)) {
      throw new Error('Invalid photo ID format');
    }
    
    if (!validateInput.userName(userName)) {
      throw new Error('Invalid username');
    }
    
    const response = await api.get(`/likes/${photoId}/check/${encodeURIComponent(userName)}`);
    return response.data;
  },

  getLikeCount: async (photoId: string): Promise<{ count: number }> => {
    if (!validateInput.roomId(photoId)) {
      throw new Error('Invalid photo ID format');
    }
    
    const response = await api.get(`/likes/${photoId}/count`);
    return response.data;
  },
};

export const dislikeApi = {
  toggleDislike: async (photoId: string, dislikeData: DislikeCreate): Promise<Dislike> => {
    if (!validateInput.roomId(photoId)) {
      throw new Error('Invalid photo ID format');
    }
    
    if (!validateInput.userName(dislikeData.user_name)) {
      throw new Error('Invalid username');
    }
    
    const sanitizedData = {
      user_name: sanitizeInput(dislikeData.user_name)
    };
    
    const response = await api.post(`/dislikes/${photoId}`, sanitizedData);
    return response.data;
  },

  checkUserDislike: async (photoId: string, userName: string): Promise<{ disliked: boolean }> => {
    if (!validateInput.roomId(photoId)) {
      throw new Error('Invalid photo ID format');
    }
    
    if (!validateInput.userName(userName)) {
      throw new Error('Invalid username');
    }
    
    const response = await api.get(`/dislikes/${photoId}/check/${encodeURIComponent(userName)}`);
    return response.data;
  },
};

// Export utilities for use in components
export { validateInput, sanitizeInput, getCSRFToken, setCSRFToken };