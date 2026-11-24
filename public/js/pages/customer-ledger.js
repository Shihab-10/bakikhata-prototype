import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { formatTaka, formatShortDate, localizeDigits, getLang } from '../core/i18n.js';
import { getCustomerById, listCustomers, listTransactions } from '../services/store.service.js';
import { escapeHtml } from '../core/sanitize.js';

let txFilter = 'all';

async function renderLedger() {
  await initShell({
    activeNav: 'customers', showBottomNav: false,
    pageTitle: getLang() === 'bn' ? 'খরিদ্দারের খতিয়ান' : 'Customer Ledger',
    onLangChange: renderLedger
  });

  const lang = getLang();
  const params = new URLSearchParams(window.location.search);
  let custId = params.get('id');
  if (!custId) custId = (await listCustomers())[0]?.id;

  const customer = await getCustomerById(custId);
  const profileEl = document.getElementById('ledger-profile-card');
  if (!customer) { profileEl.innerHTML = '<div class="t-body">খরিদ্দার পাওয়া যায়নি</div>'; return; }

  document.getElementById('btn-give-credit').href = `./quick-entry.html?customerId=${encodeURIComponent(customer.id)}&type=credit_given`;
  document.getElementById('btn-get-cash').href = `./quick-entry.html?customerId=${encodeURIComponent(customer.id)}&type=payment_received`;
  document.getElementById('link-public-passbook').href = `./public-khotiyan.html?id=${encodeURIComponent(customer.id)}`;

  const txList = await listTransactions({ partyId: customer.id });
  const totalGiven = txList.filter((t) => t.txType === 'credit_given').reduce((s, t) => s + t.amount, 0);
  const totalPaid = txList.filter((t) => t.txType === 'payment_received').reduce((s, t) => s + t.amount, 0);

  profileEl.innerHTML = `
    <div class="flex-between">
      <div class="flex-row">
        <div class="avatar ${customer.balance > 0 ? 'avatar-red' : ''}">${escapeHtml(customer.name.slice(0, 1))}</div>
        <div>
          <div class="t-h1">${escapeHtml(customer.name)}</div>
          <div class="t-caption">${escapeHtml(customer.area || '')} • ${localizeDigits(escapeHtml(customer.phone || ''))}</div>
        </div>
      </div>
      <a href="tel:${encodeURIComponent(customer.phone || '')}" class="icon-btn">📞</a>
    </div>
    <div class="card-low flex-between">
      <div>
        <div class="t-caption">${customer.balance >= 0 ? 'বর্তমান মোট বাকি' : 'অগ্রিম জমা'}</div>
        <div class="t-display ${customer.balance > 0 ? 'text-red' : 'text-emerald'}">${formatTaka(customer.balance)}</div>
      </div>
      <button type="button" class="btn btn-amber btn-sm" id="btn-ledger-tagada">📣 এসএমএস তাগাদা</button>
    </div>
    <div class="grid-2">
      <div class="card-low"><div class="t-caption">মোট বাকি নিয়েছে</div><div class="t-h2 text-red t-num">${formatTaka(totalGiven)}</div></div>
      <div class="card-low"><div class="t-caption">মোট জমা দিয়েছে</div><div class="t-h2 text-emerald t-num">${formatTaka(totalPaid)}</div></div>
    </div>
  `;

  profileEl.querySelector('#btn-ledger-tagada').onclick = () => showToast(`${escapeHtml(customer.name)} — তাগাদা SMS FastAPI-তে যুক্ত হবে`);

  const listEl = document.getElementById('ledger-tx-list');
  function drawTx() {
    const rows = txFilter === 'all' ? txList : txList.filter((t) => t.txType === txFilter);
    listEl.innerHTML = rows.length
      ? rows.map((tx) => {
          const isPaid = tx.txType === 'payment_received';
          return `
            <div class="card card-stripe ${isPaid ? 'stripe-green' : 'stripe-red'} flex-between">
              <div>
                <div class="flex-row">
                  <span class="badge ${isPaid ? 'badge-green' : 'badge-red'}">${isPaid ? 'টাকা পেলাম' : 'বাকি দিলাম'}</span>
                  <span class="t-caption">${formatShortDate(tx.createdAt)}</span>
                </div>
                <div class="t-body" style="margin-top:4px;">${escapeHtml(tx.note || '')}</div>
              </div>
              <div class="t-h2 t-num ${isPaid ? 'text-emerald' : 'text-red'}">${isPaid ? '-' : '+'}${formatTaka(tx.amount)}</div>
            </div>`;
        }).join('')
      : '<div class="card-low t-caption">কোনো লেনদেন নেই</div>';
  }

  document.querySelectorAll('#ledger-type-filter .chip').forEach((ch) => {
    ch.onclick = () => {
      txFilter = ch.getAttribute('data-t');
      document.querySelectorAll('#ledger-type-filter .chip').forEach((x) => x.classList.remove('active'));
      ch.classList.add('active');
      drawTx();
    };
  });
  drawTx();
}

renderLedger();
