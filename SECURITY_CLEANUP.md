# 🔐 API Key Rotation & Security Cleanup Guide

## ⚠️ CRITICAL: Exposed API Keys Found

The following API keys were hardcoded in the repository and need to be rotated **IMMEDIATELY**:

1. **Firebase API Key**: `AIzaSy...nVd0` (starts with AIzaSyBPMLqx)
2. **Google Drive API Key**: `AIzaSy...X15g` (starts with AIzaSyC3XaVY)
3. **Gemini API Key**: Same as #2

---

## 🚨 STEP 1: Rotate All Exposed API Keys

### 1.1 Firebase API Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **apex-med-law**
3. Click **Project Settings** (gear icon) → **General**
4. Scroll to **Your apps** section
5. **Option A: Restrict the existing key**
   - Click on your Web App
   - Under **Firebase SDK snippet**, note your config
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **APIs & Services** → **Credentials**
   - Find your API key and click to edit
   - Add **Application restrictions** and **API restrictions**
   
   **Option B: Delete and regenerate (RECOMMENDED)**
   - Delete your current web app from Firebase
   - Click **Add app** → Web
   - Register a new app
   - Copy the NEW configuration values
   - Update `.env.local` with new values

### 1.2 Google Drive API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Find the API key that starts with `AIzaSyC3XaVY`
5. **Delete this key** (click trash icon)
6. Click **+ CREATE CREDENTIALS** → **API key**
7. Immediately click **RESTRICT KEY** after creation:
   - **Application restrictions**: HTTP referrers (websites)
     - Add your domain: `https://your-domain.com/*`
     - Add localhost for dev: `http://localhost:*`
   - **API restrictions**: Restrict key
     - Select: Google Drive API
     - Select: Google Picker API
8. Copy the new API key
9. Update `.env.local`:
   ```
   VITE_GOOGLE_DRIVE_API_KEY=your_new_api_key_here
   ```

### 1.3 Google OAuth Client ID

1. In Google Cloud Console → **APIs & Services** → **Credentials**
2. Find OAuth 2.0 Client ID starting with `384939045438-rg5ffgl8...`
3. **Option A: Update restrictions**
   - Click to edit
   - Under **Authorized JavaScript origins**, ensure only your domains are listed
   - Under **Authorized redirect URIs**, ensure only your URIs are listed
   
   **Option B: Create new OAuth Client (RECOMMENDED)**
   - Delete the old client
   - Click **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Application type: **Web application**
   - Add authorized JavaScript origins
   - Copy new Client ID
   - Update `.env.local`:
     ```
     VITE_GOOGLE_DRIVE_CLIENT_ID=your_new_client_id_here
     ```

### 1.4 Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Find your API key (look for one starting with `AIzaSyC3XaVY`)
3. **Delete the exposed key**
4. Click **Create API Key**
5. Select your Google Cloud project or create new
6. Copy the new API key
7. Update `.env.local`:
   ```
   GEMINI_API_KEY=your_new_gemini_key_here
   ```

### 1.5 Brevo API Key

