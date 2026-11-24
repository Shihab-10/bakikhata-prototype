import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { formatTaka, localizeDigits } from '../core/i18n.js';
import { listProducts, adjustProductStock, saveProduct } from '../services/pro.service.js';

let filter = 'all';

async function renderInv() {
  await initShell({ activeNav: 'more', pageTitle: 'দোকানের স্টক ও মজুদ', onLangChange: renderInv });
  const products = await listProducts();

  const lowCount = products.filter((p) => p.stock <= p.lowLimit).length;
  const totalVal = products.reduce((s, p) => s + p.stock * p.buyPrice, 0);

  document.getElementById('inv-total').textContent = localizeDigits(products.length);
  document.getElementById('inv-low').textContent = localizeDigits(lowCount);
  document.getElementById('inv-val').textContent = formatTaka(totalVal);

  const visible = filter === 'low' ? products.filter((p) => p.stock <= p.lowLimit) : products;
  const listEl = document.getElementById('inv-list');

  listEl.innerHTML = visible
    .map((p) => {
      const isLow = p.stock <= p.lowLimit;
      return `
      <div class="card card-stripe ${isLow ? 'stripe-red' : 'stripe-green'} stack-sm">
        <div class="flex-between">
          <div>
            <div class="t-h2">${p.name}</div>
            <div class="t-caption">ক্রয়: ${formatTaka(p.buyPrice)} • বিক্রয়: ${formatTaka(p.sellPrice)} / ${p.unit}</div>
          </div>
          <span class="badge ${isLow ? 'badge-red' : 'badge-green'}">${localizeDigits(p.stock)} ${p.unit}</span>
        </div>
        <div class="flex-between">
          <div class="flex-row">
            <button type="button" class="btn btn-secondary btn-sm" data-dec="${p.id}">− ১</button>
            <button type="button" class="btn btn-primary btn-sm" data-inc="${p.id}">+ ১</button>
          </div>
          ${isLow ? `<a href="./suppliers.html" class="btn btn-amber btn-sm">🚚 মহাজন অর্ডার</a>` : `<span class="t-caption">পর্যাপ্ত স্টক</span>`}
        </div>
      </div>`;
    })
    .join('');

  listEl.querySelectorAll('[data-dec]').forEach((b) => {
    b.onclick = async () => { await adjustProductStock(b.dataset.dec, -1); renderInv(); };
  });
  listEl.querySelectorAll('[data-inc]').forEach((b) => {
    b.onclick = async () => { await adjustProductStock(b.dataset.inc, 1); renderInv(); };
  });
}

document.querySelectorAll('[data-inv]').forEach((c) => {
  c.onclick = () => {
    filter = c.dataset.inv;
    document.querySelectorAll('[data-inv]').forEach((x) => x.classList.remove('active'));
    c.classList.add('active');
    renderInv();
  };
});

const modal = document.getElementById('add-prod-modal');
document.getElementById('btn-add-prod').onclick = () => modal.classList.remove('hidden');
document.getElementById('close-prod-modal').onclick = () => modal.classList.add('hidden');
document.getElementById('add-prod-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveProduct({
    name: document.getElementById('np-name').value,
    unit: document.getElementById('np-unit').value,
    stock: document.getElementById('np-stock').value,
    buyPrice: document.getElementById('np-buy').value,
    sellPrice: document.getElementById('np-sell').value
  });
  e.target.reset();
  modal.classList.add('hidden');
  showToast('নতুন পণ্য স্টকে যোগ হয়েছে!');
  renderInv();
});

renderInv();
