import { applyTheme, toggleTheme, getTheme } from '../core/theme.js';
import { getLang, setLang } from '../core/i18n.js';
import { showToast } from '../components/toast.js';
import {
  hasSession, loginRequest, firebaseAuthRequest, firebaseRegisterRequest, apiRequest
} from '../services/api-client.js';
import {
  initializeFirebaseAuth, startGoogleSignIn, completeGoogleRedirect
} from '../services/firebase-auth.js';

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
applyTheme(getTheme());
if (hasSession()) window.location.replace('./pages/dashboard.html');

const langBtn = document.getElementById('login-lang-btn');
const themeBtn = document.querySelector('[data-theme-toggle]');
const form = document.getElementById('login-form');
const submitBtn = document.getElementById('btn-send-otp');
const googleStatus = document.getElementById('google-auth-status');
const googleButtonHost = document.getElementById('google-signin-button');
const googleOnboarding = document.getElementById('google-onboarding');
const googleOnboardingForm = document.getElementById('google-onboarding-form');
let pendingFirebaseIdToken = '';
let firebaseConfig = null;
let firebaseReady = false;

function renderLang() {
  const isBn = getLang() === 'bn';
  langBtn.textContent = isBn ? 'EN' : 'বাং';
  document.getElementById('login-title').textContent = isBn ? 'বাকির খাতা — ডিজিটাল লেজার' : 'Bakir Khata — Digital Ledger';
  document.getElementById('login-subtitle').textContent = isBn ? 'সহজ বাকি-জমার হিসাব, ভয়েস এন্ট্রি ও অফলাইন সুবিধা' : 'Simple credit tracking, voice entry and offline support';
  document.getElementById('login-card-title').textContent = isBn ? 'মার্চেন্ট লগইন' : 'Merchant Login';
  document.getElementById('btn-demo-login').textContent = isBn ? 'ডেমো দোকানে প্রবেশ করুন (রহিম জেনারেল স্টোর)' : 'Enter Demo Store (Rahim General Store)';
}

langBtn?.addEventListener('click', () => { setLang(getLang() === 'bn' ? 'en' : 'bn'); renderLang(); });
themeBtn?.addEventListener('click', () => toggleTheme());

async function doLogin(phone, password) {
  submitBtn.disabled = true;
  submitBtn.textContent = 'লগইন হচ্ছে...';
  try {
    await loginRequest(phone, password);
    showToast('সফলভাবে লগইন হয়েছে');
    window.location.href = './pages/dashboard.html';
  } catch (error) {
    showToast(error.message || 'লগইন করা যায়নি');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = getLang() === 'bn' ? 'লগইন করুন →' : 'Sign in →';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  doLogin(document.getElementById('login-phone').value.trim(), document.getElementById('login-password').value);
});

document.getElementById('btn-demo-login').addEventListener('click', () => {
  document.getElementById('login-phone').value = '01712987654';
  document.getElementById('login-password').value = 'Demo@12345';
  doLogin('01712987654', 'Demo@12345');
});

function showGoogleOnboarding(profile) {
  googleOnboarding.hidden = false;
  document.getElementById('google-profile-label').textContent = `${profile?.name || 'Google account'} · ${profile?.email || ''}`;
  document.getElementById('google-onboarding-error').hidden = true;
  googleOnboarding.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('google-phone').focus({ preventScroll: true });
}

async function handleFirebaseIdToken(idToken, profile = {}) {
  googleStatus.textContent = 'Google account Firebase-এর মাধ্যমে যাচাই করা হচ্ছে…';
  try {
    const result = await firebaseAuthRequest(idToken);
    if (result.requires_shop_setup) {
      pendingFirebaseIdToken = idToken;
      googleStatus.textContent = 'Google account verified. প্রথমবারের জন্য দোকানের তথ্য দিন।';
      showGoogleOnboarding(result.firebase_profile || profile);
      return;
    }
    showToast('Google দিয়ে সফলভাবে লগইন হয়েছে');
    window.location.href = './pages/dashboard.html';
  } catch (error) {
    googleStatus.textContent = error.message || 'Google login করা যায়নি';
    showToast(error.message || 'Google login করা যায়নি');
    const button = googleButtonHost.querySelector('button');
    if (button) button.disabled = false;
  }
}

