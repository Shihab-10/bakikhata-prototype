import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { formatTaka, formatShortDate, localizeDigits } from '../core/i18n.js';
import { getCustomerById, listCustomers, listTransactions } from '../services/store.service.js';
import { escapeHtml } from '../core/sanitize.js';

async function renderPassbook() {
  const { config } = await initShell({ showBottomNav: false, pageTitle: 'গ্রাহকের অনলাইন পাশবই', onLangChange: renderPassbook });
  const idParam = new URLSearchParams(window.location.search).get('id');
  const customer = idParam ? await getCustomerById(idParam) : (await listCustomers())[0];
  if (!customer) return;

  const txs = await listTransactions({ partyId: customer.id });

  document.getElementById('pk-header-card').innerHTML = `
    <div class="flex-between">
      <div>
        <div class="t-h2">${escapeHtml(config?.shopName || 'রহিম জেনারেল স্টোর')}</div>
        <div class="t-caption">${escapeHtml(config?.address || '')}</div>
      </div>
      <span class="badge badge-amber">প্রাইভেট প্রিভিউ</span>
    </div>
    <div class="card-low">
      <div class="t-label">গ্রাহক: ${escapeHtml(customer.name)} (${escapeHtml(customer.area || '')})</div>
      <div class="t-caption">${localizeDigits(escapeHtml(customer.phone || ''))}</div>
    </div>
    <div class="flex-between">
      <div>
        <div class="t-caption">সর্বমোট বকেয়া</div>
        <div class="t-display ${customer.balance > 0 ? 'text-red' : 'text-emerald'}">${formatTaka(customer.balance)}</div>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="btn-pk-pay">bKash / Nagad পেমেন্ট</button>
    </div>
  `;

  document.getElementById('btn-pk-pay').onclick = () => showToast('bKash/Nagad পেমেন্ট গেটওয়ে ব্যাকএন্ড ফেজে যুক্ত হবে');
  document.getElementById('btn-pk-print').onclick = () => window.print();

  document.getElementById('pk-tx-list').innerHTML = txs
    .map((tx) => {
      const isPaid = tx.txType === 'payment_received';
      return `
      <div class="card card-stripe ${isPaid ? 'stripe-green' : 'stripe-red'} flex-between">
        <div>
          <div class="t-label">${escapeHtml(tx.note || '')}</div>
          <div class="t-caption">${formatShortDate(tx.createdAt)}</div>
        </div>
        <div class="t-h2 t-num ${isPaid ? 'text-emerald' : 'text-red'}">${isPaid ? '-' : '+'}${formatTaka(tx.amount)}</div>
      </div>`;
    })
    .join('');

  document.getElementById('pk-contact-row').innerHTML = `
    <a href="tel:${encodeURIComponent(config?.phone || '')}" class="btn btn-secondary btn-sm">📞 দোকানে কল দিন</a>
    <a href="https://wa.me/88${encodeURIComponent(config?.phone || '')}" target="_blank" class="btn btn-outline btn-sm">💬 হোয়াটসঅ্যাপ</a>
  `;
}

renderPassbook();
