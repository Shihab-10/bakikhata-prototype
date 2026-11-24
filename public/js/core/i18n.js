const LANG_KEY = 'bk_lang';
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const EN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function getLang() {
  return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'bn';
}

export function setLang(lang) {
  const valid = lang === 'en' ? 'en' : 'bn';
  localStorage.setItem(LANG_KEY, valid);
  document.documentElement.lang = valid;
  return valid;
}

export function toBanglaDigits(input) {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

export function toEnglishDigits(input) {
  return String(input).replace(/[০-৯]/g, (d) => EN_DIGITS[BN_DIGITS.indexOf(d)]);
}

export function localizeDigits(input, lang = getLang()) {
  return lang === 'en' ? toEnglishDigits(input) : toBanglaDigits(input);
}

export function formatTaka(amount, lang = getLang()) {
  const num = Math.abs(Math.round(Number(amount) || 0));
  return '৳' + localizeDigits(num.toLocaleString('en-US'), lang);
}

export function formatShortDate(iso, lang = getLang()) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const text = d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return localizeDigits(text, lang);
}

export const DICT = {
  bn: {
    app_name: 'বাকির খাতা', nav_home: 'হোম', nav_customers: 'খরিদ্দার', nav_entry: 'এন্ট্রি', nav_suppliers: 'মহাজন', nav_more: 'মেনু',
    online: 'অনলাইন', offline: 'অফলাইন মোড', total_due: 'মোট বাকি পাওনা', today_cash_in: 'আজকের জমা (−৳)', today_credit: 'আজকের বাকি (+৳)',
    gave_credit: 'বাকি যোগ (+৳)', got_cash: 'জমা গ্রহণ (−৳)', search_customer: 'কাস্টমারের নাম বা এলাকা খুঁজুন...',
    voice_title: 'মুখে বলেই এন্ট্রি করুন', voice_sub: 'যেমন: "সামী ১০০০ টাকা বাকি করছে"', voice_btn: '🎤 বলুন',
    recent_slips: 'সাম্প্রতিক লেনদেন', customers_title: 'খরিদ্দার তালিকা', add_customer: '+ নতুন খরিদ্দার',
    suppliers_title: 'মহাজন ও পাইকার খাতা', add_supplier: '+ নতুন মহাজন', total_payable: 'মোট মহাজন দেনা',
    save_entry: 'এন্ট্রি সংরক্ষণ করুন', settings_title: 'সেটিংস ও পছন্দসমূহ', more_tools_title: 'ব্যবসার টুলস ও মেনু'
  },
  en: {
    app_name: 'Bakir Khata', nav_home: 'Home', nav_customers: 'Customers', nav_entry: 'Entry', nav_suppliers: 'Suppliers', nav_more: 'More',
    online: 'Online', offline: 'Offline Mode', total_due: 'Total Receivables (Due)', today_cash_in: "Today's Payments (−৳)", today_credit: "Today's Due Added (+৳)",
    gave_credit: 'Due Added (+৳)', got_cash: 'Payment Received (−৳)', search_customer: 'Search customer name or area...',
    voice_title: 'Voice Smart Entry', voice_sub: 'Say: "Sami 1000 taka baki korche"', voice_btn: '🎤 Speak',
    recent_slips: 'Recent Transactions', customers_title: 'Customer Directory', add_customer: '+ New Customer',
    suppliers_title: 'Supplier (Mohajon) Khata', add_supplier: '+ New Supplier', total_payable: 'Total Mohajon Payable',
    save_entry: 'Save Entry', settings_title: 'Settings & Preferences', more_tools_title: 'Business Tools & Menu'
  }
};

export function t(key, lang = getLang()) {
  return (DICT[lang] && DICT[lang][key]) || DICT.bn[key] || key;
}

export function applyTranslations() {
  const lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n'), lang); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'), lang)); });
  document.querySelectorAll('[data-lang-toggle]').forEach((btn) => { btn.textContent = lang === 'bn' ? 'EN' : 'বাং'; });
}
