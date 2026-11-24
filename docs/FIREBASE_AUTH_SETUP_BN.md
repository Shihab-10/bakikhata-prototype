# Baki Khata — Firebase Google Authentication (বাংলা)

এই build-এ Google sign-in-এর জন্য Firebase Authentication ব্যবহার করা হয়। Demo Login এবং Mobile + Password Login আগের মতোই থাকে।

## Architecture

1. Browser Firebase JavaScript SDK দিয়ে Google account sign-in করে।
2. Firebase client একটি Firebase ID token পায়।
3. Browser token-টি `POST /api/v1/auth/firebase` বা `POST /api/v1/auth/firebase/register`-এ পাঠায়।
4. FastAPI Google Secure Token JWK দিয়ে RS256 signature, `aud`, `iss`, `exp`, `iat`, `auth_time`, provider (`google.com`) এবং verified email পরীক্ষা করে।
5. Backend Firebase UID-কে BakiKhata merchant user-এর সাথে link করে এবং নিজের JWT session দেয়।
6. Shop/customer/ledger data আগের মতো BakiKhata database-এই থাকে; Firebase-এ financial ledger রাখা হয় না।

Firebase ID-token verification-এর জন্য Firebase Admin service-account private key এই local prototype-এ দরকার নেই। Backend PyJWT দিয়ে Firebase-এর public JWK verify করে। Production deployment-এ HTTPS বাধ্যতামূলক।

## Firebase Console — one-time setup

1. https://console.firebase.google.com/ খুলে `BakiKhata Prototype` নামে project create করুন।
2. Project Settings → General → Your apps → Add app → Web select করুন। App nickname দিন `BakiKhata Web`।
3. Build → Authentication → Get started।
4. Sign-in method / Sign-in providers থেকে Google enable করুন এবং support email select করে Save করুন।
5. Authentication → Settings → Authorized domains-এ `localhost` add করুন। 2025-04-28-এর পর তৈরি project-এ localhost default-এ নাও থাকতে পারে।
6. Project Settings → General → Your apps → Web app → SDK setup and configuration থেকে `apiKey`, `authDomain`, `projectId`, `appId` সংগ্রহ করুন।

Local app-টি `http://localhost:8010` দিয়ে খুলুন। `127.0.0.1` দিয়ে খুলবেন না, যদি না Firebase Authorized domains-এ `127.0.0.1` আলাদাভাবে যোগ করেন।

## Backend `.env`

`backend/.env`-এ নিচের চারটি value থাকবে:

```env
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_APP_ID=1:...:web:...
```

এগুলো Firebase Web App-এর public client configuration। Firebase service-account JSON বা private key এখানে বসাবেন না। `GOOGLE_CLIENT_ID` legacy direct-Google flow-এর জন্য রাখা হয়েছে; বর্তমান login UI এটি ব্যবহার করে না।

## Run

Project root PowerShell:

```powershell
.\scripts\setup.ps1
.\scripts\test.ps1
.\scripts\start.ps1
```

Application: `http://localhost:8010`

API docs: `http://localhost:8010/docs`

## User flows

- Demo Login: preserved.
- Mobile + Password Login: preserved.
- First-time Google user: Firebase sign-in → phone + shop details → merchant/shop created → BakiKhata JWT.
- Returning Google user: Firebase sign-in → existing merchant session.
- Existing mobile account: sign in with mobile/password → Settings → Google account সংযুক্ত করুন → Google sign-in → linked identity saved.
- A Google identity already linked to another merchant is rejected.
- Reusing a phone number for a new Google account is rejected; user must sign in with the existing mobile account and link Google from Settings.

## Deploy later

For production, set the same four Firebase values in the deployed backend's environment variables. Add the production hostname to Firebase Authentication → Settings → Authorized domains. Use HTTPS. If the production hostname changes, add the new hostname; do not replace the local development domain while you still need it.

This prototype currently uses the Firebase popup flow first, with redirect fallback only when the browser blocks popups. If using redirect on a non-Firebase host with strict third-party storage restrictions, follow Firebase's redirect best-practice guidance (custom auth domain or proxy).

## Troubleshooting

- `Firebase Authentication configure করা হয়নি`: one or more `FIREBASE_*` settings are missing; restart FastAPI after saving `.env`.
- `auth/unauthorized-domain`: add the exact hostname (not the port or full URL) under Authorized domains.
- `auth/operation-not-allowed`: enable Google provider in Firebase Authentication.
- `auth/invalid-api-key`: re-copy `apiKey` from the correct Firebase Web App.
- `Firebase token যাচাই করা যায়নি`: confirm `FIREBASE_PROJECT_ID` matches the Web App project and that the backend has outbound internet access to Google's Secure Token JWK endpoint.
- If a phone number already has a BakiKhata account, use mobile login first, then link Google from Settings.
