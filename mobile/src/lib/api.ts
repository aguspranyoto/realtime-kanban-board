import axios from 'axios';
import { Platform } from 'react-native';
import { getToken } from './storage';

let baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

// Automatically adapt localhost for Android Emulator
if (Platform.OS === 'android' && baseURL.includes('localhost')) {
  baseURL = baseURL.replace('localhost', '10.0.2.2');
}

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
