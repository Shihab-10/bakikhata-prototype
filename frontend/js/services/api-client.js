const API_BASE = '/api/v1';
const TOKEN_KEY = 'bakikhata_access_token';
const SESSION_KEY = 'bakikhata_session';

export function getAccessToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
export function hasSession() { return Boolean(getAccessToken()); }
export function getCachedSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
export function saveSession(data) {
  if (!data?.access_token) throw new Error('সার্ভার থেকে login token পাওয়া যায়নি');
  localStorage.setItem(TOKEN_KEY, data.access_token);
  const session = { user: data.user, shop: data.shop, savedAt: new Date().toISOString() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error('সার্ভারের সাথে সংযোগ করা যাচ্ছে না। ইন্টারনেট/সার্ভার পরীক্ষা করুন।');
  }
  let data = {};
  try { data = await response.json(); } catch { /* response may be empty */ }
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/register') clearSession();
    const detail = data?.detail;
    throw new Error(typeof detail === 'string' ? detail : `API request failed (${response.status})`);
  }
  return data;
}

export async function loginRequest(phone, password) {
  const data = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
  saveSession(data);
  return data;
}
export async function registerRequest(payload) {
  const data = await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  saveSession(data);
  return data;
}
export async function logoutRequest() { clearSession(); }


export async function googleAuthRequest(credential) {
  const data = await apiRequest('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
  if (data?.access_token) saveSession(data);
  return data;
}

export async function googleRegisterRequest(payload) {
  const data = await apiRequest('/auth/google/register', { method: 'POST', body: JSON.stringify(payload) });
  saveSession(data);
  return data;
}

export async function googleLinkRequest(credential) {
  return apiRequest('/auth/google/link', { method: 'POST', body: JSON.stringify({ credential }) });
}


export async function firebaseAuthRequest(idToken) {
  const data = await apiRequest('/auth/firebase', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken })
  });
  if (data?.access_token) saveSession(data);
  return data;
}

export async function firebaseRegisterRequest(payload) {
  const data = await apiRequest('/auth/firebase/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  saveSession(data);
  return data;
}

export async function firebaseLinkRequest(idToken) {
  return apiRequest('/auth/firebase/link', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken })
  });
}
