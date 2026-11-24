import { dbGet, dbGetAll, dbPut, dbPutMany, dbDelete, dbClearStore, dbReplaceStores, seedIfEmpty } from '../core/db.js';
import { apiRequest, hasSession, getCachedSession } from './api-client.js';

const makeId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;
async function canUseRemote() {
  if (!hasSession() || !isOnline()) return false;
  const config = await dbGet('meta', 'app_config');
  return !config?.offlineSimulated;
}
const toLocalCustomer = (customer) => ({ ...customer, balance: Number(customer.balance || 0), limit: Number(customer.limit || 0) });

export async function initAppStore() { return getConfig(); }

export async function getConfig() {
  if (hasSession()) {
    if (await canUseRemote()) {
      try {
        const data = await apiRequest('/auth/me');
        const config = {
          id: 'app_config', shopId: data.shop.id, shopName: data.shop.name,
          ownerName: data.user.full_name, phone: data.user.phone,
          address: data.shop.address || '', mode: 'simple', plan: 'Trial',
          offlineSimulated: false, role: data.shop.role,
        };
        await dbPut('meta', config);
        return config;
      } catch (error) {
        if (!hasSession() && isOnline()) throw error;
      }
    }
    const cached = await dbGet('meta', 'app_config');
    if (cached) return cached;
    const session = getCachedSession();
    if (session?.shop) {
      const config = {
        id: 'app_config', shopId: session.shop.id, shopName: session.shop.name,
        ownerName: session.user?.full_name || '', phone: session.user?.phone || '',
        address: session.shop.address || '', mode: 'simple', plan: 'Trial',
        offlineSimulated: !isOnline(), role: session.shop.role || 'owner',
      };
      await dbPut('meta', config);
      return config;
    }
    throw new Error('এই ডিভাইসে session information পাওয়া যায়নি। অনলাইনে আবার login করুন।');
  }
  await seedIfEmpty();
  return dbGet('meta', 'app_config');
}

export async function updateConfig(patch) {
  const current = (await dbGet('meta', 'app_config')) || {};
  const updated = { ...current, ...patch, id: 'app_config' };
  if (await canUseRemote()) {
    const body = {};
    if (patch.shopName !== undefined) body.name = patch.shopName;
    if (patch.address !== undefined) body.address = patch.address;
    if (patch.businessType !== undefined) body.business_type = patch.businessType;
    if (Object.keys(body).length) {
      const shop = await apiRequest('/shops/current', { method: 'PATCH', body: JSON.stringify(body) });
      updated.shopName = shop.name; updated.address = shop.address;
    }
    if (patch.ownerName !== undefined) {
      const profile = await apiRequest('/auth/profile', { method: 'PATCH', body: JSON.stringify({ full_name: patch.ownerName }) });
      updated.ownerName = profile.full_name;
    }
  }
  await dbPut('meta', updated);
  return updated;
}

async function writeSnapshot(data) {
  const rows = [];
  for (const customer of (data.customers || [])) rows.push({ storeName: 'customers', item: toLocalCustomer(customer) });
  for (const tx of (data.transactions || [])) rows.push({ storeName: 'transactions', item: tx });
  await dbReplaceStores(['customers', 'transactions'], rows);
}

export async function syncNow() {
  if (!(await canUseRemote())) return { synced: 0, pending: (await dbGetAll('outbox')).length };
  let synced = 0;
  const operations = (await dbGetAll('outbox')).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (const operation of operations) {
    try {
      const response = await apiRequest('/sync/push', {
        method: 'POST',
        body: JSON.stringify({ operations: [{
          operation_id: operation.operation_id,
          operation_type: operation.operation_type,
          payload: operation.payload,
        }] }),
      });
      const result = response.results?.[0];
      if (!result || !['synced', 'duplicate'].includes(result.status)) break;
      await dbDelete('outbox', operation.id);
      if (operation.operation_type === 'CREATE_LEDGER_ENTRY') {
        const txs = await dbGetAll('transactions');
        const tx = txs.find((item) => item.operationId === operation.operation_id);
        if (tx) await dbPut('transactions', { ...tx, syncStatus: 'synced' });
      }
      synced += 1;
    } catch {
      break;
    }
  }
  const pending = await dbGetAll('outbox');
  if (pending.length === 0) {
    try {
      const snapshot = await apiRequest('/sync/pull');
      await writeSnapshot(snapshot);
    } catch { /* keep local cache if pull is temporarily unavailable */ }
  }
  return { synced, pending: pending.length };
}

