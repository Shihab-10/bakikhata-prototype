import { initShell } from '../components/shell.js';
import { openVoiceModal } from '../components/voice-modal.js';
import { showToast } from '../components/toast.js';
import { formatTaka, localizeDigits, getLang } from '../core/i18n.js';
import { listCustomers, recordCustomerTransaction } from '../services/store.service.js';
import { escapeHtml } from '../core/sanitize.js';

let rawAmount = 0;
let txType = new URLSearchParams(window.location.search).get('type') === 'payment_received' ? 'payment_received' : 'credit_given';
let customers = [];

async function initQuickEntry() {
  await initShell({
    activeNav: 'entry',
    pageTitle: getLang() === 'bn' ? 'দ্রুত বাকি ও জমা এন্ট্রি' : 'Quick Ledger Entry',
    onLangChange: initQuickEntry
  });

  const lang = getLang();
  customers = await listCustomers();
  const selectEl = document.getElementById('qe-customer');
  const preCust = new URLSearchParams(window.location.search).get('customerId');
  selectEl.innerHTML = customers.map((c) => `<option value="${c.id}" ${c.id === preCust ? 'selected' : ''}>${escapeHtml(c.name)} (${escapeHtml(c.area || '')}) — ${formatTaka(c.balance)}</option>`).join('');

  const creditBtn = document.getElementById('qe-credit-btn');
  const paidBtn = document.getElementById('qe-paid-btn');
  const displayEl = document.getElementById('qe-display');
  const submitBtn = document.getElementById('qe-submit-btn');
  const labelEl = document.getElementById('qe-amt-label');

  function syncModeUI() {
    if (txType === 'credit_given') {
      creditBtn.className = 'mode-btn active-red'; paidBtn.className = 'mode-btn';
      displayEl.className = 'amount-readout text-red'; submitBtn.className = 'btn btn-danger btn-block';
      labelEl.textContent = lang === 'bn' ? 'বাকি যোগের পরিমাণ' : 'Credit Added';
    } else {
      paidBtn.className = 'mode-btn active-green'; creditBtn.className = 'mode-btn';
      displayEl.className = 'amount-readout text-emerald'; submitBtn.className = 'btn btn-primary btn-block';
      labelEl.textContent = lang === 'bn' ? 'প্রাপ্ত জমার পরিমাণ' : 'Payment Received';
    }
    displayEl.textContent = formatTaka(rawAmount);
    submitBtn.textContent = `✓ ${lang === 'bn' ? 'এন্ট্রি সংরক্ষণ করুন' : 'Save Entry'} (${formatTaka(rawAmount)})`;
  }

  document.querySelectorAll('#qe-numpad [data-key]').forEach((btn) => {
    btn.textContent = btn.dataset.key === 'back' ? '⌫' : localizeDigits(btn.dataset.key);
    btn.onclick = () => {
      const k = btn.dataset.key;
      if (k === 'back') rawAmount = Math.floor(rawAmount / 10);
      else if (k === '00') rawAmount = rawAmount < 100000 ? rawAmount * 100 : rawAmount;
      else if (rawAmount < 999999) rawAmount = rawAmount * 10 + Number(k);
      syncModeUI();
    };
  });

  document.querySelectorAll('[data-add]').forEach((btn) => { btn.onclick = () => { rawAmount += Number(btn.dataset.add); syncModeUI(); }; });
  document.getElementById('qe-full-due').onclick = () => {
    const c = customers.find((x) => x.id === selectEl.value);
    if (c && c.balance > 0) { rawAmount = c.balance; syncModeUI(); }
  };

  document.querySelectorAll('#qe-item-pills .item-pill').forEach((pill) => {
    pill.onclick = () => {
      pill.classList.toggle('selected');
      document.getElementById('qe-note').value = Array.from(document.querySelectorAll('#qe-item-pills .item-pill.selected')).map((p) => p.dataset.item).join(', ');
    };
  });

  creditBtn.onclick = () => { txType = 'credit_given'; syncModeUI(); };
  paidBtn.onclick = () => { txType = 'payment_received'; syncModeUI(); };

  submitBtn.onclick = async () => {
    if (rawAmount <= 0) { showToast(lang === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'Please enter an amount'); return; }
    await recordCustomerTransaction({ customerId: selectEl.value, txType, amount: rawAmount, note: document.getElementById('qe-note').value });
    showToast(lang === 'bn' ? 'হিসাব সফলভাবে সেভ হয়েছে!' : 'Entry saved!');
    setTimeout(() => { window.location.href = `./customer-ledger.html?id=${selectEl.value}`; }, 350);
  };

  document.getElementById('qe-voice-btn').onclick = () => openVoiceModal({ onSaved: () => { window.location.href = './dashboard.html'; } });
  syncModeUI();
}

initQuickEntry();
