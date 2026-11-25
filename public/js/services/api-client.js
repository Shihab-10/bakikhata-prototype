const API_BASE = '/api/v1';
const TOKEN_KEY = 'bakikhata_access_token';
const SESSION_KEY = 'bakikhata_session';
const AUTH_DB_NAME = 'BakirKhataLocalAuthDB';
const AUTH_DB_VERSION = 2;
const PBKDF2_ITERATIONS = 310000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const LOCAL_ONLY_MODE = true;
const DEMO_PHONE = '01712987654';
const DEMO_PASSWORD = 'Demo@12345';

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

const digitMap = new Map();
for (let i = 0; i < 10; i += 1) {
  digitMap.set(BANGLA_DIGITS[i], String(i));
  digitMap.set(ARABIC_DIGITS[i], String(i));
  digitMap.set(EASTERN_ARABIC_DIGITS[i], String(i));
}

export function getAccessToken() {
  try { return globalThis.localStorage?.getItem(TOKEN_KEY) || ''; }
  catch { return ''; }
}

export function getCachedSession() {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(SESSION_KEY) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function isValidLocalSession(session, token = getAccessToken()) {
  return Boolean(
    token &&
    token.startsWith('local.') &&
    session?.authMode === 'local' &&
    session?.user?.id &&
    session?.user?.phone &&
    session?.shop?.id &&
    session?.shop?.name
  );
}

export function isLocalSession() {
  return isValidLocalSession(getCachedSession());
}

export function isLocalOnlyMode() {
  return LOCAL_ONLY_MODE;
}

export function hasSession() {
  const token = getAccessToken();
  const session = getCachedSession();

  if (!isValidLocalSession(session, token)) {
    if (token || session) clearSession();
    return false;
  }
  return true;
}

export function saveSession(data) {
  if (!data?.access_token) throw new Error('সার্ভার থেকে login token পাওয়া যায়নি');
  const session = {
    user: data.user,
    shop: data.shop,
    savedAt: new Date().toISOString(),
    authMode: data.authMode || 'remote'
  };
  try {
    globalThis.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    globalThis.localStorage.setItem(TOKEN_KEY, data.access_token);
  } catch {
    clearSession();
    throw new Error('এই browser-এ Session সংরক্ষণ করা যাচ্ছে না। Browser storage অনুমতি চালু করে আবার চেষ্টা করুন।');
  }
  return session;
}

export function clearSession() {
  try {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    globalThis.localStorage?.removeItem(SESSION_KEY);
  } catch { /* browser storage may be unavailable */ }
}

function normalizePhone(phone) {
  const translated = Array.from(String(phone ?? ''), (character) => digitMap.get(character) ?? character).join('');
  let digits = translated.replace(/\D/g, '');

  if (digits.startsWith('880') && digits.length === 13) digits = `0${digits.slice(3)}`;
  if (!/^01[3-9]\d{8}$/.test(digits)) {
    throw new Error('সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন (যেমন 01712345678)');
  }
  return digits;
}

function ensureCryptoSupport() {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle) {
    throw new Error('নিরাপদ Login-এর জন্য Chrome/Edge-এর HTTPS Live Link ব্যবহার করুন।');
  }
}

function ensureLocalStorageSupport() {
  try {
    const key = '__bk_auth_storage_test__';
    globalThis.localStorage.setItem(key, '1');
    globalThis.localStorage.removeItem(key);
  } catch {
    throw new Error('Browser storage বন্ধ আছে। Chrome Settings থেকে এই Website-এর Cookies/Site data অনুমতি দিন।');
  }
}

