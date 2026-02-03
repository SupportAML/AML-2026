# 🎯 ACTION PLAN: Secure Your Repository

## ✅ COMPLETED ACTIONS

### 1. Code Security Fixed ✓
- [x] Moved all API keys to `.env.local` (not tracked in Git)
- [x] Updated `firebase.ts` to use environment variables
- [x] Updated `config.ts` to use environment variables
- [x] Created `.env.example` as a template
- [x] Enhanced `.gitignore` to protect environment files
- [x] Added TypeScript definitions for all environment variables
- [x] Committed secure code changes to Git

**Files Modified:**
- `.env.local` - All secrets now here (GITIGNORED ✓)
- `firebase.ts` - Uses VITE_FIREBASE_* env vars
- `config.ts` - Uses VITE_GOOGLE_DRIVE_* env vars
- `.gitignore` - Enhanced protection
- `vite-env.d.ts` - Type definitions added
- `.env.example` - Template created (SAFE TO COMMIT ✓)

---

## ⚠️ URGENT: ACTIONS YOU MUST TAKE NOW

### STEP 1: Clean Git History (10-15 minutes)

**The exposed secrets are still in your Git commit history!**

Run this PowerShell script I created:
```powershell
cd "d:\SSD DATA\Projects\copy-of-apexmedlaw-working-before-merger-2"
.\run-git-cleanup.ps1
```

**What it does:**
1. Creates a backup tag (can restore if something goes wrong)
2. Removes `firebase.ts` and `config.ts` from ALL Git history
3. Cleans up Git references
4. Verifies secrets are gone
5. Shows you what to do next

**⏱️ Takes:** ~5-10 minutes depending on repo size

---

### STEP 2: Force Push to GitHub (2 minutes)

After the cleanup script finishes successfully:

```powershell
# Push to remote (overwrites history)
git push origin --force --all
git push origin --force --tags
```

⚠️ **This is a destructive operation!** But necessary to remove secrets from GitHub.

---

### STEP 3: Rotate ALL API Keys (15-20 minutes) 🔑

**ALL these keys are currently exposed and MUST be rotated:**

#### 3.1 Firebase API Key ⚡ CRITICAL
Current: `AIzaSyBPMLqxe3oELGXut9QD6vbHYpnadW_nVd0`

1. Go to: https://console.firebase.google.com/
2. Select project: **apex-med-law**
3. Project Settings → General → Your apps
4. **Options:**
   - **Quick:** Add API restrictions in Google Cloud Console
   - **Secure:** Delete and recreate your web app
5. Update `.env.local` with new key

#### 3.2 Google Drive API Key ⚡ CRITICAL
Current: `AIzaSyC3XaVY-3IdIdd_moc7pD7CvMWj9rsX15g`

1. Go to: https://console.cloud.google.com/apis/credentials
2. **Delete** the old key
3. **Create new** API key
4. **Restrict** it immediately:
   - App restrictions: HTTP referrers
   - API restrictions: Google Drive API, Google Picker API
5. Update `.env.local`:
   ```
   VITE_GOOGLE_DRIVE_API_KEY=new_key_here
   ```

#### 3.3 Google OAuth Client ID
Current: `384939045438-rg5ffgl8...`

1. Same Google Cloud Console page
2. Edit or delete/recreate OAuth Client ID
3. Update authorized origins and redirect URIs
4. Update `.env.local`:
   ```
   VITE_GOOGLE_DRIVE_CLIENT_ID=new_client_id_here
   ```

#### 3.4 Gemini API Key ⚡ CRITICAL
Current: `AIzaSyC3XaVY-3IdIdd_moc7pD7CvMWj9rsX15g`

1. Go to: https://aistudio.google.com/app/apikey
2. **Delete** the exposed key
3. **Create new** API key
4. Update `.env.local`:
   ```
   GEMINI_API_KEY=new_key_here
   ```

#### 3.5 Brevo API Key
Current: `xkeysib-992ebc3f...`

1. Go to: https://app.brevo.com/settings/keys/api
2. **Delete** the old key
3. **Create new** key
4. Update `.env.local`:
   ```
   VITE_BREVO_API_KEY=new_key_here
   ```

---

### STEP 4: Test Locally (5 minutes)

After updating all keys in `.env.local`:

