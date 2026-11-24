import { dbGet, dbGetAll, dbPut, seedIfEmpty } from '../core/db.js';
import { getConfig, updateConfig, recordCustomerTransaction, syncNow } from './store.service.js';

export async function listProducts() {
  await seedIfEmpty();
  return dbGetAll('products');
}

export async function adjustProductStock(productId, delta) {
  const p = await dbGet('products', productId);
  if (!p) return null;
  p.stock = Math.max(0, (Number(p.stock) || 0) + Number(delta));
  await dbPut('products', p);
  return p;
}

export async function saveProduct({ name, unit, buyPrice, sellPrice, stock, lowLimit, vatRate = 0 }) {
  const item = {
    id: 'p_' + Date.now(),
    name: name.trim(),
    unit: (unit || 'পিস').trim(),
    buyPrice: Number(buyPrice) || 0,
    sellPrice: Number(sellPrice) || 0,
    stock: Number(stock) || 0,
    lowLimit: Number(lowLimit) || 5,
    vatRate: Number(vatRate) || 0
  };
  await dbPut('products', item);
  return item;
}

export async function listExpenses() {
  await seedIfEmpty();
  const list = await dbGetAll('expenses');
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function addExpense({ category, amount, note }) {
  const ex = {
    id: 'e_' + Date.now(),
    category: category.trim(),
    amount: Math.abs(Number(amount) || 0),
    note: (note || '').trim(),
    createdAt: new Date().toISOString()
  };
  await dbPut('expenses', ex);
  return ex;
}

export async function listBranches() {
  await seedIfEmpty();
  return dbGetAll('branches');
}

export async function saveBranch({ name, address }) {
  const br = {
    id: 'br_' + Date.now(),
    name: name.trim(),
    address: (address || '').trim(),
    isMain: false,
    cashInHand: 0
  };
  await dbPut('branches', br);
  return br;
}

export async function switchActiveBranch(branchId) {
  const br = await dbGet('branches', branchId);
  if (!br) return null;
  return updateConfig({ activeBranchId: br.id, shopName: br.name, address: br.address });
}

export async function listStaff() {
  await seedIfEmpty();
  return dbGetAll('staff');
}

export async function saveStaff({ name, role, phone }) {
  const member = {
    id: 'st_' + Date.now(),
    name: name.trim(),
    role: role || 'cashier',
    phone: (phone || '').trim(),
    active: true
  };
  await dbPut('staff', member);
  return member;
}

export async function toggleStaffStatus(staffId) {
  const member = await dbGet('staff', staffId);
  if (!member) return null;
  member.active = !member.active;
  await dbPut('staff', member);
  return member;
}

export async function createPosMemo({ customerId, items, discount = 0, vatPercent = 0, paidAmount = 0 }) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const disc = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const afterDisc = subtotal - disc;
  const vatAmount = Math.round((afterDisc * (Number(vatPercent) || 0)) / 100);
  const netTotal = afterDisc + vatAmount;
  const paid = Math.min(netTotal, Math.max(0, Number(paidAmount) || 0));
  const dueAdded = netTotal - paid;

  const summaryNote = items.map((i) => `${i.name} (${i.qty} ${i.unit})`).join(', ');

  for (const it of items) {
    if (it.productId) {
      await adjustProductStock(it.productId, -it.qty);
    }
  }

  if (dueAdded > 0) {
    await recordCustomerTransaction({
      customerId,
      txType: 'credit_given',
      amount: dueAdded,
      note: `মেমো বিল: ${summaryNote}`
    });
  } else if (paid > 0) {
    await recordCustomerTransaction({
      customerId,
      txType: 'payment_received',
      amount: paid,
      note: `নগদ মেমো: ${summaryNote}`
    });
  }

  return {
    memoNo: 'BK-' + String(Date.now()).slice(-6),
    subtotal,
    discount: disc,
    vatAmount,
    netTotal,
    paid,
    dueAdded,
    items,
    createdAt: new Date().toISOString()
  };
}

export async function forceSyncAll() {
  const result = await syncNow();
  return result.synced;
}

export async function exportFullBackup() {
  const [meta, customers, suppliers, transactions, products, expenses, branches, staff, outbox] = await Promise.all([
    getConfig(),
    dbGetAll('customers'),
    dbGetAll('suppliers'),
    dbGetAll('transactions'),
    dbGetAll('products'),
    dbGetAll('expenses'),
    dbGetAll('branches'),
    dbGetAll('staff'),
    dbGetAll('outbox')
  ]);
  return {
    exportedAt: new Date().toISOString(),
    app: 'Bakir Khata',
    meta,
    customers,
    suppliers,
    transactions,
    products,
    expenses,
    branches,
    staff,
    outbox
  };
}
