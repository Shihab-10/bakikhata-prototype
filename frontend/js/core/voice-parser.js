import { toEnglishDigits } from './i18n.js';

const BN_WORD_NUMS = {
  'একশ': 100, 'দুইশ': 200, 'তিনশ': 300, 'চারশ': 400, 'পাঁচশ': 500,
  'পাঁচশো': 500, 'এক হাজার': 1000, 'হাজার': 1000, 'দুই হাজার': 2000, 'পাঁচ হাজার': 5000, 'পঞ্চাশ': 50
};

function extractAmount(text) {
  const numMatch = toEnglishDigits(text).match(/\d[\d,]*/);
  if (numMatch) return Number(numMatch[0].replace(/,/g, '')) || 0;
  for (const [word, val] of Object.entries(BN_WORD_NUMS)) {
    if (text.includes(word)) return val;
  }
  return 0;
}

export function parseVoiceCommand(rawText, customers = []) {
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();
  const amount = extractAmount(text);

  const isQuery = /লেজার|হিসাব|কত|দেখ|ledger|balance|history/i.test(lower) && amount === 0;
  const isDeposit = /জমা|দিছে|দিয়েছে|দিয়েছে|পেলাম|পরিশোধ|ডিপোজিট|deposit|paid|joma/i.test(lower);
  const isCredit = /বাকি|নিছে|নিয়েছে|নিয়েছে|দিলাম|করছে|করেছে|baki|due|credit/i.test(lower);

  let intent = 'credit_given';
  if (isQuery) intent = 'ledger_query';
  else if (isDeposit && !isCredit) intent = 'payment_received';

  const matches = customers.filter((c) => {
    const n = c.name.toLowerCase();
    const area = (c.area || '').toLowerCase();
    const alias = (c.alias || '').toLowerCase();
    return lower.includes(n) || (alias && lower.includes(alias)) || (area && lower.includes(area) && lower.includes(n.split(' ')[0]));
  });

  const finalMatches = matches.length
    ? matches
    : customers.filter((c) => {
        const firstWord = c.name.split(' ')[0].toLowerCase();
        return firstWord.length >= 2 && lower.includes(firstWord);
      });

  return { rawText: text, intent, amount, matches: finalMatches };
}

export function startNativeSpeechRecognition({ onResult, onError, onEnd }) {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    if (onError) onError('unsupported');
    return null;
  }
  const recognition = new SpeechRec();
  recognition.lang = 'bn-BD';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (e) => { if (onResult) onResult(e.results?.[0]?.[0]?.transcript || ''); };
  recognition.onerror = (err) => { if (onError) onError(err.error || 'error'); };
  recognition.onend = () => { if (onEnd) onEnd(); };
  recognition.start();
  return recognition;
}
