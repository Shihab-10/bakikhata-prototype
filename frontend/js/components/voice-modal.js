import { getLang, formatTaka } from '../core/i18n.js';
import { parseVoiceCommand, startNativeSpeechRecognition } from '../core/voice-parser.js';
import { listCustomers, recordCustomerTransaction } from '../services/store.service.js';
import { showToast } from './toast.js';
import { getBasePath } from './shell.js';
import { escapeHtml } from '../core/sanitize.js';

export function openVoiceModal({ onSaved } = {}) {
  let modal = document.getElementById('voice-draft-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'voice-draft-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const lang = getLang();
  modal.classList.remove('hidden');
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="flex-between">
        <div>
          <h2 class="t-h2">${lang === 'bn' ? '🎤 ভয়েস দিয়ে দ্রুত এন্ট্রি' : '🎤 Voice Smart Draft'}</h2>
          <p class="t-caption">${lang === 'bn' ? 'সহজ বাংলায় বলুন অথবা নিচের উদাহরণে ট্যাপ করুন' : 'Speak naturally or tap a sample phrase below'}</p>
        </div>
        <button type="button" class="icon-btn" id="vm-close">✕</button>
      </div>
      <div class="card-low stack-sm" style="text-align:center;">
        <button type="button" class="btn btn-primary btn-block" id="vm-listen-btn">
          <span>🎙️</span><span>${lang === 'bn' ? 'মাইক্রোফোন চালু করে বলুন' : 'Tap Microphone & Speak'}</span>
        </button>
        <p class="t-caption" id="vm-status">${lang === 'bn' ? 'প্রস্তুত আছে (ডিভাইস/ব্রাউজার স্পিচ সুবিধা থাকলে)' : 'Ready (if speech recognition is available on this device/browser)'}</p>
      </div>
      <div class="stack-xs">
        <span class="t-caption">${lang === 'bn' ? 'টেস্ট করার জন্য ট্যাপ করুন:' : 'Tap to test sample voice commands:'}</span>
        <div class="chip-row no-scrollbar">
          <button type="button" class="chip" data-sample="সামী ১০০০ টাকা বাকি করছে">সামী ১০০০ টাকা বাকি করছে</button>
          <button type="button" class="chip" data-sample="সামী ৫০০ টাকা জমা দিছে">সামী ৫০০ টাকা জমা দিছে</button>
          <button type="button" class="chip" data-sample="সামী অমুক, তার লেজার কত?">সামী, তার লেজার কত?</button>
          <button type="button" class="chip" data-sample="কাশেম ভাই ৩০০ টাকা বাকি করছে">কাশেম ভাই ৩০০ টাকা বাকি</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${lang === 'bn' ? 'শোনা টেক্সট (এডিট করতে পারেন)' : 'Captured Text (Editable)'}</label>
        <div class="flex-row">
          <input type="text" class="input" id="vm-transcript" placeholder="সামী ১০০০ টাকা বাকি করছে" />
          <button type="button" class="btn btn-secondary btn-sm" id="vm-parse-btn">${lang === 'bn' ? 'খুঁজুন' : 'Parse'}</button>
        </div>
      </div>
      <div id="vm-draft-area" class="hidden stack-sm"></div>
    </div>
  `;

  const close = () => modal.classList.add('hidden');
  modal.querySelector('#vm-close').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  const inputEl = modal.querySelector('#vm-transcript');
  const statusEl = modal.querySelector('#vm-status');
  const draftEl = modal.querySelector('#vm-draft-area');

  async function processTranscript(text) {
    inputEl.value = text;
    const customers = await listCustomers();
    renderDraft(parseVoiceCommand(text, customers), customers);
  }

  function renderDraft(parsed, customers) {
    draftEl.classList.remove('hidden');
    const base = getBasePath();

    if (parsed.intent === 'ledger_query') {
      draftEl.innerHTML = parsed.matches.length
        ? `<div class="card-low stack-sm"><span class="badge badge-green">${lang === 'bn' ? 'লেজার অনুসন্ধান' : 'Ledger Lookup'}</span>${parsed.matches
            .map((c) => `<a href="${base}/pages/customer-ledger.html?id=${encodeURIComponent(c.id)}" class="card flex-between"><div><div class="t-label">${escapeHtml(c.name)} (${escapeHtml(c.area || '')})</div><div class="t-caption">${escapeHtml(c.phone || '')}</div></div><div class="t-h2 ${c.balance > 0 ? 'text-red' : 'text-emerald'}">${formatTaka(c.balance)}</div></a>`)
            .join('')}</div>`
        : `<div class="card-low t-body">${lang === 'bn' ? 'কোনো খরিদ্দার খুঁজে পাওয়া যায়নি।' : 'No matching customer found.'}</div>`;
      return;
    }

    const candidates = parsed.matches.length ? parsed.matches : customers;
    let txType = parsed.intent === 'payment_received' ? 'payment_received' : 'credit_given';

    draftEl.innerHTML = `
      <div class="card stack-sm">
        <div class="flex-between">
          <span class="badge ${txType === 'credit_given' ? 'badge-red' : 'badge-green'}" id="vm-type-badge">${txType === 'credit_given' ? 'বাকি যোগ (+৳)' : 'জমা গ্রহণ (−৳)'}</span>
          <span class="t-caption">${parsed.matches.length > 1 ? 'একাধিক মিল — সঠিকজন বাছুন' : ''}</span>
        </div>
        <div class="form-group">
          <label class="form-label">${lang === 'bn' ? 'কোন খরিদ্দার?' : 'Select Customer'}</label>
          <select class="select" id="vm-cust-select">${candidates.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.area || '')}) — ${formatTaka(c.balance)}</option>`).join('')}</select>
        </div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">ধরন</label>
            <select class="select" id="vm-tx-type">
              <option value="credit_given" ${txType === 'credit_given' ? 'selected' : ''}>বাকি দিলাম</option>
              <option value="payment_received" ${txType === 'payment_received' ? 'selected' : ''}>টাকা পেলাম</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">টাকা (৳)</label><input type="number" class="input t-num" id="vm-amount" value="${parsed.amount || ''}" /></div>
        </div>
        <button type="button" class="btn btn-primary btn-block" id="vm-confirm-btn">✓ ১-ক্লিকে সেভ করুন</button>
      </div>
    `;

    draftEl.querySelector('#vm-tx-type').addEventListener('change', (e) => { txType = e.target.value; });
    draftEl.querySelector('#vm-confirm-btn').addEventListener('click', async () => {
      const customerId = draftEl.querySelector('#vm-cust-select').value;
      const amount = Number(draftEl.querySelector('#vm-amount').value);
      if (!customerId || amount <= 0) { showToast('সঠিক টাকার পরিমাণ দিন'); return; }
      await recordCustomerTransaction({ customerId, txType, amount, note: `ভয়েস: ${parsed.rawText}` });
      close();
      showToast('ভয়েস এন্ট্রি লেজারে সেভ হয়েছে!');
      if (typeof onSaved === 'function') onSaved();
    });
  }

  modal.querySelectorAll('[data-sample]').forEach((b) => { b.onclick = () => processTranscript(b.getAttribute('data-sample')); });
  modal.querySelector('#vm-parse-btn').onclick = () => { if (inputEl.value.trim()) processTranscript(inputEl.value.trim()); };
  modal.querySelector('#vm-listen-btn').onclick = () => {
    statusEl.textContent = 'শুনছি... এখন বাংলায় বলুন';
    startNativeSpeechRecognition({
      onResult: (txt) => { statusEl.textContent = 'কথা বোঝা গেছে!'; processTranscript(txt); },
      onError: () => { statusEl.textContent = 'মাইক না থাকলে নিচের নমুনা ট্যাপ করুন বা লিখে খুঁজুন।'; }
    });
  };
}