function randomHex(byteLength = 16) {
  ensureCryptoSupport();
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomId() {
  ensureCryptoSupport();
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${randomHex(16)}`;
}

function hexToBytes(hex) {
  if (typeof hex !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(hex)) {
    throw new Error('Account-এর নিরাপত্তা তথ্য সঠিক নয়।');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function derivePasswordHash(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  ensureCryptoSupport();
  const salt = hexToBytes(saltHex);
  if (salt.length < 16 || salt.length > 64) throw new Error('Account-এর নিরাপত্তা তথ্য সঠিক নয়।');

  const rounds = Number.isSafeInteger(Number(iterations))
    && Number(iterations) >= 100000
    && Number(iterations) <= 500000
    ? Number(iterations)
    : PBKDF2_ITERATIONS;

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) {
    difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return difference === 0;
}

function openAuthDB() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('এই Browser-এ Local Account Storage পাওয়া যাচ্ছে না। Chrome বা Edge ব্যবহার করুন।'));
      return;
    }

    let settled = false;
    let request;
    try {
      request = globalThis.indexedDB.open(AUTH_DB_NAME, AUTH_DB_VERSION);
    } catch {
      reject(new Error('Account Database খোলা যাচ্ছে না। Browser বন্ধ করে আবার চেষ্টা করুন।'));
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'phone' });
      }
    };

    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(new Error('Account Database খোলা যায়নি। Browser-এর Site data অনুমতি পরীক্ষা করুন।'));
    };

    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error('BakiKhata অন্য Tab-এ খোলা আছে। অন্য BakiKhata Tab বন্ধ করে আবার চেষ্টা করুন।'));
    };
  });
}

async function accountStoreRequest(mode, operation) {
  const db = await openAuthDB();

  return new Promise((resolve, reject) => {
    let result;
    let request;
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      try { db.close(); } catch { /* ignore */ }
      callback(value);
    };

    try {
      const transaction = db.transaction('accounts', mode);
      const store = transaction.objectStore('accounts');
      request = operation(store);

      request.onsuccess = () => { result = request.result ?? null; };
      request.onerror = () => {
        // Let IndexedDB abort the transaction; its error is handled below.
      };

      transaction.oncomplete = () => finish(resolve, result);
      transaction.onerror = () => finish(reject, transaction.error || request?.error || new Error('Account Database Error'));
      transaction.onabort = () => finish(reject, transaction.error || request?.error || new Error('Account Database transaction বাতিল হয়েছে'));
    } catch (error) {
      finish(reject, error);
    }
  });
}

async function getLocalAccount(phone) {
  return accountStoreRequest('readonly', (store) => store.get(phone));
}

async function addLocalAccount(account) {
  return accountStoreRequest('readwrite', (store) => store.add(account)).then(() => account);
}

async function updateLocalAccount(account) {
  return accountStoreRequest('readwrite', (store) => store.put(account)).then(() => account);
}

async function activateLocalSession(account) {
  ensureLocalStorageSupport();

  if (!account?.user_id || !account?.phone || !account?.shop?.id || !account?.shop?.name) {
    throw new Error('Account-এর তথ্য অসম্পূর্ণ। আবার Sign In করুন।');
  }

  const token = `local.${randomHex(24)}`;
  const user = {
    id: account.user_id,
    phone: account.phone,
    full_name: account.full_name
  };
  const shop = {
    id: account.shop.id,
    name: account.shop.name,
    address: account.shop.address || '',
    business_type: account.shop.business_type || 'grocery',
    role: 'owner'
  };
  const session = {
    authMode: 'local',
    legacyDemo: Boolean(account.legacyDemo),
    user,
    shop,
    savedAt: new Date().toISOString()
  };

  try {
    // Write the session first and the token last; hasSession() only accepts both.
    globalThis.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    globalThis.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    clearSession();
    throw new Error('Account ঠিক আছে, কিন্তু Browser Login Session সংরক্ষণ করতে পারেনি। Site data অনুমতি দিয়ে আবার Login করুন।');
  }

  if (!hasSession()) {
    clearSession();
    throw new Error('Login Session তৈরি হয়নি। Browser refresh করে আবার চেষ্টা করুন।');
  }

  return { access_token: token, token_type: 'bearer', authMode: 'local', user, shop };
}

function makeDemoAccount() {
  const salt = randomHex(16);
  return {
    phone: DEMO_PHONE,
    full_name: 'আব্দুর রহিম',
    user_id: 'demo-local-user',
    password_salt: salt,
    password_hash: null,
    password_iterations: PBKDF2_ITERATIONS,
    legacyDemo: true,
    shop: {
      id: 'demo-local-shop',
      name: 'রহিম জেনারেল স্টোর',
      address: 'সদর বাজার, চন্দনাইশ',
      business_type: 'grocery'
    },
    created_at: new Date().toISOString()
  };
}

async function createDemoAccount() {
  const existing = await getLocalAccount(DEMO_PHONE);
  if (existing) return existing;

  const account = makeDemoAccount();
  account.password_hash = await derivePasswordHash(DEMO_PASSWORD, account.password_salt);

  try {
    await addLocalAccount(account);
    return account;
  } catch (error) {
    if (error?.name === 'ConstraintError') {
      const racedAccount = await getLocalAccount(DEMO_PHONE);
      if (racedAccount) return racedAccount;
    }
    throw error;
  }
}

async function repairDemoAccountIfNeeded(account, password) {
  if (!account?.legacyDemo || account.phone !== DEMO_PHONE || password !== DEMO_PASSWORD) return account;

  let valid = false;
  try {
    if (account.password_salt && account.password_hash) {
      const actual = await derivePasswordHash(
        password,
        account.password_salt,
        account.password_iterations || PBKDF2_ITERATIONS
      );
      valid = constantTimeEqual(actual, account.password_hash);
    }
  } catch {
    valid = false;
  }

  if (valid) return account;

  // Repair only the built-in demo credential; preserve its shop identity and ledger.
  const salt = randomHex(16);
  const repaired = {
    ...account,
    password_salt: salt,
    password_hash: await derivePasswordHash(password, salt),
    password_iterations: PBKDF2_ITERATIONS
  };
  await updateLocalAccount(repaired);
  return repaired;
}

function validatePassword(password, { forLogin = false } = {}) {
  if (typeof password !== 'string') throw new Error('পাসওয়ার্ড দিন');
  if (password.length > MAX_PASSWORD_LENGTH) throw new Error('পাসওয়ার্ড ১২৮ অক্ষরের মধ্যে রাখুন');
  if (forLogin && password.length === 0) throw new Error('পাসওয়ার্ড দিন');
  if (!forLogin && password.length < MIN_PASSWORD_LENGTH) {
    throw new Error('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে');
  }
}

export async function loginRequest(phone, password) {
  ensureCryptoSupport();
  ensureLocalStorageSupport();

  const normalizedPhone = normalizePhone(phone);
  validatePassword(password, { forLogin: true });

  let account = await getLocalAccount(normalizedPhone);

  if (!account && normalizedPhone === DEMO_PHONE && password === DEMO_PASSWORD) {
    account = await createDemoAccount();
  }

  if (!account) {
    throw new Error('এই মোবাইল নম্বরে Account পাওয়া যায়নি। নতুন দোকান খুলতে Sign Up করুন।');
  }

  account = await repairDemoAccountIfNeeded(account, password);

  if (!account.password_salt || !account.password_hash) {
    throw new Error('এই Account-এর Password তথ্য পাওয়া যাচ্ছে না। Demo হলে Demo Login ব্যবহার করুন; অন্যথায় নতুন Account তৈরি করুন।');
  }

  const actualHash = await derivePasswordHash(
    password,
    account.password_salt,
    account.password_iterations || PBKDF2_ITERATIONS
  );

  if (!constantTimeEqual(actualHash, account.password_hash)) {
    throw new Error('মোবাইল নম্বর অথবা পাসওয়ার্ড সঠিক নয়। আবার পরীক্ষা করুন।');
  }

  return activateLocalSession(account);
}

export async function registerRequest(payload) {
  ensureCryptoSupport();
  ensureLocalStorageSupport();

  const phone = normalizePhone(payload?.phone);
  const password = String(payload?.password ?? '');
  const ownerName = String(payload?.owner_name ?? '').trim();
  const shopName = String(payload?.shop_name ?? '').trim();
  const address = String(payload?.address ?? '').trim();
  const allowedBusinessTypes = new Set(['grocery', 'tong', 'pharmacy', 'hardware', 'wholesale']);
  const requestedBusinessType = String(payload?.business_type || 'grocery').trim();
  const businessType = allowedBusinessTypes.has(requestedBusinessType) ? requestedBusinessType : 'grocery';

  validatePassword(password);

  if (phone === DEMO_PHONE) {
    throw new Error('এই নম্বরটি Demo Account-এর জন্য সংরক্ষিত। অন্য মোবাইল নম্বর ব্যবহার করুন।');
  }
  if (ownerName.length < 2 || ownerName.length > 160) {
    throw new Error('মালিকের নাম ২ থেকে ১৬০ অক্ষরের মধ্যে দিন');
  }
  if (shopName.length < 2 || shopName.length > 180) {
    throw new Error('দোকানের নাম ২ থেকে ১৮০ অক্ষরের মধ্যে দিন');
  }
  if (address.length > 255) throw new Error('ঠিকানা ২৫৫ অক্ষরের মধ্যে রাখুন');

  const existing = await getLocalAccount(phone);
  if (existing) throw new Error('এই মোবাইল নম্বর দিয়ে আগে Account খোলা হয়েছে। Sign In করুন।');

  const salt = randomHex(16);
  const account = {
    phone,
    full_name: ownerName,
    user_id: `local-user-${randomId()}`,
    password_salt: salt,
    password_hash: await derivePasswordHash(password, salt),
    password_iterations: PBKDF2_ITERATIONS,
    legacyDemo: false,
    shop: {
      id: `local-shop-${randomId()}`,
      name: shopName,
      address,
      business_type: businessType
    },
    created_at: new Date().toISOString()
  };

  try {
    await addLocalAccount(account);
  } catch (error) {
    if (error?.name === 'ConstraintError') {
      throw new Error('এই মোবাইল নম্বর দিয়ে আগে Account খোলা হয়েছে। Sign In করুন।');
    }
    throw error;
  }

  return activateLocalSession(account);
}

export function logoutRequest() {
  clearSession();
}

export async function apiRequest(path, options = {}) {
  if (LOCAL_ONLY_MODE) {
    throw new Error('এই সংস্করণে Cloud API বন্ধ আছে। Account ও হিসাব এই browser-এ সংরক্ষিত হচ্ছে।');
  }

  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('সার্ভারের সাথে সংযোগ করা যাচ্ছে না। ইন্টারনেট/সার্ভার পরীক্ষা করুন।');
  }

  let data = {};
  try { data = await response.json(); } catch { /* empty response */ }
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/register') clearSession();
    const detail = data?.detail;
    throw new Error(typeof detail === 'string' ? detail : `API request failed (${response.status})`);
  }
  return data;
}

export async function googleAuthRequest() {
  throw new Error('এই Local Account সংস্করণে Google Sign-In বন্ধ আছে। মোবাইল নম্বর ও পাসওয়ার্ড ব্যবহার করুন।');
}
export async function googleRegisterRequest() {
  throw new Error('এই Local Account সংস্করণে Google Sign-Up বন্ধ আছে। মোবাইল নম্বর ব্যবহার করুন।');
}
export async function googleLinkRequest() {
  throw new Error('Google account linking পরবর্তী Cloud সংস্করণে চালু হবে।');
}
export async function firebaseAuthRequest() {
  throw new Error('এই Local Account সংস্করণে Firebase Sign-In বন্ধ আছে। মোবাইল নম্বর ব্যবহার করুন।');
}
export async function firebaseRegisterRequest() {
  throw new Error('এই Local Account সংস্করণে Firebase Sign-Up বন্ধ আছে। মোবাইল নম্বর ব্যবহার করুন।');
}
export async function firebaseLinkRequest() {
  throw new Error('Firebase account linking পরবর্তী Cloud সংস্করণে চালু হবে।');
}