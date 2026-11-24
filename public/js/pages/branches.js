import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { formatTaka } from '../core/i18n.js';
import { listBranches, saveBranch, switchActiveBranch } from '../services/pro.service.js';

async function renderBranches() {
  const { config } = await initShell({ activeNav: 'more', pageTitle: 'মাল্টি-শাখা নেটওয়ার্ক' });
  const branches = await listBranches();

  document.getElementById('br-list').innerHTML = branches
    .map((b) => {
      const isActive = b.id === config?.activeBranchId;
      return `
      <div class="card card-stripe ${isActive ? 'stripe-green' : ''} stack-sm">
        <div class="flex-between">
          <div>
            <div class="t-h2">${b.name}</div>
            <div class="t-caption">${b.address || ''}</div>
          </div>
          ${isActive ? '<span class="badge badge-green">চালু শাখা</span>' : ''}
        </div>
        <div class="flex-between">
          <span class="t-label">হাতে ক্যাশ: ${formatTaka(b.cashInHand)}</span>
          ${!isActive ? `<button type="button" class="btn btn-secondary btn-sm" data-sw="${b.id}">এই শাখায় যান</button>` : ''}
        </div>
      </div>`;
    })
    .join('');

  document.querySelectorAll('[data-sw]').forEach((btn) => {
    btn.onclick = async () => {
      await switchActiveBranch(btn.dataset.sw);
      showToast('শাখা পরিবর্তন হয়েছে!');
      renderBranches();
    };
  });
}

const modal = document.getElementById('add-br-modal');
document.getElementById('btn-add-br').onclick = () => modal.classList.remove('hidden');
document.getElementById('close-br-modal').onclick = () => modal.classList.add('hidden');
document.getElementById('add-br-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveBranch({ name: document.getElementById('nb-name').value, address: document.getElementById('nb-addr').value });
  e.target.reset();
  modal.classList.add('hidden');
  showToast('নতুন শাখা যোগ হয়েছে!');
  renderBranches();
});

renderBranches();
