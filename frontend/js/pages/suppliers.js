import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { formatTaka, localizeDigits, getLang } from '../core/i18n.js';
import { listSuppliers, saveSupplier, recordSupplierTransaction } from '../services/store.service.js';

let activeSupId = null;

async function renderSuppliers() {
  await initShell({ activeNav: 'suppliers', pageTitle: getLang() === 'bn' ? 'পাইকার ও মহাজন দেনা' : 'Supplier Payables', onLangChange: renderSuppliers });
  const lang = getLang();
  const suppliers = await listSuppliers();
  document.getElementById('sup-total-payable').textContent = formatTaka(suppliers.reduce((s, x) => s + x.payable, 0));
  document.getElementById('sup-count').textContent = `${localizeDigits(suppliers.length)} ${lang === 'bn' ? 'জন মহাজন' : 'Suppliers'}`;

  const listEl = document.getElementById('sup-list');
  listEl.innerHTML = suppliers.map((s) => `
    <div class="card card-stripe ${s.payable > 0 ? 'stripe-red' : 'stripe-green'} stack-sm">
      <div class="flex-between">
        <div><div class="t-h2">${s.companyName}</div><div class="t-caption">${s.category} • ${localizeDigits(s.phone || '')}</div></div>
        <div style="text-align:right;"><div class="t-h2 t-num ${s.payable > 0 ? 'text-red' : 'text-emerald'}">${formatTaka(s.payable)}</div></div>
      </div>
      <div class="grid-2">
        <button type="button" class="btn btn-danger btn-sm" data-pay-sup="${s.id}" data-name="${s.companyName}">💳 টাকা দিন / চালান</button>
        <a href="tel:${s.phone || ''}" class="btn btn-secondary btn-sm">📞 কল দিন</a>
      </div>
    </div>`).join('');

  listEl.querySelectorAll('[data-pay-sup]').forEach((btn) => {
    btn.onclick = () => {
      activeSupId = btn.dataset.paySup;
      document.getElementById('sup-modal-title').textContent = btn.dataset.name;
      document.getElementById('sup-tx-modal').classList.remove('hidden');
    };
  });
}

document.getElementById('close-sup-modal').onclick = () => document.getElementById('sup-tx-modal').classList.add('hidden');
document.getElementById('sup-tx-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await recordSupplierTransaction({
    supplierId: activeSupId,
    txType: document.getElementById('sup-tx-type').value,
    amount: document.getElementById('sup-tx-amt').value,
    note: document.getElementById('sup-tx-note').value
  });
  e.target.reset();
  document.getElementById('sup-tx-modal').classList.add('hidden');
  showToast('মহাজন হিসাব আপডেট হয়েছে!');
  renderSuppliers();
});

document.getElementById('btn-add-sup').onclick = () => document.getElementById('add-sup-modal').classList.remove('hidden');
document.getElementById('close-add-sup').onclick = () => document.getElementById('add-sup-modal').classList.add('hidden');
document.getElementById('add-sup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveSupplier({ companyName: document.getElementById('ns-company').value, phone: document.getElementById('ns-phone').value, payable: document.getElementById('ns-payable').value });
  e.target.reset();
  document.getElementById('add-sup-modal').classList.add('hidden');
  showToast('নতুন মহাজন যোগ হয়েছে!');
  renderSuppliers();
});

renderSuppliers();
