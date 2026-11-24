import { initShell } from '../components/shell.js';
import { openVoiceModal } from '../components/voice-modal.js';
import { showToast } from '../components/toast.js';
import { formatTaka, localizeDigits, getLang } from '../core/i18n.js';
import { listCustomers, saveCustomer } from '../services/store.service.js';
import { escapeHtml } from '../core/sanitize.js';

let activeFilter = new URLSearchParams(window.location.search).get('filter') || 'all';

function daysSince(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

async function renderPage() {
  await initShell({
    activeNav: 'customers',
    pageTitle: getLang() === 'bn' ? 'সকল খরিদ্দার ও তাগাদা' : 'Customers & Reminders',
    onLangChange: renderPage
  });

  const lang = getLang();
  const customers = await listCustomers();
  const listEl = document.getElementById('cust-list');
  const searchEl = document.getElementById('cust-search');

  function draw() {
    const q = searchEl.value.trim().toLowerCase();
    const filtered = customers.filter((c) => {
      const matchText = !q || c.name.toLowerCase().includes(q) || (c.alias || '').toLowerCase().includes(q) || (c.area || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
      if (!matchText) return false;
      if (activeFilter === 'due') return c.balance > 0;
      if (activeFilter === 'overdue') return c.balance > 0 && daysSince(c.lastTxAt) >= 15;
      if (activeFilter === 'settled') return c.balance <= 0;
      return true;
    });

    if (!filtered.length) {
      listEl.innerHTML = `<div class="card-low t-body text-muted">${lang === 'bn' ? 'কোনো খরিদ্দার নেই' : 'No customers found'}</div>`;
      return;
    }

    listEl.innerHTML = filtered.map((c) => {
      const age = daysSince(c.lastTxAt);
      const isOverdue = c.balance > 0 && age >= 15;
      return `
        <div class="card card-stripe ${c.balance > 0 ? 'stripe-red' : 'stripe-green'} stack-sm">
          <a href="./customer-ledger.html?id=${encodeURIComponent(c.id)}" class="flex-between">
            <div class="flex-row">
              <div class="avatar ${c.balance > 0 ? 'avatar-red' : ''}">${escapeHtml(c.name.slice(0, 1))}</div>
              <div>
                <div class="flex-row">
                  <span class="t-label">${escapeHtml(c.name)}</span>
                  ${c.area ? `<span class="badge badge-neutral">${escapeHtml(c.area)}</span>` : ''}
                  ${isOverdue ? `<span class="badge badge-red">${localizeDigits(age)} ${lang === 'bn' ? 'দিন' : 'd'}</span>` : ''}
                </div>
                <div class="t-caption">${localizeDigits(escapeHtml(c.phone || (lang === 'bn' ? 'নম্বর নেই' : 'No phone')))}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div class="t-h2 t-num ${c.balance > 0 ? 'text-red' : 'text-emerald'}">${formatTaka(c.balance)}</div>
              <div class="t-caption">${c.balance > 0 ? (lang === 'bn' ? 'বাকি' : 'Due') : (lang === 'bn' ? 'শূন্য' : 'Settled')}</div>
            </div>
          </a>
          <div class="grid-2">
            <a href="./customer-ledger.html?id=${encodeURIComponent(c.id)}" class="btn btn-secondary btn-sm">📒 ${lang === 'bn' ? 'খাতা দেখুন' : 'View Ledger'}</a>
            <button type="button" class="btn btn-amber btn-sm" data-tagada="${escapeHtml(c.name)}" data-amt="${c.balance}">📣 ${lang === 'bn' ? 'তাগাদা (UI)' : 'Remind'}</button>
          </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('[data-tagada]').forEach((btn) => {
      btn.onclick = () => showToast(`${btn.getAttribute('data-tagada')} (${formatTaka(btn.getAttribute('data-amt'))}) — SMS/WhatsApp ব্যাকএন্ডে যুক্ত হবে`);
    });
  }

  document.querySelectorAll('#cust-filters .chip').forEach((chip) => {
    chip.classList.toggle('active', chip.getAttribute('data-filter') === activeFilter);
    chip.onclick = () => {
      activeFilter = chip.getAttribute('data-filter');
      document.querySelectorAll('#cust-filters .chip').forEach((x) => x.classList.remove('active'));
      chip.classList.add('active');
      draw();
    };
  });

  searchEl.oninput = draw;
  draw();
}

const modal = document.getElementById('add-cust-modal');
const openModal = () => modal.classList.remove('hidden');
const closeModal = () => modal.classList.add('hidden');
document.getElementById('btn-open-add-cust').onclick = openModal;
document.getElementById('close-add-cust').onclick = closeModal;
modal.onclick = (e) => { if (e.target === modal) closeModal(); };
if (new URLSearchParams(window.location.search).get('add') === '1') openModal();

document.getElementById('add-cust-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveCustomer({
    name: document.getElementById('nc-name').value,
    alias: document.getElementById('nc-alias').value,
    area: document.getElementById('nc-area').value,
    phone: document.getElementById('nc-phone').value,
    openingBalance: document.getElementById('nc-opening').value
  });
  e.target.reset();
  closeModal();
  showToast('নতুন খরিদ্দার যোগ হয়েছে!');
  renderPage();
});

document.getElementById('cust-voice-btn').onclick = () => openVoiceModal({ onSaved: renderPage });
renderPage();
