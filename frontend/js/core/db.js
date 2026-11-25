const BASE_DB_NAME = 'BakirKhataDB';
const DB_VERSION = 2;
const STORES = ['meta', 'customers', 'suppliers', 'transactions', 'products', 'expenses', 'branches', 'staff', 'outbox'];

function getActiveDatabaseName() {
  try {
    const session = JSON.parse(localStorage.getItem('bakikhata_session') || 'null');
    if (session?.authMode === 'local' && session?.shop?.id && !session?.legacyDemo) {
      const safeId = String(session.shop.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
      return `${BASE_DB_NAME}_${safeId}`;
    }
  } catch { /* use the legacy database when no local session is active */ }
  return BASE_DB_NAME;
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('এই Browser-এ Local Database পাওয়া যাচ্ছে না। Chrome বা Edge ব্যবহার করুন।'));
      return;
    }

    let settled = false;
    const req = indexedDB.open(getActiveDatabaseName(), DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      });
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      if (settled) {
        db.close();
        return;
      }
      settled = true;
      resolve(db);
    };

    req.onerror = () => {
      if (settled) return;
      settled = true;
      reject(req.error || new Error('Local Database খোলা যায়নি'));
    };

    req.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error('BakiKhata অন্য Tab-এ খোলা আছে। অন্য Tab বন্ধ করে আবার চেষ্টা করুন।'));
    };
  });
}

export async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    req.onsuccess = () => { const result = req.result || []; db.close(); resolve(result); };
    req.onerror = () => { const error = req.error; db.close(); reject(error); };
  });
}

export async function dbGet(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
    req.onsuccess = () => { const result = req.result || null; db.close(); resolve(result); };
    req.onerror = () => { const error = req.error; db.close(); reject(error); };
  });
}

export async function dbPut(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => { db.close(); resolve(item); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
    tx.onabort = () => { const error = tx.error; db.close(); reject(error || new Error('Local database transaction aborted')); };
  });
}

export async function dbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
  });
}

export async function dbPutMany(entries) {
  const db = await openDB();
  const storeNames = [...new Set(entries.map((entry) => entry.storeName))];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    for (const entry of entries) tx.objectStore(entry.storeName).put(entry.item);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
    tx.onabort = () => { const error = tx.error; db.close(); reject(error || new Error('Local database transaction aborted')); };
  });
}

export async function dbReplaceStores(storeNames, entries) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) tx.objectStore(name).clear();
    for (const entry of entries) tx.objectStore(entry.storeName).put(entry.item);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
    tx.onabort = () => { const error = tx.error; db.close(); reject(error || new Error('Local database replace aborted')); };
  });
}

export async function dbClearStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
  });
}

export async function dbClearAll() {
  const db = await openDB();
  return Promise.all(
    STORES.map((storeName) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }))
  ).finally(() => db.close());
}

function daysAgoIso(days, hour = 11) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 30, 0, 0);
  return d.toISOString();
}

