import { applyTheme, toggleTheme, getTheme } from '../core/theme.js';
import { showToast } from '../components/toast.js';
import { registerRequest } from '../services/api-client.js';

applyTheme(getTheme());
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => toggleTheme());

const form = document.getElementById('register-form');
const submit = document.getElementById('register-submit');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    shop_name: document.getElementById('reg-shop').value.trim(),
    owner_name: document.getElementById('reg-owner').value.trim(),
    business_type: document.getElementById('reg-category').value,
    address: document.getElementById('reg-address').value.trim(),
    phone: document.getElementById('reg-phone').value.trim(),
    password: document.getElementById('reg-password').value,
  };
  submit.disabled = true;
  submit.textContent = 'দোকান তৈরি হচ্ছে...';
  try {
    await registerRequest(payload);
    showToast('দোকান ও অ্যাকাউন্ট তৈরি হয়েছে');
    window.location.href = './dashboard.html';
  } catch (error) {
    showToast(error.message || 'রেজিস্ট্রেশন করা যায়নি');
  } finally {
    submit.disabled = false;
    submit.textContent = 'দোকান চালু করুন →';
  }
});
