import { initShell } from '../components/shell.js';
import { openVoiceModal } from '../components/voice-modal.js';
import { formatTaka, formatShortDate, localizeDigits, getLang } from '../core/i18n.js';
import { getDashboardSummary, listCustomers, listTransactions } from '../services/store.service.js';
import { escapeHtml } from '../core/sanitize.js';

async function renderDashboard() {
  const { config } = await initShell({
    activeNav: 'home',
    pageTitle: getLang() === 'bn' ? 'সহজ দৈনিক খাতা' : 'Daily Ledger',
    onLangChange: renderDashboard
  });

  const [summary, customers, transactions] = await Promise.all([
    getDashboardSummary(), listCustomers(), listTransactions()
  ]);

  const lang = getLang();
  document.getElementById('dash-total-due').textContent = formatTaka(summary.totalReceivable);
  document.getElementById('dash-cust-count').textContent = `${localizeDigits(summary.customerCount)} ${lang === 'bn' ? 'জন খরিদ্দার' : 'Customers'}`;
  document.getElementById('dash-payable-note').textContent = `${lang === 'bn' ? 'মহাজন দেনা:' : 'Payable:'} ${formatTaka(summary.totalPayable)}`;
  document.getElementById('dash-sync-note').textContent =
    summary.pendingSyncCount > 0
      ? `${localizeDigits(summary.pendingSyncCount)} ${lang === 'bn' ? 'টি অফলাইন বাকি সিঙ্ক' : 'pending sync'}`
      : (lang === 'bn' ? 'সব হিসাব সিঙ্কড' : 'All synced');

  document.getElementById('dash-today-in').textContent = formatTaka(summary.todayCashIn);
  document.getElementById('dash-today-out').textContent = formatTaka(summary.todayCredit);

  const isPro = config?.mode === 'pro';
  document.getElementById('dash-shortcuts').innerHTML = isPro
    ? `
      <a href="./customers.html?add=1" class="quick-tile"><div class="quick-tile-icon badge-green">👤</div><span>${lang === 'bn' ? 'নতুন কাস্টমার' : 'Add Client'}</span></a>
      <a href="./cash-memo.html" class="quick-tile"><div class="quick-tile-icon badge-amber">🧾</div><span>${lang === 'bn' ? 'ক্যাশ মেমো' : 'Cash Memo'}</span></a>
      <a href="./inventory.html" class="quick-tile"><div class="quick-tile-icon badge-neutral">📦</div><span>${lang === 'bn' ? 'স্টক খাতা' : 'Inventory'}</span></a>
      <a href="./cashbook-pnl.html" class="quick-tile"><div class="quick-tile-icon badge-red">📊</div><span>${lang === 'bn' ? 'লাভ-ক্যাশ' : 'P&L Cash'}</span></a>
    `
    : `
      <a href="./customers.html?add=1" class="quick-tile"><div class="quick-tile-icon badge-green">👤</div><span>${lang === 'bn' ? '+ খরিদ্দার' : '+ Customer'}</span></a>
      <a href="./history.html" class="quick-tile"><div class="quick-tile-icon badge-amber">📒</div><span>${lang === 'bn' ? 'লেনদেন ইতিহাস' : 'History'}</span></a>
      <a href="./offline-sync.html" class="quick-tile"><div class="quick-tile-icon badge-red">☁️</div><span>${lang === 'bn' ? 'সিঙ্ক ও ব্যাকআপ' : 'Sync & Backup'}</span></a>
      <a href="./more-tools.html" class="quick-tile"><div class="quick-tile-icon badge-neutral">🧰</div><span>${lang === 'bn' ? 'সব টুলস' : 'All Tools'}</span></a>
    `;

  const feedEl = document.getElementById('dash-feed');
  const searchInput = document.getElementById('dash-search');

  function renderFeed(query = '') {
    const q = query.trim().toLowerCase();
    if (q) {
      document.getElementById('dash-list-heading').textContent = lang === 'bn' ? 'খুঁজে পাওয়া খরিদ্দার' : 'Matching Customers';
      const matched = customers.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.alias || '').toLowerCase().includes(q) || (c.area || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
      );
      feedEl.innerHTML = matched.length
        ? matched.map((c) => `
          <a href="./customer-ledger.html?id=${encodeURIComponent(c.id)}" class="card card-stripe ${c.balance > 0 ? 'stripe-red' : 'stripe-green'} flex-between">
            <div class="flex-row">
              <div class="avatar ${c.balance > 0 ? 'avatar-red' : ''}">${escapeHtml(c.name.slice(0, 1))}</div>
              <div>
                <div class="t-label">${escapeHtml(c.name)} ${c.area ? `<span class="badge badge-neutral">${escapeHtml(c.area)}</span>` : ''}</div>
                <div class="t-caption">${localizeDigits(escapeHtml(c.phone || ''))}</div>
              </div>
            </div>
            <div class="t-h2 t-num ${c.balance > 0 ? 'text-red' : 'text-emerald'}">${formatTaka(c.balance)}</div>
          </a>`).join('')
        : `<div class="card-low t-caption">${lang === 'bn' ? 'কোনো খরিদ্দার পাওয়া যায়নি' : 'No matching customers'}</div>`;
      return;
    }

    document.getElementById('dash-list-heading').textContent = lang === 'bn' ? 'সাম্প্রতিক লেনদেন' : 'Recent Transactions';
    feedEl.innerHTML = transactions.slice(0, 6).map((tx) => {
      const isDue = tx.txType === 'credit_given';
      const isPaid = tx.txType === 'payment_received';
      const link = tx.partyType === 'customer' ? `./customer-ledger.html?id=${encodeURIComponent(tx.partyId)}` : './suppliers.html';
      const label = isDue ? (lang === 'bn' ? 'বাকি যোগ' : 'Due added') : isPaid ? (lang === 'bn' ? 'জমা গ্রহণ' : 'Payment') : (lang === 'bn' ? 'অন্যান্য' : 'Other');
      return `
        <a href="${link}" class="card card-stripe ${isPaid ? 'stripe-green' : 'stripe-red'} flex-between">
          <div>
            <div class="t-label">${escapeHtml(tx.partyName || '')}</div>
            <div class="t-caption">${escapeHtml(tx.note || '')} • ${formatShortDate(tx.createdAt)}</div>
          </div>
          <div style="text-align:right;">
            <div class="t-h2 t-num ${isPaid ? 'text-emerald' : 'text-red'}">${isDue ? '+' : isPaid ? '−' : ''}${formatTaka(tx.amount)}</div>
            <span class="badge ${isPaid ? 'badge-green' : 'badge-red'}">${label}</span>
          </div>
        </a>`;
    }).join('');
  }

  searchInput.oninput = (e) => renderFeed(e.target.value);
  renderFeed(searchInput.value);

  const openVoice = () => openVoiceModal({ onSaved: renderDashboard });
  document.getElementById('dash-voice-btn').onclick = openVoice;
  document.getElementById('dash-mic-btn').onclick = openVoice;
}

renderDashboard();
