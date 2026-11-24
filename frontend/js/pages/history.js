import { initShell } from '../components/shell.js';
import { listTransactions } from '../services/store.service.js';
import { formatTaka, formatShortDate, localizeDigits, getLang } from '../core/i18n.js';
import { escapeHtml } from '../core/sanitize.js';

let activeFilter = 'all';

async function renderHistory() {
  await initShell({ activeNav: 'history', pageTitle: getLang() === 'bn' ? 'লেনদেনের ইতিহাস' : 'Transaction History' });
  const transactions = await listTransactions({ partyType: 'customer' });
  const list = document.getElementById('history-list');
  const search = document.getElementById('history-search');
  const count = document.getElementById('history-count');

  function draw() {
    const query = search.value.trim().toLowerCase();
    const rows = transactions.filter((tx) => {
      const typeMatch = activeFilter === 'all' || tx.txType === activeFilter;
      const text = `${tx.partyName || ''} ${tx.note || ''}`.toLowerCase();
      return typeMatch && (!query || text.includes(query));
    });
    count.textContent = `${localizeDigits(rows.length)} ${getLang() === 'bn' ? 'টি' : 'entries'}`;
    if (!rows.length) {
      list.innerHTML = '<div class="card-low t-caption">কোনো লেনদেন পাওয়া যায়নি</div>';
      return;
    }
    const groups = new Map();
    for (const row of rows) {
      const day = row.businessDate || (row.createdAt || '').slice(0, 10) || 'unknown';
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day).push(row);
    }
    list.innerHTML = [...groups.entries()].map(([day, items]) => `
      <section class="stack-sm">
        <div class="flex-between"><h2 class="t-label">${escapeHtml(day)}</h2><span class="t-caption">${localizeDigits(items.length)} টি</span></div>
        ${items.map((tx) => {
          const paid = tx.txType === 'payment_received';
          const title = paid ? 'জমা গ্রহণ' : 'বাকি যোগ';
          return `<div class="card card-stripe ${paid ? 'stripe-green' : 'stripe-red'} flex-between">
            <div><div class="t-label">${escapeHtml(tx.partyName || '')}</div><div class="t-caption">${escapeHtml(tx.note || '')} · ${formatShortDate(tx.createdAt)}</div><span class="badge ${paid ? 'badge-green' : 'badge-red'}">${title}</span></div>
            <div class="t-h2 t-num ${paid ? 'text-emerald' : 'text-red'}">${paid ? '−' : '+'}${formatTaka(tx.amount)}</div>
          </div>`;
        }).join('')}
      </section>`).join('');
  }

  document.querySelectorAll('#history-filters [data-filter]').forEach((button) => {
    button.onclick = () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll('#history-filters [data-filter]').forEach((item) => item.classList.toggle('active', item === button));
      draw();
    };
  });
  search.oninput = draw;
  draw();
}

renderHistory();
