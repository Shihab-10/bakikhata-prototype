import { initShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import { formatTaka, formatShortDate, localizeDigits, getLang } from '../core/i18n.js';
import { listCustomers } from '../services/store.service.js';
import { listProducts, createPosMemo } from '../services/pro.service.js';

let cart = [];
let customers = [];
let config = null;
let lastMemo = null;

async function initMemo() {
  const shell = await initShell({ activeNav: 'more', pageTitle: 'ডিজিটাল ক্যাশ মেমো' });
  config = shell.config;
  customers = await listCustomers();
  const products = await listProducts();

  const custSel = document.getElementById('memo-customer');
  custSel.innerHTML = customers.map((c) => `<option value="${c.id}">${c.name} (${c.area || ''})</option>`).join('');

  const chipsEl = document.getElementById('memo-product-chips');
  chipsEl.innerHTML = products
    .map((p) => `<button type="button" class="chip" data-pid="${p.id}">+ ${p.name} (${formatTaka(p.sellPrice)})</button>`)
    .join('');

  chipsEl.querySelectorAll('[data-pid]').forEach((btn) => {
    btn.onclick = () => {
      const p = products.find((x) => x.id === btn.dataset.pid);
      if (!p) return;
      const existing = cart.find((c) => c.productId === p.id);
      if (existing) existing.qty += 1;
      else cart.push({ productId: p.id, name: p.name, unit: p.unit, qty: 1, unitPrice: p.sellPrice });
      drawCart();
    };
  });

  if (cart.length === 0 && products[0]) {
    cart.push({ productId: products[0].id, name: products[0].name, unit: products[0].unit, qty: 1, unitPrice: products[0].sellPrice });
  }

  document.getElementById('btn-add-custom').onclick = () => {
    const name = document.getElementById('custom-item-name').value.trim();
    const price = Number(document.getElementById('custom-item-price').value);
    if (!name || price <= 0) return;
    cart.push({ productId: null, name, unit: 'পিস', qty: 1, unitPrice: price });
    document.getElementById('custom-item-name').value = '';
    document.getElementById('custom-item-price').value = '';
    drawCart();
  };

  ['memo-discount', 'memo-vat', 'memo-paid', 'memo-customer'].forEach((id) => {
    document.getElementById(id).oninput = drawReceiptPreview;
  });

  document.getElementById('btn-generate-memo').onclick = async () => {
    if (!cart.length) {
      showToast('অন্তত ১টি পণ্য যোগ করুন');
      return;
    }
    const memo = await createPosMemo({
      customerId: custSel.value,
      items: cart,
      discount: document.getElementById('memo-discount').value,
      vatPercent: document.getElementById('memo-vat').value,
      paidAmount: document.getElementById('memo-paid').value
    });
    lastMemo = memo;
    customers = await listCustomers();
    drawReceiptPreview();
    showToast(`মেমো #${localizeDigits(memo.memoNo)} সংরক্ষিত হয়েছে!`);
  };

  document.getElementById('btn-print-memo').onclick = () => window.print();
  document.getElementById('btn-bt-print').onclick = () => showToast('৫৮মিমি ব্লুটুথ থার্মাল প্রিন্টার সংযোগ ব্যাকএন্ড/হাইব্রিড মোডে যুক্ত হবে');
  document.getElementById('btn-wa-memo').onclick = () => {
    const cust = customers.find((c) => c.id === custSel.value);
    const total = lastMemo ? lastMemo.netTotal : getTotals().netTotal;
    const msg = encodeURIComponent(`${config?.shopName} - ক্যাশ মেমো\nগ্রাহক: ${cust?.name}\nমোট বিল: ${formatTaka(total)}\nবর্তমান বাকি: ${formatTaka(cust?.balance || 0)}`);
    window.open(`https://wa.me/88${cust?.phone || ''}?text=${msg}`, '_blank');
  };

  drawCart();
}

function getTotals() {
  const subtotal = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const disc = Math.min(subtotal, Math.max(0, Number(document.getElementById('memo-discount').value) || 0));
  const vatPct = Math.max(0, Number(document.getElementById('memo-vat').value) || 0);
  const vatAmt = Math.round(((subtotal - disc) * vatPct) / 100);
  const netTotal = subtotal - disc + vatAmt;
  const paid = Math.min(netTotal, Math.max(0, Number(document.getElementById('memo-paid').value) || 0));
  return { subtotal, disc, vatAmt, netTotal, paid, due: netTotal - paid };
}

function drawCart() {
  const listEl = document.getElementById('memo-cart-list');
  listEl.innerHTML = cart.length
    ? cart
        .map(
          (it, idx) => `
      <div class="cart-row">
        <div>
          <div class="t-label">${it.name}</div>
          <div class="t-caption">${formatTaka(it.unitPrice)} / ${it.unit}</div>
        </div>
        <div class="qty-stepper">
          <button type="button" class="qty-btn" data-dec="${idx}">−</button>
          <span class="t-label t-num">${localizeDigits(it.qty)}</span>
          <button type="button" class="qty-btn" data-inc="${idx}">+</button>
        </div>
      </div>`
        )
        .join('')
    : '<div class="t-caption">কার্ট খালি</div>';

  listEl.querySelectorAll('[data-dec]').forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.dec);
      if (cart[i].qty > 1) cart[i].qty -= 1;
      else cart.splice(i, 1);
      drawCart();
    };
  });
  listEl.querySelectorAll('[data-inc]').forEach((b) => {
    b.onclick = () => {
      cart[Number(b.dataset.inc)].qty += 1;
      drawCart();
    };
  });

  drawReceiptPreview();
}

