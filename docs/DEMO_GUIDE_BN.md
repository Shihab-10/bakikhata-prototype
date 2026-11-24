# Sir-এর সামনে Demo দেখানোর ধাপ

## প্রথমবার চালু করা

1. ZIP extract করে `BakiKhata_FullStack_01` folder VS Code-এ open করুন।
2. Terminal → PowerShell খুলুন।
3. নিচের command চালান:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup.ps1
.\scripts\seed-demo.ps1
.\scripts\start.ps1
```

4. Browser-এ `http://127.0.0.1:8000` খুলুন।

PowerShell-এর `PS C:\...>` prompt বা `>>` চিহ্ন command-এর অংশ নয়—কপি করবেন না।

## Demo account

- মোবাইল: `01712987654`
- পাসওয়ার্ড: `Demo@12345`

## Core demo flow

1. Demo account দিয়ে login করুন।
2. Dashboard-এ মোট customer due এবং recent transaction দেখান।
3. Customers → নতুন খরিদ্দার → নাম, এলাকা, alias, phone ও opening due দিন।
4. Customer ledger খুলে opening due দেখান।
5. Quick Entry থেকে `বাকি যোগ` করে একটি transaction save করুন।
6. একই customer-এর জন্য `জমা গ্রহণ` করে payment save করুন।
7. Customer ledger refresh করে balance ও history দেখান।
8. একই নামের দুইজন Sami-কে area দিয়ে আলাদা করে দেখান।
9. Settings থেকে logout করে নতুন shop register করুন; নতুন shop-এর customer list আলাদা থাকবে।
10. API docs-এ `http://127.0.0.1:8000/docs` দেখিয়ে backend endpoints ব্যাখ্যা করুন।

## Offline queue demonstration

1. আগে demo account-এ online login করে Dashboard খুলুন, যাতে local cache তৈরি হয়।
2. More Tools → Offline & Backup-এ যান।
3. Offline Preview toggle চালু করুন।
4. Customer তৈরি করুন অথবা existing customer-এর Due/Payment entry দিন।
5. Sync Center-এ Pending item দেখান।
6. Offline Preview toggle বন্ধ করুন এবং Force Sync চাপুন।
7. Page refresh করে server থেকে synced data দেখান।

এটি prototype-level offline queue demonstration। Production-এর আগে airplane mode, phone restart, 2-device conflict, backup restore এবং দীর্ঘ সময় offline থাকার QA করতে হবে।

## PostgreSQL

এই প্রথম phase-এ PostgreSQL install বাধ্যতামূলক নয়। SQLite দিয়ে app চালু ও core flow যাচাই করুন। পরে PostgreSQL install সফল হলে `backend/.env`-এর `DATABASE_URL` পরিবর্তন করে PostgreSQL-এ switch করুন।
