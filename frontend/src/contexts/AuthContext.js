import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

function getToken() {
  return localStorage.getItem('rage_token') || sessionStorage.getItem('rage_token');
}

function setToken(token, remember) {
  if (remember) {
    localStorage.setItem('rage_token', token);
    sessionStorage.removeItem('rage_token');
  } else {
    sessionStorage.setItem('rage_token', token);
    localStorage.removeItem('rage_token');
  }
}

function clearToken() {
  localStorage.removeItem('rage_token');
  localStorage.removeItem('rage_user');
  sessionStorage.removeItem('rage_token');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (err) {
      // Only clear token on 401 — not on network errors or 5xx (Railway cold start, etc.)
      if (err.response?.status === 401) {
        clearToken();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const login = async (email, password, remember = true) => {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.data.token, remember);
    setUser(res.data.user);
    return res.data;
  };

  const signup = async (data) => {
    const res = await api.post('/auth/signup', data);
    setToken(res.data.token, true);
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const loginWithData = (token, user) => {
    setToken(token, true);
    setUser(user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, loginWithData }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
