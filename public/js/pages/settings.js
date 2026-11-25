import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { getTheme, toggleTheme } from '../core/theme.js';
import { getLang, setLang } from '../core/i18n.js';
import { resetDemoData } from '../core/db.js';
import { updateConfig } from '../services/store.service.js';
import { clearSession, isLocalSession } from '../services/api-client.js';

async function renderSettings() {
  const { config } = await initShell({
    activeNav: 'more',
    pageTitle: getLang() === 'bn' ? 'সেটিংস ও কাস্টমাইজেশন' : 'Settings & Preferences',
    onLangChange: renderSettings
  });

  const themeSw = document.getElementById('sw-theme');
  const proSw = document.getElementById('sw-pro-mode');
  const langBtn = document.getElementById('btn-set-lang');

  themeSw.setAttribute('aria-checked', String(getTheme() === 'dark'));
  proSw.setAttribute('aria-checked', String(config?.mode === 'pro'));
  langBtn.textContent = getLang() === 'bn' ? 'বাংলা (১২৩)' : 'English (123)';

  document.getElementById('set-shop-name').value = config?.shopName || '';
  document.getElementById('set-owner-name').value = config?.ownerName || '';
  document.getElementById('set-address').value = config?.address || '';

  const localStatus = document.getElementById('local-account-status');
  if (localStatus) {
    localStatus.textContent = isLocalSession()
      ? 'Local Account Mode চালু আছে। এই browser ও device-এর বাইরে এখনো data sync হবে না।'
      : 'এই সংস্করণে account ও হিসাব browser-এ সংরক্ষিত হয়।';
  }

  themeSw.onclick = () => {
    const next = toggleTheme();
    themeSw.setAttribute('aria-checked', String(next === 'dark'));
    showToast(next === 'dark' ? 'ডার্ক মোড চালু হয়েছে' : 'লাইট মোড চালু হয়েছে');
  };

  langBtn.onclick = () => {
    setLang(getLang() === 'bn' ? 'en' : 'bn');
    renderSettings();
  };

  proSw.onclick = async () => {
    const nextMode = proSw.getAttribute('aria-checked') === 'true' ? 'simple' : 'pro';
    await updateConfig({ mode: nextMode });
    proSw.setAttribute('aria-checked', String(nextMode === 'pro'));
    showToast(nextMode === 'pro' ? 'ব্যবসা প্রো টুলস চালু হয়েছে!' : 'সহজ মোড চালু হয়েছে');
  };
}

document.getElementById('set-shop-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await updateConfig({
    shopName: document.getElementById('set-shop-name').value.trim(),
    ownerName: document.getElementById('set-owner-name').value.trim(),
    address: document.getElementById('set-address').value.trim()
  });
  showToast('দোকানের তথ্য আপডেট হয়েছে!');
  renderSettings();
});

document.getElementById('btn-reset-db')?.addEventListener('click', async () => {
  if (!window.confirm('এই Account-এর এই device-এ থাকা local হিসাব মুছে নতুন করে শুরু করবেন?')) return;
  await resetDemoData();
  showToast('এই Account-এর local data reset হয়েছে');
  setTimeout(() => { window.location.href = './dashboard.html'; }, 500);
});

document.getElementById('btn-logout')?.addEventListener('click', () => {
  if (window.confirm('লগআউট করবেন?')) {
    clearSession();
    window.location.href = '../index.html';
  }
});

renderSettings();