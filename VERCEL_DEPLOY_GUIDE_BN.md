# BakiKhata — Local Account Mode (PowerShell)

এই সংস্করণে Sign Up, Sign In, Demo Login এবং হিসাব browser-এর IndexedDB-তে সংরক্ষিত হয়।

## কীভাবে কাজ করবে
- নতুন দোকান মোবাইল নম্বর ও password দিয়ে Sign Up করতে পারবে।
- একই browser/device-এ পরে একই নম্বর ও password দিয়ে Sign In করা যাবে।
- Password plain text হিসেবে রাখা হয় না; PBKDF2-SHA-256 hash ও unique salt রাখা হয়।
- প্রতিটি দোকানের ledger আলাদা IndexedDB database-এ থাকে।
- পুরোনো Demo Account ব্যবহার করা যাবে: `01712987654` / `Demo@12345`.
- Cloud database/API default-এ বন্ধ। Existing `DATABASE_URL`/`POSTGRES_URL` values Vercel-এ থাকলেও এই mode সেগুলো ব্যবহার করে না।

## PowerShell দিয়ে preflight
Project root-এ PowerShell খুলে চালাও:

```powershell
.\scripts\prepare-vercel.ps1
```

## Live Vercel deployment
Project আগে Vercel CLI দিয়ে link করা থাকলে:

```powershell
npx vercel@latest --prod
```

Project link করা না থাকলে CLI প্রথমবার setup/link করার prompt দেখাবে। Vercel account login প্রয়োজন হলে CLI নিজেই sign-in flow খুলবে; Dashboard-এ database বা environment variable configure করার দরকার নেই।

## গুরুত্বপূর্ণ সীমাবদ্ধতা
- Account ও হিসাব শুধু যে browser/device-এ তৈরি হয়েছে সেখানেই থাকবে।
- Browser site data clear করলে local accounts ও ledger data মুছে যেতে পারে।
- অন্য device-এ login, cloud backup এবং multi-device sync এখনো নেই; এগুলো পরবর্তী Cloud Database ধাপে যোগ হবে।
- Local Account Mode sensitive multi-user production authentication-এর বিকল্প নয়; এটি আপাতত single-device use-এর জন্য।

## পরে Cloud Mode চালু করতে
পরবর্তী ধাপে persistent PostgreSQL এবং server authentication যোগ করা হবে। তখন `BK_ENABLE_CLOUD_DATABASE=1` দিয়ে cloud mode স্পষ্টভাবে enable করা হবে।