import axios from 'axios';
import { EnvConfig } from '../config/env';

let currentAuthToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
}

export function getAuthToken(): string | null {
  return currentAuthToken;
}

export const api = axios.create({
  baseURL: EnvConfig.getApiUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  config => {
    config.baseURL = EnvConfig.getApiUrl();
    if (currentAuthToken) {
      config.headers.Authorization = `Bearer ${currentAuthToken}`;
    } else {
      delete config.headers.Authorization;
    }
    return config;
  },
  error => Promise.reject(error),
);
