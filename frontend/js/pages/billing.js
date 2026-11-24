import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { localizeDigits } from '../core/i18n.js';

async function initBilling() {
  const { config } = await initShell({ activeNav: 'more', pageTitle: 'প্ল্যান ও পেমেন্ট' });
  document.getElementById('bill-plan-name').textContent = config?.plan || 'Business Pro';
  document.getElementById('bill-sms-left').textContent = `অবশিষ্ট SMS: ${localizeDigits(config?.smsBalance ?? 1450)} টি`;

  document.querySelectorAll('[data-pay]').forEach((b) => {
    b.onclick = () => showToast(`${b.dataset.pay} নির্বাচিত (FastAPI পেমেন্ট গেটওয়ে পরে যুক্ত হবে)`);
  });
  document.querySelectorAll('[data-gw]').forEach((b) => {
    b.onclick = () => showToast(`${b.dataset.gw} গেটওয়ে অপশন প্রস্তুত`);
  });
}

initBilling();