```powershell
# Restart your dev server
# Press Ctrl+C in the terminal running npm run dev
npm run dev
```

**Test these features:**
- [ ] Firebase authentication works
- [ ] Can upload files to Firebase Storage
- [ ] AI features work (Gemini API)
- [ ] Google Drive integration works
- [ ] Email invitations work (Brevo)

---

### STEP 5: Enable GitHub Security Features (3 minutes)

1. Go to: https://github.com/SupportAML/AML-2026/settings/security_analysis
2. Enable:
   - [x] **Dependency graph** (if not already)
   - [x] **Dependabot alerts**
   - [x] **Secret scanning**
   - [x] **Push protection** (prevents future leaks!)

---

### STEP 6: Update Deployment Environment (5 minutes)

If you're using Netlify, Vercel, or another hosting service:

1. Go to your deployment dashboard
2. Find Environment Variables settings
3. Add all these variables with NEW rotated keys:
   - `GEMINI_API_KEY`
   - `VITE_BREVO_API_KEY`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_GOOGLE_DRIVE_CLIENT_ID`
   - `VITE_GOOGLE_DRIVE_API_KEY`
4. Trigger a new deployment

---

## 📋 COMPLETE CHECKLIST

### Immediate (Do Now!)
- [ ] Run `.\run-git-cleanup.ps1`
- [ ] Force push to GitHub
- [ ] Rotate Firebase API key
- [ ] Rotate Google Drive API key
- [ ] Rotate Gemini API key
- [ ] Rotate Brevo API key
- [ ] Rotate Google OAuth Client ID
- [ ] Test application locally
- [ ] Update `.env.local` with all new keys

### Within 24 Hours
- [ ] Enable GitHub secret scanning
- [ ] Enable GitHub push protection
- [ ] Update deployment environment variables
- [ ] Deploy to production with new keys
- [ ] Verify production works correctly

### For Team Members
If you have team members, notify them:
```
⚠️ IMPORTANT: Git history was rewritten

Please update your local repository:

git fetch origin
git reset --hard origin/master

You'll also need to update your .env.local file with new API keys.
Contact me for the updated keys.
```

---

## 📚 Documentation Created

I've created several files to help you:

1. **`run-git-cleanup.ps1`** - Automated cleanup script (RUN THIS!)
2. **`SECURITY_CLEANUP.md`** - Comprehensive guide with all details
3. **`CLEANUP_QUICK_GUIDE.md`** - Quick reference for cleanup methods
4. **`.env.example`** - Template showing required environment variables
5. **`secrets-to-remove.txt`** - List of secrets (for BFG if you use it later)
6. **This file** - Action plan summary

---

## ⏱️ Estimated Time

| Task | Time | Priority |
|------|------|----------|
| Git history cleanup | 10-15 min | 🔴 URGENT |
| Force push | 2 min | 🔴 URGENT |
| Rotate all API keys | 15-20 min | 🔴 URGENT |
| Test locally | 5 min | 🟡 HIGH |
| GitHub security | 3 min | 🟡 HIGH |
| Update deployment | 5 min | 🟢 MEDIUM |
| **TOTAL** | **~40-50 min** | |

---

## 🆘 If Something Goes Wrong

### Restore from backup:
```powershell
git tag
# Find the backup tag (starts with "backup-")
git reset --hard backup-YYYYMMDD-HHMMSS
```

### Need help?
- Check `SECURITY_CLEANUP.md` for detailed troubleshooting
- GitHub's official guide: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository

---

## 🎯 SUCCESS CRITERIA

You'll know you're done when:

1. ✅ `.\run-git-cleanup.ps1` completes with "SUCCESS!"
2. ✅ Force push to GitHub succeeds
3. ✅ All 5 API keys rotated
4. ✅ Local application works with new keys
5. ✅ GitHub secret scanning enabled
6. ✅ Production deployed with new keys
7. ✅ No secrets found when searching Git history

---

## 📞 Current Status

### ✅ DONE:
- Code is now secure (uses environment variables)
- Git commit made with secure code
- Scripts and documentation created

### ⏳ TODO (YOUR ACTIONS):
- Clean Git history (run script)
- Force push to GitHub
- Rotate all 5 API keys
- Test and deploy

---

**🚀 Let's get started! Run `.\run-git-cleanup.ps1` now!**
