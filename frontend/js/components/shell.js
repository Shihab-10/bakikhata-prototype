import { applyTheme, toggleTheme, getTheme } from '../core/theme.js';
import { applyTranslations, getLang, setLang, t } from '../core/i18n.js';
import { getConfig, getDashboardSummary, syncNow } from '../services/store.service.js';
import { hasSession, clearSession } from '../services/api-client.js';
import { escapeHtml } from '../core/sanitize.js';

export function getBasePath() {
  return window.location.pathname.includes('/pages/') ? '..' : '.';
}

export async function initShell({ activeNav = 'home', pageTitle = '', showBottomNav = true, onLangChange } = {}) {
  const base = getBasePath();
  if (!hasSession()) { window.location.replace(`${base}/index.html`); return { config: null, summary: null }; }
  if (navigator.onLine) { try { await syncNow(); } catch { /* keep local offline cache */ } }
  if (!hasSession()) { window.location.replace(`${base}/index.html`); return { config: null, summary: null }; }
  applyTheme(getTheme());
  const [config, summary] = await Promise.all([getConfig(), getDashboardSummary()]);

  const headerMount = document.getElementById('app-header');
  if (headerMount) {
    const isOffline = Boolean(config?.offlineSimulated) || !navigator.onLine;
    const statusLabel = isOffline ? t('offline') : t('online');
    headerMount.className = 'app-header pt-safe no-print';
    headerMount.innerHTML = `
      <div class="app-header-inner">
        <a href="${base}/pages/dashboard.html" class="header-brand">
          <div class="header-logo">খ</div>
          <div class="header-titles">
            <div class="header-shop-row">
              <span class="header-shop-name">${escapeHtml(config?.shopName || t('app_name'))}</span>
              <span class="badge ${isOffline ? 'badge-amber' : 'badge-green'}">
                <span class="status-dot ${isOffline ? 'offline' : 'online'}"></span>
                ${statusLabel}
              </span>
            </div>
            <span class="header-subtitle">${pageTitle || t('app_name')}</span>
          </div>
        </a>
        <div class="header-actions">
          <button type="button" class="icon-btn" data-lang-toggle aria-label="Switch Language">${getLang() === 'bn' ? 'EN' : 'বাং'}</button>
          <button type="button" class="icon-btn" data-theme-toggle aria-label="Toggle Theme">${getTheme() === 'dark' ? '☀️' : '🌙'}</button>
          <a href="${base}/pages/settings.html" class="icon-btn" aria-label="Settings">⚙️</a>
          <button type="button" class="icon-btn" data-logout aria-label="Logout" title="Logout">↪</button>
        </div>
      </div>
    `;
    headerMount.querySelector('[data-theme-toggle]')?.addEventListener('click', () => toggleTheme());
    headerMount.querySelector('[data-logout]')?.addEventListener('click', () => {
      if (window.confirm('আপনি কি লগআউট করতে চান?')) { clearSession(); window.location.href = `${base}/index.html`; }
    });
    headerMount.querySelector('[data-lang-toggle]')?.addEventListener('click', () => {
      setLang(getLang() === 'bn' ? 'en' : 'bn');
      if (typeof onLangChange === 'function') onLangChange();
      else window.location.reload();
    });
  }

  const navMount = document.getElementById('app-bottom-nav');
  if (navMount && showBottomNav) {
    navMount.className = 'bottom-nav pb-safe no-print';
    navMount.innerHTML = `
      <div class="bottom-nav-inner">
        <a href="${base}/pages/dashboard.html" class="nav-item ${activeNav === 'home' ? 'active' : ''}">
          <span class="nav-icon">🏠</span><span data-i18n="nav_home">${t('nav_home')}</span>
        </a>
        <a href="${base}/pages/customers.html" class="nav-item ${activeNav === 'customers' ? 'active' : ''}">
          <span class="nav-icon">👥</span><span data-i18n="nav_customers">${t('nav_customers')}</span>
        </a>
        <a href="${base}/pages/quick-entry.html" class="nav-fab-wrap">
          <div class="nav-fab">+</div><span class="nav-fab-label" data-i18n="nav_entry">${t('nav_entry')}</span>
        </a>
        <a href="${base}/pages/history.html" class="nav-item ${activeNav === 'history' ? 'active' : ''}">
          <span class="nav-icon">📒</span><span>ইতিহাস</span>
        </a>
        <a href="${base}/pages/more-tools.html" class="nav-item ${activeNav === 'more' ? 'active' : ''}">
          <span class="nav-icon">☰</span><span data-i18n="nav_more">${t('nav_more')}</span>
        </a>
      </div>
    `;
  }

  applyTranslations();
  return { config, summary };
}
