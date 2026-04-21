/**
 * Shared auth utilities for the Rager portal.
 * Rager tokens are stored separately from founder/admin tokens.
 * Supports both localStorage (remember me) and sessionStorage (session-only).
 */

export function getRagerToken() {
  return (
    localStorage.getItem('rage_rager_token') ||
    sessionStorage.getItem('rage_rager_token')
  );
}

export function ragerAuthHeader() {
  const token = getRagerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function setRagerToken(token, remember = true) {
  if (remember) {
    localStorage.setItem('rage_rager_token', token);
    sessionStorage.removeItem('rage_rager_token');
  } else {
    sessionStorage.setItem('rage_rager_token', token);
    localStorage.removeItem('rage_rager_token');
  }
}

export function clearRagerToken() {
  localStorage.removeItem('rage_rager_token');
  sessionStorage.removeItem('rage_rager_token');
}