function drawReceiptPreview() {
  const cust = customers.find((c) => c.id === document.getElementById('memo-customer').value);
  const totals = getTotals();
  const receipt = document.getElementById('memo-receipt');

  receipt.innerHTML = `
    <div style="text-align:center;">
      <div class="t-h1">${config?.shopName || 'রহিম জেনারেল স্টোর'}</div>
      <div class="t-caption">${config?.address || ''} • BIN: ${localizeDigits(config?.binNumber || '')}</div>
      <div class="t-caption">${formatShortDate(new Date().toISOString())} • মেমো #${localizeDigits(lastMemo?.memoNo || 'PREVIEW')}</div>
    </div>
    <div class="receipt-divider"></div>
    <div class="flex-between">
      <span class="t-label">গ্রাহক: ${cust?.name || ''}</span>
      <span class="t-caption">${localizeDigits(cust?.phone || '')}</span>
    </div>
    <div class="receipt-divider"></div>
    ${cart
      .map(
        (it) => `
      <div class="flex-between t-body">
        <span>${it.name} × ${localizeDigits(it.qty)}</span>
        <span class="t-num">${formatTaka(it.qty * it.unitPrice)}</span>
      </div>`
      )
      .join('')}
    <div class="receipt-divider"></div>
    <div class="flex-between t-caption"><span>মোট মূল্য</span><span class="t-num">${formatTaka(totals.subtotal)}</span></div>
    <div class="flex-between t-caption"><span>ছাড়</span><span class="t-num">-${formatTaka(totals.disc)}</span></div>
    <div class="flex-between t-caption"><span>ভ্যাট / মূসক</span><span class="t-num">+${formatTaka(totals.vatAmt)}</span></div>
    <div class="flex-between t-h2"><span>নিট বিল</span><span class="t-num">${formatTaka(totals.netTotal)}</span></div>
    <div class="flex-between t-label text-emerald"><span>নগদ জমা</span><span class="t-num">${formatTaka(totals.paid)}</span></div>
    <div class="flex-between t-label text-red"><span>আজকের বাকি</span><span class="t-num">${formatTaka(totals.due)}</span></div>
    <div class="card-low flex-between" style="margin-top:6px;">
      <span class="t-caption">বর্তমান মোট খাতা বাকি</span>
      <span class="t-h2 text-red t-num">${formatTaka(cust?.balance || 0)}</span>
    </div>
  `;
}

initMemo();
