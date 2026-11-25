import { applyTheme, toggleTheme, getTheme } from '../core/theme.js';
import { showToast } from '../components/toast.js';
import { registerRequest } from '../services/api-client.js';

applyTheme(getTheme());
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => toggleTheme());

const form = document.getElementById('register-form');
const submit = document.getElementById('register-submit');
const feedback = document.getElementById('auth-feedback');
const passwordInput = document.getElementById('reg-password');
const passwordToggle = document.getElementById('toggle-register-password');

function setFeedback(message = '', state = 'error') {
  if (!feedback) {
    if (message) showToast(message);
    return;
  }
  feedback.textContent = message;
  feedback.dataset.state = state;
  feedback.hidden = !message;
}

passwordToggle?.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  passwordToggle.textContent = showing ? 'দেখুন' : 'লুকান';
  passwordToggle.setAttribute('aria-pressed', String(!showing));
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;

  const payload = {
    shop_name: document.getElementById('reg-shop').value.trim(),
    owner_name: document.getElementById('reg-owner').value.trim(),
    business_type: document.getElementById('reg-category').value,
    address: document.getElementById('reg-address').value.trim(),
    phone: document.getElementById('reg-phone').value.trim(),
    password: passwordInput.value,
  };

  setFeedback('');
  submit.disabled = true;
  submit.setAttribute('aria-busy', 'true');
  submit.textContent = 'দোকান তৈরি হচ্ছে...';

  try {
    await registerRequest(payload);
    setFeedback('দোকান ও অ্যাকাউন্ট তৈরি হয়েছে। Dashboard খোলা হচ্ছে...', 'success');
    showToast('দোকান ও অ্যাকাউন্ট তৈরি হয়েছে');
    window.location.replace('./dashboard.html');
  } catch (error) {
    const message = error?.message || 'রেজিস্ট্রেশন করা যায়নি। আবার চেষ্টা করুন।';
    setFeedback(message, 'error');
    showToast(message);
  } finally {
    submit.disabled = false;
    submit.removeAttribute('aria-busy');
    submit.textContent = 'দোকান চালু করুন →';
  }
});