export async function listCustomers() {
  if (await canUseRemote()) {
    try {
      await syncNow();
      const pending = await dbGetAll('outbox');
      if (!pending.length) {
        const data = await apiRequest('/customers');
        const rows = (data.items || []).map((customer) => ({ storeName: 'customers', item: toLocalCustomer(customer) }));
        await dbClearStore('customers');
        await dbReplaceStores(['customers', 'transactions'], rows);
        return (data.items || []).map(toLocalCustomer).sort((a, b) => new Date(b.lastTxAt) - new Date(a.lastTxAt));
      }
    } catch { /* offline cache fallback */ }
  }
  await seedIfEmpty();
  return (await dbGetAll('customers')).sort((a, b) => new Date(b.lastTxAt || 0) - new Date(a.lastTxAt || 0));
}

export async function getCustomerById(id) {
  if (await canUseRemote()) {
    try {
      const customer = toLocalCustomer(await apiRequest(`/customers/${encodeURIComponent(id)}`));
      await dbPut('customers', customer);
      return customer;
    } catch { /* local cache fallback */ }
  }
  return dbGet('customers', id);
}

export async function saveCustomer({ name, alias = '', area, phone, openingBalance = 0, limit = 10000 }) {
  await seedIfEmpty();
  const id = makeId();
  const operationId = makeId();
  const now = new Date().toISOString();
  const opening = Math.max(0, Math.round(Number(openingBalance) || 0));
  const customer = {
    id, name: name.trim(), alias: (alias || '').trim(), area: (area || '').trim(),
    phone: (phone || '').trim(), balance: opening, limit: Number(limit) || 0,
    lastTxAt: now, status: 'active',
  };
  const writes = [{ storeName: 'customers', item: customer }];
  const outbox = {
    id: operationId, operation_id: operationId, operation_type: 'CREATE_CUSTOMER',
    payload: { client_id: id, name: customer.name, alias: customer.alias, area: customer.area, phone: customer.phone, opening_balance: opening },
    createdAt: now,
  };
  writes.push({ storeName: 'outbox', item: outbox });
  if (opening > 0) writes.push({ storeName: 'transactions', item: {
    id: makeId(), operationId: `${operationId}:opening`, partyType: 'customer', partyId: id,
    partyName: customer.area ? `${customer.name} (${customer.area})` : customer.name,
    txType: 'credit_given', amount: opening, channel: 'opening', note: 'শুরুর জের (Opening Balance)',
    createdAt: now, businessDate: now.slice(0, 10), syncStatus: 'pending',
  } });
  await dbPutMany(writes);
  if (await canUseRemote()) await syncNow();
  return (await getCustomerById(id)) || customer;
}

export async function listSuppliers() { await seedIfEmpty(); return dbGetAll('suppliers'); }
export async function saveSupplier({ companyName, contactName, phone, category, payable = 0 }) {
  const supplier = { id: `s_${makeId()}`, companyName: companyName.trim(), contactName: (contactName || '').trim(), phone: (phone || '').trim(), category: (category || 'পাইকারি ডিলার').trim(), payable: Number(payable) || 0, dueDays: 7 };
  await dbPut('suppliers', supplier); return supplier;
}