function buildGoogleButton() {
  googleButtonHost.replaceChildren();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-google btn-block';
  button.setAttribute('aria-label', 'Continue with Google');
  button.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 3.2 13.22l7.98 6.19C13.08 13.72 18.1 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.72 7.18l7.62 5.91c4.45-4.11 7.14-10.16 7.14-17.56z"/><path fill="#FBBC05" d="M11.18 28.59A14.4 14.4 0 0 1 10.4 24c0-1.59.27-3.13.78-4.59L3.2 13.22A23.9 23.9 0 0 0 .7 24c0 3.86.92 7.51 2.5 10.78l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.89l-7.62-5.91c-2.12 1.42-4.83 2.27-8.28 2.27-5.9 0-10.92-4.22-12.72-9.91L3.2 34.78C6.51 42.62 14.62 48 24 48z"/></svg>`;
  const label = document.createElement('span');
  label.textContent = 'Continue with Google';
  button.appendChild(label);
  button.disabled = !firebaseReady;
  button.addEventListener('click', async () => {
    button.disabled = true;
    googleStatus.textContent = 'Google sign-in খোলা হচ্ছে…';
    try {
      const result = await startGoogleSignIn(firebaseConfig, 'login');
      if (result.redirecting) return;
      await handleFirebaseIdToken(result.idToken, result.profile);
    } catch (error) {
      googleStatus.textContent = error.message || 'Google sign-in করা যায়নি';
      showToast(error.message || 'Google sign-in করা যায়নি');
      button.disabled = false;
    }
  });
  googleButtonHost.appendChild(button);
}

async function initFirebaseSignIn() {
  try {
    const config = await apiRequest('/auth/config');
    if (!config.firebase_enabled || !config.firebase_config) {
      googleStatus.textContent = 'Google Login চালু করতে Firebase Web App configuration প্রয়োজন। Demo ও Mobile Login ব্যবহার করতে পারবেন।';
      return;
    }
    firebaseConfig = config.firebase_config;
    await initializeFirebaseAuth(firebaseConfig);
    firebaseReady = true;
    buildGoogleButton();

    const redirectResult = await completeGoogleRedirect(firebaseConfig);
    if (redirectResult?.flow === 'login') {
      await handleFirebaseIdToken(redirectResult.idToken, redirectResult.profile);
    } else {
      googleStatus.textContent = 'Firebase নিরাপদ Google Sign-In প্রস্তুত।';
    }
  } catch (error) {
    googleStatus.textContent = error.message || 'Firebase Authentication প্রস্তুত করা যায়নি';
    if (googleButtonHost.querySelector('button')) googleButtonHost.querySelector('button').disabled = true;
  }
}

googleOnboardingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!pendingFirebaseIdToken) { showToast('Google verification আবার করুন'); return; }
  const button = document.getElementById('btn-google-create-shop');
  const errorBox = document.getElementById('google-onboarding-error');
  button.disabled = true;
  button.textContent = 'অ্যাকাউন্ট তৈরি হচ্ছে…';
  errorBox.hidden = true;
  try {
    await firebaseRegisterRequest({
      id_token: pendingFirebaseIdToken,
      phone: document.getElementById('google-phone').value.trim(),
      shop_name: document.getElementById('google-shop-name').value.trim(),
      address: document.getElementById('google-address').value.trim(),
      business_type: document.getElementById('google-business-type').value,
    });
    pendingFirebaseIdToken = '';
    showToast('আপনার দোকানের অ্যাকাউন্ট তৈরি হয়েছে');
    window.location.href = './pages/dashboard.html';
  } catch (error) {
    errorBox.textContent = error.message || 'অ্যাকাউন্ট তৈরি করা যায়নি';
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Google দিয়ে অ্যাকাউন্ট তৈরি করুন →';
  }
});

document.getElementById('btn-google-cancel').addEventListener('click', () => {
  pendingFirebaseIdToken = '';
  googleOnboarding.hidden = true;
  googleStatus.textContent = 'আপনি চাইলে আবার Google দিয়ে sign in করতে পারেন।';
});

renderLang();
initFirebaseSignIn();
