import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { formatTaka, localizeDigits } from '../core/i18n.js';
import { listCustomers } from '../services/store.service.js';

const TEMPLATES = {
  eid: '"রমজানুল মুবারক! পবিত্র ঈদের আগে দোকানের বাকি হিসাবটি পরিশোধ করে নতুন খাতা শুরু করার অনুরোধ রইল।"',
  haat: '"আসসালামু আলাইকুম। আগামী হাটে আসার সময় দোকানের পূর্বের বাকি পরিশোধ করার সাদর অনুরোধ রইল।"',
  harvest: '"মাঠে ফসল উঠেছে! ফসল বিক্রির পর দোকানের পূর্বের বকেয়া হিসাবটি চুকিয়ে নেওয়ার অনুরোধ রইল।"'
};

async function renderTagada() {
  const { config } = await initShell({ activeNav: 'more', pageTitle: 'তাগাদা ও রিমাইন্ডার স্টুডিও' });
  document.getElementById('tg-voice-bal').textContent = localizeDigits(config?.voiceBalance ?? 125);
  document.getElementById('tg-sms-bal').textContent = localizeDigits(config?.smsBalance ?? 1450);

  const customers = (await listCustomers()).filter((c) => c.balance > 0);
  document.getElementById('tg-queue').innerHTML = customers
    .map(
      (c) => `
      <div class="card flex-between">
        <div>
          <div class="t-label">${c.name} <span class="t-caption">(${c.area || ''})</span></div>
          <div class="t-h2 text-red t-num">${formatTaka(c.balance)}</div>
        </div>
        <div class="flex-row">
          <button type="button" class="btn btn-primary btn-sm" data-sms="${c.name}">📩 SMS</button>
          <a href="https://wa.me/88${c.phone || ''}" target="_blank" class="btn btn-secondary btn-sm">💬 WA</a>
        </div>
      </div>`
    )
    .join('');

  document.querySelectorAll('[data-sms]').forEach((b) => {
    b.onclick = () => showToast(`${b.dataset.sms} — অটো SMS গেটওয়ে FastAPI-তে যুক্ত হবে`);
  });
}

document.querySelectorAll('[data-tpl]').forEach((c) => {
  c.onclick = () => {
    document.querySelectorAll('[data-tpl]').forEach((x) => x.classList.remove('active'));
    c.classList.add('active');
    document.getElementById('tg-preview-text').textContent = TEMPLATES[c.dataset.tpl];
  };
});

renderTagada();
