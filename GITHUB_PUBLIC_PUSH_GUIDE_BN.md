# GitHub Public Repository — Safe Push Guide (BakiKhata)

Target repository: `https://github.com/Shihab-10/bakikhata-prototype`

## Before pushing
- Use this Vercel-ready project folder, not the older `BakiKhata_FullStack_01` folder.
- Never commit `.env`, database connection strings, JWT secrets, private keys, service-account JSON, or real customer data.
- Firebase Web App config values (`apiKey`, `authDomain`, `projectId`, `appId`) are public client configuration. Do not confuse them with service-account private keys.
- `.gitignore` excludes environment files, local database files, virtual environments, and private credentials.

## PowerShell commands
Run from this extracted project root:

```powershell
git init
git branch -M main
git remote add origin https://github.com/Shihab-10/bakikhata-prototype.git
git add -A
git status --short
git diff --cached --name-only
```

Review staged files before committing. Then:

```powershell
git commit -m "Initial BakiKhata Vercel deployment"
git push -u origin main
```

GitHub may open a browser for authentication. Complete sign-in there; do not paste passwords or tokens into chat.

If Git says `origin` already exists, check it using `git remote -v`; do not add it again.

## Vercel
After code is pushed, open Vercel Dashboard → Add New → Project → Import Git Repository → `Shihab-10/bakikhata-prototype`.
