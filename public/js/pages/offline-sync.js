import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { formatTaka, formatShortDate, localizeDigits } from '../core/i18n.js';
import { listTransactions, updateConfig } from '../services/store.service.js';
import { forceSyncAll, exportFullBackup } from '../services/pro.service.js';

async function renderSync() {
  const { config } = await initShell({ activeNav: 'more', pageTitle: 'অফলাইন ও ব্যাকআপ' });
  const sw = document.getElementById('sw-offline-sim');
  sw.setAttribute('aria-checked', String(Boolean(config?.offlineSimulated)));

  sw.onclick = async () => {
    const next = sw.getAttribute('aria-checked') !== 'true';
    await updateConfig({ offlineSimulated: next });
    showToast(next ? 'অফলাইন প্রিভিউ চালু হয়েছে' : 'অনলাইন মোড চালু হয়েছে');
    renderSync();
  };

  const pending = (await listTransactions()).filter((t) => t.syncStatus === 'pending');
  document.getElementById('sync-queue-badge').textContent = `${localizeDigits(pending.length)} টি অপেক্ষমাণ`;

  document.getElementById('sync-queue-list').innerHTML = pending.length
    ? pending
        .map(
          (tx) => `
        <div class="card-low flex-between">
          <div>
            <div class="t-label">${tx.partyName}</div>
            <div class="t-caption">${formatShortDate(tx.createdAt)}</div>
          </div>
          <span class="t-label t-num">${formatTaka(tx.amount)}</span>
        </div>`
        )
        .join('')
    : '<div class="t-caption">সব লেনদেন সিঙ্ক করা আছে!</div>';
}

document.getElementById('btn-force-sync').onclick = async () => {
  const count = await forceSyncAll();
  showToast(`${localizeDigits(count)} টি লেনদেন সিঙ্ক হয়েছে!`);
  renderSync();
};

document.getElementById('btn-download-backup').onclick = async () => {
  const data = await exportFullBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bakir-khata-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  showToast('ব্যাকআপ ডাউনলোড হয়েছে!');
};

renderSync();
