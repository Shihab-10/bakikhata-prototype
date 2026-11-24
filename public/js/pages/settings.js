import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { getTheme, toggleTheme } from '../core/theme.js';
import { getLang, setLang } from '../core/i18n.js';
import { resetDemoData } from '../core/db.js';
import { updateConfig } from '../services/store.service.js';
import { clearSession, apiRequest, firebaseLinkRequest } from '../services/api-client.js';
import { initializeFirebaseAuth, startGoogleSignIn, completeGoogleRedirect, signOutFirebase } from '../services/firebase-auth.js';

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

  themeSw.onclick = () => {
    const next = toggleTheme();
    themeSw.setAttribute('aria-checked', String(next === 'dark'));
    showToast(next === 'dark' ? 'ডার্ক মোড চালু হয়েছে' : 'লাইট মোড চালু হয়েছে');
  };

  langBtn.onclick = () => { setLang(getLang() === 'bn' ? 'en' : 'bn'); renderSettings(); };

  proSw.onclick = async () => {
    const nextMode = proSw.getAttribute('aria-checked') === 'true' ? 'simple' : 'pro';
    await updateConfig({ mode: nextMode });
    proSw.setAttribute('aria-checked', String(nextMode === 'pro'));
    showToast(nextMode === 'pro' ? 'ব্যবসা প্রো টুলস চালু হয়েছে!' : 'সহজ মোড চালু হয়েছে');
  };

  await setupFirebaseGoogleLink();
}

async function setupFirebaseGoogleLink() {
  const container = document.getElementById('google-link-button');
  const status = document.getElementById('google-link-status');
  if (!container || !status) return;

  const completeLink = async (idToken) => {
    status.textContent = 'Firebase যাচাই করে Google account সংযুক্ত করা হচ্ছে…';
    try {
      const result = await firebaseLinkRequest(idToken);
      status.textContent = `${result.message}: ${result.email}`;
      showToast(result.message);
    } catch (error) {
      status.textContent = error.message || 'Google account যুক্ত করা যায়নি';
      showToast(error.message || 'Google account যুক্ত করা যায়নি');
      const linkButton = container.querySelector('button');
      if (linkButton) linkButton.disabled = false;
    }
  };

  try {
    const config = await apiRequest('/auth/config');
    if (!config.firebase_enabled || !config.firebase_config) {
      status.textContent = 'Google account link চালু করতে Firebase Web App configuration যোগ করুন।';
      return;
    }
    await initializeFirebaseAuth(config.firebase_config);

    const redirectResult = await completeGoogleRedirect(config.firebase_config);
    if (redirectResult?.flow === 'link') {
      await completeLink(redirectResult.idToken);
    }

    container.replaceChildren();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-google btn-block';
    button.textContent = 'Continue with Google';
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = 'Google sign-in খোলা হচ্ছে…';
      try {
        const result = await startGoogleSignIn(config.firebase_config, 'link');
        if (result.redirecting) return;
        await completeLink(result.idToken);
      } catch (error) {
        status.textContent = error.message || 'Google Sign-In প্রস্তুত করা যায়নি';
        showToast(error.message || 'Google Sign-In প্রস্তুত করা যায়নি');
        button.disabled = false;
      }
    });
    container.appendChild(button);
    status.textContent = 'আপনার বর্তমান merchant account-এর সাথে Google account যুক্ত করতে button চাপুন।';
  } catch (error) {
    status.textContent = error.message || 'Firebase Authentication প্রস্তুত করা যায়নি';
  }
}

document.getElementById('set-shop-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await updateConfig({
    shopName: document.getElementById('set-shop-name').value.trim(),
    ownerName: document.getElementById('set-owner-name').value.trim(),
    address: document.getElementById('set-address').value.trim()
  });
  showToast('দোকানের তথ্য আপডেট হয়েছে!');
  renderSettings();
});

document.getElementById('btn-reset-db')?.addEventListener('click', async () => {
  if (!window.confirm('এই ডিভাইসের local cache মুছবেন? সার্ভারের হিসাব মুছবে না। আগে sync হয়েছে কি না নিশ্চিত করুন।')) return;
  await resetDemoData();
  showToast('এই ডিভাইসের local cache reset হয়েছে');
  setTimeout(() => { window.location.href = './dashboard.html'; }, 500);
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  if (window.confirm('লগআউট করবেন?')) {
    await signOutFirebase();
    clearSession();
    window.location.href = '../index.html';
  }
});

renderSettings();