1. Go to [Brevo](https://app.brevo.com/settings/keys/api)
2. Find the key starting with `xkeysib-992ebc3f...` (your exposed Brevo key)
3. **Delete this key**
4. Click **Generate a new API key**
5. Give it a name (e.g., "Production API Key")
6. Copy the new key
7. Update `.env.local`:
   ```
   VITE_BREVO_API_KEY=your_new_brevo_key_here
   ```

---

## 🧹 STEP 2: Clean Git History

**⚠️ WARNING**: This will rewrite Git history and require force push. Coordinate with your team!

### Option A: Using BFG Repo-Cleaner (RECOMMENDED - Fastest)

```powershell
# 1. Install BFG (if not already installed)
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
# Or use Chocolatey: choco install bfg-repo-cleaner

# 2. Create a backup
cd "d:\SSD DATA\Projects"
git clone --mirror "copy-of-apexmedlaw-working-before-merger-2" backup-repo.git

# 3. Create a file with sensitive strings to remove
# Save this in: d:\SSD DATA\Projects\secrets.txt
# Add each secret on a new line:
AIzaSyBPMLqxe***FIREBASE_KEY***
AIzaSyC3XaVY***GOOGLE_DRIVE_KEY***
384939045438-rg5f***OAUTH_CLIENT_ID***
xkeysib-992ebc3f***BREVO_KEY***

# 4. Run BFG to remove secrets
cd "d:\SSD DATA\Projects\copy-of-apexmedlaw-working-before-merger-2"
bfg --replace-text "../secrets.txt" .

# 5. Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 6. Verify the secrets are gone
git log --all --full-history -- firebase.ts
git log --all --full-history -- config.ts

# 7. Force push (THIS WILL REWRITE HISTORY!)
git push origin --force --all
git push origin --force --tags
```

### Option B: Using git-filter-repo (More Control)

```powershell
# 1. Install git-filter-repo
pip install git-filter-repo

# 2. Create backup
cd "d:\SSD DATA\Projects"
cp -r "copy-of-apexmedlaw-working-before-merger-2" "backup-apexmedlaw"

# 3. Remove secrets
cd "d:\SSD DATA\Projects\copy-of-apexmedlaw-working-before-merger-2"

git filter-repo --force --invert-paths --path firebase.ts --path config.ts --path .env.local --path .env --use-base-name

# Note: This removes these files from ALL history
# The new versions (with env vars) will be committed fresh

# 4. Force push
git push origin --force --all
```

### Option C: Simple Method (Less Thorough)

```powershell
# This removes the files from history but not the content from commit messages
cd "d:\SSD DATA\Projects\copy-of-apexmedlaw-working-before-merger-2"

# Remove files from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch firebase.ts config.ts .env.local" \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

---

## 📋 STEP 3: Commit Safe Changes

After rotating keys and cleaning history:

```powershell
cd "d:\SSD DATA\Projects\copy-of-apexmedlaw-working-before-merger-2"

# Stage the safe files
git add .gitignore
git add .env.example
git add firebase.ts
git add config.ts
git add vite-env.d.ts

# Commit with secure code
git commit -m "security: Remove hardcoded API keys and use environment variables

- Moved all API keys to .env.local (not tracked in git)
- Updated firebase.ts to use VITE_FIREBASE_* env vars
- Updated config.ts to use VITE_GOOGLE_DRIVE_* env vars
- Added .env.example as template
- Enhanced .gitignore for better env file protection
- All exposed keys have been rotated

BREAKING CHANGE: Requires .env.local file with all keys configured"

# Push to GitHub
git push origin main
```

---

## ✅ STEP 4: Verify Security

### 4.1 Check Git History

```powershell
# Search for any remaining secrets
git log --all --full-history -S "AIzaSyBPMLqxe"
git log --all --full-history -S "AIzaSyC3XaVY"

# Should return no results
```

### 4.2 Check Current Files

```powershell
# Ensure no secrets in tracked files
git grep -i "AIzaSy"
git grep -i "xkeysib"

# Should only find references in .env.local (which is gitignored)
```

### 4.3 Verify .env.local is Ignored

```powershell
git check-ignore .env.local
# Should output: .env.local
```

---

## 📝 STEP 5: Update Team & Documentation

1. **Update README.md** to mention:
   - Required environment variables
   - Link to `.env.example`
   - Setup instructions

2. **Notify your team**:
   - Git history has been rewritten
   - They need to re-clone or reset their local repos:
     ```powershell
     git fetch origin
     git reset --hard origin/main
     ```

3. **Update deployment environments** (Netlify, Vercel, etc.):
   - Add all new environment variables
   - Trigger new deployment

---

## 🎯 Prevention Checklist

- [x] All API keys moved to `.env.local`
- [ ] All exposed keys rotated/deleted
- [ ] Git history cleaned
- [ ] `.env.example` created and committed
- [ ] `.gitignore` updated
- [ ] Changes pushed to GitHub
- [ ] Team notified
- [ ] Deployment environment updated
- [ ] Local app tested with new keys
- [ ] Production deployed with new keys

---

## 🔍 Additional Security Measures

### Enable GitHub Secret Scanning

1. Go to your repo: https://github.com/SupportAML/AML-2026
2. Settings → Security → Code security and analysis
3. Enable **Secret scanning**
4. Enable **Push protection** (prevents future accidental commits)

### Use GitHub's Secret Scanner

```powershell
# Install gitleaks
choco install gitleaks

# Scan for secrets
gitleaks detect --source="d:\SSD DATA\Projects\copy-of-apexmedlaw-working-before-merger-2" --verbose
```

### Monitor API Key Usage

- Set up billing alerts in Google Cloud Console
- Monitor Firebase usage in Firebase Console
- Check Brevo email sending stats regularly

---

## 📞 Need Help?

If you encounter issues:
1. Don't panic - you have backups
2. Check GitHub's guide: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
3. Contact GitHub Support if secrets were public for extended periods

**Remember**: Prevention is better than cure. Always use environment variables for secrets!