export async function seedIfEmpty() {
  const meta = await dbGet('meta', 'app_config');
  if (meta) return;

  await dbPut('meta', {
    id: 'app_config', shopName: 'রহিম জেনারেল স্টোর', ownerName: 'আব্দুর রহিম', phone: '01712987654',
    address: 'সদর বাজার, চন্দনাইশ', binNumber: '004902118-0205', mode: 'simple', offlineSimulated: false,
    openingCash: 5000, activeBranchId: 'br_main', plan: 'Business Pro', smsBalance: 1450, voiceBalance: 125
  });

  const branches = [
    { id: 'br_main', name: 'রহিম জেনারেল স্টোর (প্রধান শাখা)', address: 'সদর বাজার', isMain: true, cashInHand: 18200 },
    { id: 'br_aarot', name: 'রহিম রাইস অ্যান্ড ট্রেডার্স', address: 'স্টেশন রোড আড়ত', isMain: false, cashInHand: 35400 },
    { id: 'br_haat', name: 'রহিম ভ্যারাইটিজ কর্নার', address: 'শিবপুর মঙ্গলবার হাট', isMain: false, cashInHand: 8700 }
  ];
  for (const branch of branches) await dbPut('branches', branch);

  const suppliers = [
    { id: 's_bhaibhai', companyName: 'মেসার্স ভাই ভাই এন্টারপ্রাইজ', contactName: 'আবুল কালাম', phone: '01712345678', category: 'চাল ও ময়দা মোকাম', payable: 52000, dueDays: -3 },
    { id: 's_meghna', companyName: 'মেঘনা ডিপো (তীর সয়াবিন)', contactName: 'হাবিবুর রহমান', phone: '01798765432', category: 'ভোজ্য তেল ডিলার', payable: 28500, dueDays: 1 },
    { id: 's_fresh', companyName: 'ফ্রেশ চালের আড়ত', contactName: 'করিম মহাজন', phone: '01811223344', category: 'পাইকারি চাল', payable: 36700, dueDays: 12 }
  ];
  for (const supplier of suppliers) await dbPut('suppliers', supplier);

  const products = [
    { id: 'p_rice', name: 'মিনিকেট চাল (৫০ কেজি)', unit: 'বস্তা', buyPrice: 3400, sellPrice: 3650, stock: 2, lowLimit: 5, vatRate: 0 },
    { id: 'p_oil', name: 'তীর সয়াবিন তেল (৫ লিটার)', unit: 'বোতল', buyPrice: 790, sellPrice: 820, stock: 3, lowLimit: 8, vatRate: 0 },
    { id: 'p_sugar', name: 'ফ্রেশ সাদা চিনি', unit: 'কেজি', buyPrice: 125, sellPrice: 130, stock: 15, lowLimit: 20, vatRate: 0 },
    { id: 'p_soap', name: 'লাক্স সাবান ১০০ গ্রাম', unit: 'পিস', buyPrice: 54, sellPrice: 60, stock: 48, lowLimit: 12, vatRate: 5 }
  ];
  for (const product of products) await dbPut('products', product);

  const expenses = [
    { id: 'e_1', category: 'দোকান ভাড়া ও বিদ্যুৎ বিল', amount: 1450, note: 'অক্টোবর মাসের বিদ্যুৎ বিল', createdAt: daysAgoIso(0, 10) },
    { id: 'e_2', category: 'চা-নাস্তা ও যাতায়াত', amount: 350, note: 'মাল আনা-নেওয়ার ভ্যান ভাড়া', createdAt: daysAgoIso(1, 13) }
  ];
  for (const expense of expenses) await dbPut('expenses', expense);

  const staff = [
    { id: 'st_1', name: 'শফিকুল ইসলাম', role: 'manager', phone: '01711234567', active: true },
    { id: 'st_2', name: 'আবির হোসেন', role: 'cashier', phone: '01792889902', active: true },
    { id: 'st_3', name: 'সুজন মিয়া', role: 'delivery', phone: '01812334455', active: true }
  ];
  for (const member of staff) await dbPut('staff', member);
}

export async function resetDemoData() {
  await dbClearAll();
  let session = null;
  try { session = JSON.parse(localStorage.getItem('bakikhata_session') || 'null'); } catch { /* ignore */ }

  if (session?.authMode === 'local' && !session?.legacyDemo) {
    await dbPut('meta', {
      id: 'app_config',
      shopId: session.shop?.id,
      shopName: session.shop?.name || '',
      ownerName: session.user?.full_name || '',
      phone: session.user?.phone || '',
      address: session.shop?.address || '',
      businessType: session.shop?.business_type || 'grocery',
      mode: 'simple',
      plan: 'Trial',
      offlineSimulated: false,
      localOnly: true,
      role: 'owner'
    });
    return;
  }

  await seedIfEmpty();
  if (session?.authMode === 'local' && session?.legacyDemo) {
    const meta = await dbGet('meta', 'app_config');
    await dbPut('meta', { ...meta, localOnly: true, offlineSimulated: false });
  }
}