import { initShell } from '../components/shell.js';
import { getLang } from '../core/i18n.js';

async function renderMore() {
  const { config } = await initShell({
    activeNav: 'more',
    pageTitle: getLang() === 'bn' ? 'সকল মডিউল ও সেটিংস' : 'All Tools & Modules',
    onLangChange: renderMore
  });

  const isBn = getLang() === 'bn';
  document.getElementById('more-mode-badge').textContent =
    config?.mode === 'pro' ? (isBn ? 'ব্যবসা প্রো মোড' : 'Business Pro') : (isBn ? 'সহজ মোড' : 'Simple Mode');

  const tools = [
    { href: './tagada-studio.html', icon: '📣', title: isBn ? 'তাগাদা স্টুডিও' : 'Tagada Studio', sub: isBn ? 'SMS integration পরবর্তী ধাপে' : 'SMS integration later', status: isBn ? 'ডেমো' : 'Demo' },
    { href: './cash-memo.html', icon: '🧾', title: isBn ? 'ডিজিটাল ক্যাশ মেমো' : 'Cash Memo / POS', sub: isBn ? 'প্রথম MVP-এর বাইরে' : 'Outside first MVP', status: isBn ? 'পরবর্তী সংস্করণ' : 'Later' },
    { href: './inventory.html', icon: '📦', title: isBn ? 'স্টক ও ইনভেন্টরি' : 'Stock Inventory', sub: isBn ? 'শিক্ষকের MVP scope-এর বাইরে' : 'Outside teacher MVP scope', status: isBn ? 'পরবর্তী সংস্করণ' : 'Later' },
    { href: './cashbook-pnl.html', icon: '📊', title: isBn ? 'ক্যাশ খাতা ও লাভ-ক্ষতি' : 'Cash Register & P&L', sub: isBn ? 'প্রথম MVP-এর বাইরে' : 'Outside first MVP', status: isBn ? 'ডেমো' : 'Demo' },
    { href: './branches.html', icon: '🏪', title: isBn ? 'মাল্টি-দোকান / শাখা' : 'Branch Management', sub: isBn ? 'প্রথম MVP-এর বাইরে' : 'Outside first MVP', status: isBn ? 'ডেমো' : 'Demo' },
    { href: './staff.html', icon: '🪪', title: isBn ? 'স্টাফ ও অ্যাক্সেস' : 'Staff & Access', sub: isBn ? 'বাস্তব role enforcement পরবর্তী ধাপে' : 'Real role enforcement later', status: isBn ? 'ডেমো' : 'Demo' },
    { href: './offline-sync.html', icon: '☁️', title: isBn ? 'অফলাইন ও সিঙ্ক সেন্টার' : 'Offline Sync Center', sub: isBn ? 'লোকাল ডাটা ও pending queue' : 'Local data and pending queue', status: isBn ? 'চালু' : 'Active' },
    { href: './billing.html', icon: '💳', title: isBn ? 'সাবস্ক্রিপশন ও SMS প্যাক' : 'Plans & SMS Top-Up', sub: isBn ? 'পেমেন্ট gateway যুক্ত হয়নি' : 'Payment gateway not connected', status: isBn ? 'UI preview' : 'UI preview' },
    { href: './public-khotiyan.html', icon: '🔗', title: isBn ? 'গ্রাহকের পাশবই প্রিভিউ' : 'Customer Passbook Preview', sub: isBn ? 'এখন শুধু লগইন করা দোকানের private view' : 'Private shop view only', status: isBn ? 'প্রিভিউ' : 'Preview' },
    { href: './settings.html', icon: '⚙️', title: isBn ? 'সেটিংস ও থিম' : 'Settings & Theme', sub: isBn ? 'দোকানের তথ্য ও পছন্দ' : 'Shop details and preferences', status: isBn ? 'চালু' : 'Active' }
  ];

  document.getElementById('tools-grid').innerHTML = tools.map((item) => `
    <a href="${item.href}" class="card stack-xs">
      <div style="font-size: 24px;">${item.icon}</div>
      <div class="t-label">${item.title}</div>
      <div class="t-caption">${item.sub}</div>
      ${item.status ? `<span class="badge ${item.status === 'Active' || item.status === 'চালু' ? 'badge-green' : 'badge-amber'}">${item.status}</span>` : ''}
    </a>`).join('');
}

renderMore();
