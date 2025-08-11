import axios from 'axios';
import { Room, Photo, Like, RoomCreate, RoomJoin, LikeCreate } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const roomApi = {
  createRoom: async (roomData: RoomCreate): Promise<Room> => {
    const response = await api.post('/rooms/', roomData);
    return response.data;
  },

  getRoom: async (roomId: string): Promise<Room> => {
    const response = await api.get(`/rooms/${roomId}`);
    return response.data;
  },

  joinRoom: async (roomId: string, joinData: RoomJoin): Promise<any> => {
    const response = await api.post(`/rooms/${roomId}/join`, joinData);
    return response.data;
  },

  listRooms: async (): Promise<Room[]> => {
    const response = await api.get('/rooms/');
    return response.data;
  },
};

export const photoApi = {
  uploadPhoto: async (roomId: string, file: File, uploaderName: string): Promise<Photo> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploader_name', uploaderName);

    const response = await api.post(`/photos/${roomId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getRoomPhotos: async (roomId: string): Promise<Photo[]> => {
    const response = await api.get(`/photos/${roomId}`);
    return response.data;
  },

  downloadPhoto: async (roomId: string, photoId: string): Promise<Blob> => {
    const response = await api.get(`/photos/${roomId}/${photoId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export const likeApi = {
  toggleLike: async (photoId: string, likeData: LikeCreate): Promise<Like> => {
    const response = await api.post(`/likes/${photoId}`, likeData);
    return response.data;
  },

  getPhotoLikes: async (photoId: string): Promise<Like[]> => {
    const response = await api.get(`/likes/${photoId}`);
    return response.data;
  },

  checkUserLike: async (photoId: string, userName: string): Promise<{ liked: boolean }> => {
    const response = await api.get(`/likes/${photoId}/check/${userName}`);
    return response.data;
  },

  getLikeCount: async (photoId: string): Promise<{ count: number }> => {
    const response = await api.get(`/likes/${photoId}/count`);
    return response.data;
  },
};