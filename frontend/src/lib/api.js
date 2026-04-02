import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || 'https://rage-production.up.railway.app'}/api`;

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('rage_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    const isAuthEndpoint = err.config?.url?.includes('/auth/login') || err.config?.url?.includes('/rager/login');
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('rage_token');
      localStorage.removeItem('rage_user');
      sessionStorage.removeItem('rage_token');
      const isAdminPath = window.location.pathname.startsWith('/admin');
      window.location.href = isAdminPath ? '/admin-login' : '/rager-login';
    }
    return Promise.reject(err);
  }
);

export default api;