export async function listTransactions(filter = {}) {
  if (await canUseRemote()) {
    try {
      await syncNow();
      if (!(await dbGetAll('outbox')).length) {
        const params = new URLSearchParams();
        if (filter.partyId) params.set('party_id', filter.partyId);
        if (filter.partyType) params.set('party_type', filter.partyType);
        const data = await apiRequest(`/transactions${params.toString() ? `?${params}` : ''}`);
        const all = data.items || [];
        if (!filter.partyId && !filter.partyType) {
          await dbClearStore('transactions');
          if (all.length) await dbPutMany(all.map((item) => ({ storeName: 'transactions', item })));
        }
        return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    } catch { /* local cache fallback */ }
  }
  await seedIfEmpty();
  let list = await dbGetAll('transactions');
  if (filter.partyId) list = list.filter((t) => t.partyId === filter.partyId);
  if (filter.partyType) list = list.filter((t) => t.partyType === filter.partyType);
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function recordCustomerTransaction({ customerId, txType, amount, channel = 'cash', note = '' }) {
  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error('Customer not found');
  const amt = Math.round(Math.abs(Number(amount) || 0));
  if (amt <= 0) throw new Error('Invalid amount');
  if (!['credit_given', 'payment_received'].includes(txType)) throw new Error('Invalid transaction type');
  const now = new Date().toISOString();
  const operationId = makeId();
  const balance = Number(customer.balance || 0) + (txType === 'credit_given' ? amt : -amt);
  const updatedCustomer = { ...customer, balance, lastTxAt: now };
  const tx = {
    id: makeId(), operationId, partyType: 'customer', partyId: customer.id,
    partyName: customer.area ? `${customer.name} (${customer.area})` : customer.name,
    txType, amount: amt, channel,
    note: note.trim() || (txType === 'credit_given' ? 'বাকিতে ক্রয়' : 'নগদ জমা'),
    createdAt: now, businessDate: now.slice(0, 10), syncStatus: 'pending',
  };
  const operation = {
    id: operationId, operation_id: operationId, operation_type: 'CREATE_LEDGER_ENTRY',
    payload: { customer_id: customer.id, tx_type: txType, amount: amt, note: tx.note, channel, business_date: now.slice(0, 10) },
    createdAt: now,
  };
  await dbPutMany([
    { storeName: 'customers', item: updatedCustomer },
    { storeName: 'transactions', item: tx },
    { storeName: 'outbox', item: operation },
  ]);
  if (await canUseRemote()) await syncNow();
  return { customer: (await getCustomerById(customer.id)) || updatedCustomer, tx };
}

export async function recordSupplierTransaction({ supplierId, txType, amount, channel = 'cash', note = '' }) {
  const supplier = await dbGet('suppliers', supplierId);
  if (!supplier) throw new Error('Supplier not found');
  const amt = Math.abs(Number(amount) || 0);
  supplier.payable = txType === 'purchase_credit' ? supplier.payable + amt : Math.max(0, supplier.payable - amt);
  await dbPut('suppliers', supplier);
  const tx = { id: `tx_${makeId()}`, partyType: 'supplier', partyId: supplier.id, partyName: supplier.companyName, txType, amount: amt, channel, note: note.trim(), createdAt: new Date().toISOString(), syncStatus: 'pending' };
  await dbPut('transactions', tx);
  return { supplier, tx };
}

export async function getDashboardSummary() {
  if (await canUseRemote()) {
    try {
      const summary = await apiRequest('/dashboard/summary');
      summary.pendingSyncCount = (await dbGetAll('outbox')).length;
      return summary;
    } catch { /* local cache fallback */ }
  }
  const [customers, suppliers, transactions] = await Promise.all([listCustomers(), listSuppliers(), listTransactions()]);
  const totalReceivable = customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance) || 0), 0);
  const totalPayable = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.payable) || 0), 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  let todayCashIn = 0, todayCredit = 0;
  transactions.forEach((tx) => {
    if ((tx.businessDate || tx.createdAt || '').slice(0, 10) === todayStr && tx.partyType === 'customer') {
      if (tx.txType === 'payment_received') todayCashIn += Number(tx.amount) || 0;
      if (tx.txType === 'credit_given') todayCredit += Number(tx.amount) || 0;
    }
  });
  return { totalReceivable, totalPayable, todayCashIn, todayCredit, customerCount: customers.length, pendingSyncCount: (await dbGetAll('outbox')).length };
}

export async function logoutLocal() {
  const { clearSession } = await import('./api-client.js');
  clearSession();
}
