# BakiKhata Vercel Deployment — বাংলা নির্দেশিকা

## এই package-এ কী আছে
- FastAPI-এর Vercel entrypoint: `index.py`
- Root `requirements.txt` এবং `.python-version`
- Vercel CDN-এর জন্য `public/` static assets
- Neon/PostgreSQL production configuration
- Firebase Authentication integration (Firebase values পরে Vercel Environment Variables-এ বসবে)
- Production demo data seed করার PowerShell script

## ধাপ ১ — ZIP extract
ZIP-টি Downloads-এ extract করে `BakiKhata_Vercel_Deploy_01` folder VS Code-এ open করো। Root-এ `index.py`, `requirements.txt`, `vercel.json`, `public`, `backend` দেখতে হবে।

## ধাপ ২ — Vercel CLI login
Project root terminal-এ চালাও:

```powershell
npx vercel@latest login
```

Browser খুললে নিজের Vercel account দিয়ে login/authorize করো। তারপর terminal-এ ফিরে আসো।

## ধাপ ৩ — Vercel project তৈরি
Project root-এ চালাও:

```powershell
npx vercel@latest
```

Prompt এলে:
- Set up and deploy? `Y`
- Which scope? নিজের Personal Account
- Link to existing project? `N`
- Project name: `bakikhata-prototype`
- Directory: `./`
- Override settings? `N`

প্রথম deployment-এর পর Vercel একটি preview URL দেবে। PostgreSQL ও secrets configure না করা পর্যন্ত এটিকে live usable app হিসেবে share করবে না।

## ধাপ ৪ — Neon PostgreSQL connect
Vercel Dashboard → নতুন `bakikhata-prototype` project → Storage/Marketplace → Browse Marketplace → Neon → Install.
- New Neon database create করো।
- Region হিসেবে Vercel function region-এর কাছাকাছি region নাও; Asia user হলে Singapore region available থাকলে সেটি পছন্দ করো।
- Production environment-এর সঙ্গে database connect করো।
- Neon-এর pooled connection string নাও।

## ধাপ ৫ — Environment Variables
Vercel Dashboard → Project → Settings → Environment Variables.
Production (এবং প্রয়োজন হলে Preview) environment-এ add করো:

- `DATABASE_URL` = Neon pooled PostgreSQL connection string
- `JWT_SECRET` = নিজের generated long random secret
- `APP_ENV` = `production`

Save করো। Secret values কাউকে পাঠাবে না। Environment variable বদলালে নতুন deployment প্রয়োজন।

## ধাপ ৬ — Redeploy
Vercel Dashboard → Deployments → latest deployment-এর `...` menu → Redeploy. অথবা project root থেকে:

```powershell
npx vercel@latest --prod
```

## ধাপ ৭ — Demo account seed
প্রথমে Vercel CLI দিয়ে production env pull না করে, Neon-এর pooled connection string হাতে নিয়ে local PowerShell-এ চালাও:

```powershell
.\scripts\seed-production-demo.ps1
```

Connection string prompt-এ paste করো। এটি file-এ save হবে না। Demo account:
- Phone: `01712987654`
- Password: `Demo@12345`

## ধাপ ৮ — Verify
নিজের Vercel URL-এর সঙ্গে:
- `/health`
- `/docs`
- `/`
খুলে দেখো। Mobile phone-এও পরীক্ষা করো।

## ধাপ ৯ — Firebase Google Login (পরের ধাপ)
Deploy URL পাওয়ার পর Firebase Console → Authentication → Settings → Authorized domains-এ domain যোগ করো (শুধু hostname, `https://` ছাড়া)। এরপর Vercel Environment Variables-এ `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` add করে redeploy করো।

## নিরাপত্তা
- `backend/.env`, database URL, JWT secret, service account key কখনো GitHub/Vercel source-এ commit করবে না।
- Vercel production-এ SQLite ব্যবহার করবে না; persistent PostgreSQL লাগবে।
- Demo account shared; synthetic data ছাড়া real customer data দেবে না।
