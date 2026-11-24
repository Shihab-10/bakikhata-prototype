import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { localizeDigits } from '../core/i18n.js';
import { listStaff, saveStaff, toggleStaffStatus } from '../services/pro.service.js';

const ROLE_LABELS = { manager: 'ম্যানেজার', cashier: 'ক্যাশিয়ার', delivery: 'সহকারী / ডেলিভারি' };

async function renderStaff() {
  await initShell({ activeNav: 'more', pageTitle: 'স্টাফ ও রোল পারমিশন' });
  const list = await listStaff();

  document.getElementById('st-list').innerHTML = list
    .map(
      (m) => `
      <div class="card flex-between">
        <div>
          <div class="flex-row">
            <span class="t-h2">${m.name}</span>
            <span class="badge badge-green">${ROLE_LABELS[m.role] || m.role}</span>
          </div>
          <div class="t-caption">${localizeDigits(m.phone || '')}</div>
        </div>
        <button type="button" class="switch" data-tog="${m.id}" aria-checked="${m.active}"><span class="switch-thumb"></span></button>
      </div>`
    )
    .join('');

  document.querySelectorAll('[data-tog]').forEach((sw) => {
    sw.onclick = async () => {
      await toggleStaffStatus(sw.dataset.tog);
      showToast('স্টাফ অ্যাক্সেস আপডেট হয়েছে');
      renderStaff();
    };
  });
}

const modal = document.getElementById('add-st-modal');
document.getElementById('btn-add-st').onclick = () => modal.classList.remove('hidden');
document.getElementById('close-st-modal').onclick = () => modal.classList.add('hidden');
document.getElementById('add-st-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveStaff({
    name: document.getElementById('nst-name').value,
    phone: document.getElementById('nst-phone').value,
    role: document.getElementById('nst-role').value
  });
  e.target.reset();
  modal.classList.add('hidden');
  showToast('নতুন স্টাফ যোগ হয়েছে!');
  renderStaff();
});

renderStaff();
