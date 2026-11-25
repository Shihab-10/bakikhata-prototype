import { applyTheme, toggleTheme, getTheme } from '../core/theme.js';
import { getLang, setLang } from '../core/i18n.js';
import { showToast } from '../components/toast.js';
import { hasSession, loginRequest } from '../services/api-client.js';

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

applyTheme(getTheme());
if (hasSession()) window.location.replace('./pages/dashboard.html');

const langBtn = document.getElementById('login-lang-btn');
const themeBtn = document.querySelector('[data-theme-toggle]');
const form = document.getElementById('login-form');
const submitBtn = document.getElementById('btn-send-otp');
const demoBtn = document.getElementById('btn-demo-login');
const phoneInput = document.getElementById('login-phone');
const passwordInput = document.getElementById('login-password');
const feedback = document.getElementById('auth-feedback');
const passwordToggle = document.getElementById('toggle-login-password');

let loginInProgress = false;

function setFeedback(message = '', state = 'error') {
  if (!feedback) {
    if (message) showToast(message);
    return;
  }
  feedback.textContent = message;
  feedback.dataset.state = state;
  feedback.hidden = !message;
}

function renderLang() {
  const isBn = getLang() === 'bn';
  if (langBtn) langBtn.textContent = isBn ? 'EN' : 'বাং';
  document.getElementById('login-title').textContent = isBn ? 'বাকির খাতা — ডিজিটাল লেজার' : 'Bakir Khata — Digital Ledger';
  document.getElementById('login-subtitle').textContent = isBn
    ? 'দোকানের বাকি-জমার হিসাব, ভয়েস এন্ট্রি ও অফলাইন সুবিধা'
    : 'Shop credit ledger, voice entry and offline support';
  document.getElementById('login-card-title').textContent = isBn ? 'মার্চেন্ট লগইন' : 'Merchant Sign In';
  document.getElementById('login-card-sub').textContent = isBn
    ? 'এই browser-এ তৈরি করা Account দিয়ে প্রবেশ করুন'
    : 'Sign in with an account created in this browser';
  if (demoBtn) demoBtn.textContent = isBn
    ? 'ডেমো দোকানে প্রবেশ করুন (রহিম জেনারেল স্টোর)'
    : 'Enter Demo Store (Rahim General Store)';
  document.getElementById('login-mode-badge').textContent = isBn ? 'লোকাল অ্যাকাউন্ট মোড' : 'Local Account Mode';
  document.getElementById('login-local-note').textContent = isBn
    ? 'আপনার Account ও হিসাব এই browser ও device-এ সংরক্ষিত থাকবে। Cloud Sync পরবর্তী ধাপে চালু হবে।'
    : 'Your account and ledger are saved in this browser and device. Cloud sync will be added later.';
  if (passwordToggle) passwordToggle.textContent = passwordInput.type === 'password'
    ? (isBn ? 'দেখুন' : 'Show')
    : (isBn ? 'লুকান' : 'Hide');
}

langBtn?.addEventListener('click', () => {
  setLang(getLang() === 'bn' ? 'en' : 'bn');
  renderLang();
});
themeBtn?.addEventListener('click', () => toggleTheme());

passwordToggle?.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  renderLang();
  passwordToggle.setAttribute('aria-pressed', String(!showing));
});

async function doLogin(phone, password) {
  if (loginInProgress) return;
  loginInProgress = true;
  setFeedback('');
  submitBtn.disabled = true;
  if (demoBtn) demoBtn.disabled = true;
  submitBtn.setAttribute('aria-busy', 'true');
  submitBtn.textContent = getLang() === 'bn' ? 'লগইন হচ্ছে...' : 'Signing in...';

  try {
    await loginRequest(phone, password);
    setFeedback(getLang() === 'bn' ? 'লগইন সফল হয়েছে। Dashboard খোলা হচ্ছে...' : 'Login successful. Opening dashboard...', 'success');
    showToast('সফলভাবে লগইন হয়েছে');
    window.location.replace('./pages/dashboard.html');
  } catch (error) {
    const message = error?.message || 'লগইন করা যায়নি। আবার চেষ্টা করুন।';
    setFeedback(message, 'error');
    showToast(message);
    passwordInput?.focus();
    passwordInput?.select();
  } finally {
    loginInProgress = false;
    submitBtn.disabled = false;
    if (demoBtn) demoBtn.disabled = false;
    submitBtn.removeAttribute('aria-busy');
    submitBtn.textContent = getLang() === 'bn' ? 'লগইন করুন →' : 'Sign in →';
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  doLogin(phoneInput.value, passwordInput.value);
});

demoBtn?.addEventListener('click', () => {
  phoneInput.value = '01712987654';
  passwordInput.value = 'Demo@12345';
  doLogin(phoneInput.value, passwordInput.value);
});

renderLang();
