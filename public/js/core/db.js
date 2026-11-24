const DB_NAME = 'BakirKhataDB';
const DB_VERSION = 2;
const STORES = ['meta', 'customers', 'suppliers', 'transactions', 'products', 'expenses', 'branches', 'staff', 'outbox'];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}


export async function dbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbPutMany(entries) {
  const db = await openDB();
  const storeNames = [...new Set(entries.map((entry) => entry.storeName))];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    for (const entry of entries) tx.objectStore(entry.storeName).put(entry.item);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Local database transaction aborted'));
  });
}

export async function dbReplaceStores(storeNames, entries) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) tx.objectStore(name).clear();
    for (const entry of entries) tx.objectStore(entry.storeName).put(entry.item);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Local database replace aborted'));
  });
}

export async function dbClearStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbClearAll() {
  const db = await openDB();
  return Promise.all(
    STORES.map((s) => new Promise((res, rej) => {
      const tx = db.transaction(s, 'readwrite');
      tx.objectStore(s).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    }))
  );
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
  for (const b of branches) await dbPut('branches', b);

  const suppliers = [
    { id: 's_bhaibhai', companyName: 'মেসার্স ভাই ভাই এন্টারপ্রাইজ', contactName: 'আবুল কালাম', phone: '01712345678', category: 'চাল ও ময়দা মোকাম', payable: 52000, dueDays: -3 },
    { id: 's_meghna', companyName: 'মেঘনা ডিপো (তীর সয়াবিন)', contactName: 'হাবিবুর রহমান', phone: '01798765432', category: 'ভোজ্য তেল ডিলার', payable: 28500, dueDays: 1 },
    { id: 's_fresh', companyName: 'ফ্রেশ চালের আড়ত', contactName: 'করিম মহাজন', phone: '01811223344', category: 'পাইকারি চাল', payable: 36700, dueDays: 12 }
  ];
  for (const s of suppliers) await dbPut('suppliers', s);

  const products = [
    { id: 'p_rice', name: 'মিনিকেট চাল (৫০ কেজি)', unit: 'বস্তা', buyPrice: 3400, sellPrice: 3650, stock: 2, lowLimit: 5, vatRate: 0 },
    { id: 'p_oil', name: 'তীর সয়াবিন তেল (৫ লিটার)', unit: 'বোতল', buyPrice: 790, sellPrice: 820, stock: 3, lowLimit: 8, vatRate: 0 },
    { id: 'p_sugar', name: 'ফ্রেশ সাদা চিনি', unit: 'কেজি', buyPrice: 125, sellPrice: 130, stock: 15, lowLimit: 20, vatRate: 0 },
    { id: 'p_soap', name: 'লাক্স সাবান ১০০ গ্রাম', unit: 'পিস', buyPrice: 54, sellPrice: 60, stock: 48, lowLimit: 12, vatRate: 5 }
  ];
  for (const p of products) await dbPut('products', p);

  const expenses = [
    { id: 'e_1', category: 'দোকান ভাড়া ও বিদ্যুৎ বিল', amount: 1450, note: 'অক্টোবর মাসের বিদ্যুৎ বিল', createdAt: daysAgoIso(0, 10) },
    { id: 'e_2', category: 'চা-নাস্তা ও যাতায়াত', amount: 350, note: 'মাল আনা-নেওয়ার ভ্যান ভাড়া', createdAt: daysAgoIso(1, 13) }
  ];
  for (const ex of expenses) await dbPut('expenses', ex);

  const staff = [
    { id: 'st_1', name: 'শফিকুল ইসলাম', role: 'manager', phone: '01711234567', active: true },
    { id: 'st_2', name: 'আবির হোসেন', role: 'cashier', phone: '01792889902', active: true },
    { id: 'st_3', name: 'সুজন মিয়া', role: 'delivery', phone: '01812334455', active: true }
  ];
  for (const st of staff) await dbPut('staff', st);
}

export async function resetDemoData() {
  await dbClearAll();
  await seedIfEmpty();
}
