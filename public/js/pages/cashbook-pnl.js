import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { formatTaka, formatShortDate } from '../core/i18n.js';
import { listTransactions } from '../services/store.service.js';
import { listExpenses, addExpense } from '../services/pro.service.js';

async function renderCashbook() {
  const { config } = await initShell({ activeNav: 'more', pageTitle: 'লাভ-লোকসান ও ক্যাশ খাতা', onLangChange: renderCashbook });
  const [txs, expenses] = await Promise.all([listTransactions(), listExpenses()]);

  const cashIn = txs.filter((t) => t.txType === 'payment_received').reduce((s, t) => s + t.amount, 0);
  const supPaid = txs.filter((t) => t.txType === 'supplier_paid').reduce((s, t) => s + t.amount, 0);
  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const totalOut = supPaid + expTotal;
  const opening = config?.openingCash || 5000;
  const expectedClosing = opening + cashIn - totalOut;

  document.getElementById('pnl-in').textContent = formatTaka(cashIn);
  document.getElementById('pnl-out').textContent = formatTaka(totalOut);
  document.getElementById('pnl-net').textContent = formatTaka(cashIn - totalOut);

  document.getElementById('cd-open').textContent = formatTaka(opening);
  document.getElementById('cd-in').textContent = formatTaka(cashIn);
  document.getElementById('cd-close').textContent = formatTaka(Math.max(0, expectedClosing));

  document.getElementById('exp-list').innerHTML = expenses
    .map(
      (ex) => `
      <div class="card card-stripe stripe-amber flex-between">
        <div>
          <div class="t-label">${ex.category}</div>
          <div class="t-caption">${ex.note || ''} • ${formatShortDate(ex.createdAt)}</div>
        </div>
        <div class="t-h2 text-red t-num">-${formatTaka(ex.amount)}</div>
      </div>`
    )
    .join('');
}

document.getElementById('btn-reconcile').onclick = () => showToast('ক্যাশ ড্রয়ারের হিসাব মিলেছে!');

const modal = document.getElementById('add-exp-modal');
document.getElementById('btn-add-exp').onclick = () => modal.classList.remove('hidden');
document.getElementById('close-exp-modal').onclick = () => modal.classList.add('hidden');
document.getElementById('add-exp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await addExpense({
    category: document.getElementById('ex-cat').value,
    amount: document.getElementById('ex-amt').value,
    note: document.getElementById('ex-note').value
  });
  e.target.reset();
  modal.classList.add('hidden');
  showToast('খরচ যোগ হয়েছে!');
  renderCashbook();
});

renderCashbook();
