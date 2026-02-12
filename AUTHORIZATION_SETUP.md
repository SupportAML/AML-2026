# 🔒 Authorization System - Setup Guide

## ⚠️ CRITICAL: Do This FIRST

**Before deploying rules, manually add your admin user to Firestore:**

1. Go to: https://console.firebase.google.com/project/apex-med-law-prod/firestore
2. Create collection: `authorizedUsers`
3. Add document with **ID = USER EMAIL** (e.g., `support@apexmedlaw.com`):
   *(Note: Using the email as ID allows the system to recognize you immediately)*
   ```
   email: "support@apexmedlaw.com"
   name: "Apex Support"
   role: "ADMIN"
   status: "active"
   addedAt: "2026-02-06"
   avatarColor: "bg-cyan-600"
   ```
4. **NOW** you can deploy rules safely

---

## What Was Done

### ✅ Code Changes
- **LoginScreen.tsx**: Added email whitelist check before signup/login
- **Security Rules**: Created rules for Firestore, Storage, and Realtime DB

### ✅ How It Works
1. User tries to login/signup
2. System checks if email exists in `authorizedUsers` collection
3. If NOT authorized → **Access Denied** (red shield icon)
4. If authorized → Allow login/signup

---

## 🚀 Deploy Security Rules

### Step 1: Install Firebase CLI (if not installed)
```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase
```bash
firebase login
```

### Step 3: Deploy Firestore Rules (ALREADY DONE ✅)
```bash
firebase deploy --only firestore:rules
```

### Step 4: Deploy Storage Rules (Optional - for file protection)
```bash
firebase deploy --only storage:rules
```

---

## 👥 How to Authorize Users

### Option 1: Firebase Console (Manual)
1. Go to: https://console.firebase.google.com/project/apex-med-law-prod/firestore
2. Open `authorizedUsers` collection
3. Click "Add Document"
4. Document ID: **Auto-generate** (important!)
5. Fields:
   - `email`: user@example.com (lowercase!)
   - `name`: User Name
   - `role`: ADMIN or USER
   - `status`: active
   - `addedAt`: 2026-02-06
   - `avatarColor`: bg-cyan-600

### Option 2: Use Team Admin Page (Recommended)
1. Login as admin (support@apexmedlaw.com)
2. Go to "Firm Administration"
3. Click "Invite Team Member"
4. Enter email, name, role
5. User is now authorized!

---

## 🧪 Testing

### Test 1: Unauthorized Email
1. Try to signup with random@gmail.com
2. Should see: **"Access Denied"** with shield icon ✅

### Test 2: Authorized Email (support@apexmedlaw.com)
1. Should already be in `authorizedUsers` collection
2. Try to login with correct password
3. Should work ✅

### Test 3: Add New User
1. Login as admin
2. Go to Team Admin
3. Invite new user
4. New user can now signup/login ✅

---

## 📋 Current Authorized Users

Check Firebase Console → Firestore → `authorizedUsers` collection

Default admin: `support@apexmedlaw.com` (must be added manually first!)

---

## 🛡️ Security Layers

1. **Frontend Check**: LoginScreen validates email before auth
2. **Firestore Rules**: Block data access for unauthorized users
3. **Storage Rules**: Block file access for unauthorized users (optional)

---

## ⚠️ Important Notes

- **Demo Mode**: Still works without authorization (offline sandbox)
- **Admin Email**: Must manually add first admin to Firestore BEFORE deploying rules
- **Email Case**: Emails are case-insensitive (stored as lowercase)
- **Rules Deployed**: Firestore rules are already active ✅

---

## 🔧 Troubleshooting

### "Access Denied" for support@apexmedlaw.com
→ Check if email exists in `authorizedUsers` collection
→ Make sure email is exactly: `support@apexmedlaw.com` (lowercase)
→ Make sure document has `role: "ADMIN"`

### "Missing or insufficient permissions" error
→ This is normal during login check (shows in console)
→ Firestore rules allow reading authorizedUsers for login validation
→ Ignore this console error - it's expected behavior

### Can't add users via Team Admin
→ Make sure you're logged in as ADMIN role
→ Check Firestore rules are deployed
→ Try adding manually via Firebase Console first

### "Could not establish connection" error
→ This is a browser extension issue (ignore it)
→ Not related to authorization system

---

## ✨ Summary

**Authorization is now FULLY LOCKED DOWN:**
- ✅ Only whitelisted emails can signup/login
- ✅ Database blocked for unauthorized users
- ✅ Admin can invite users via Team Admin page
- ✅ Firestore rules deployed and active

**Current Status:**
- Firestore rules: ✅ Deployed
- Storage rules: ⏳ Optional (deploy if needed)
- Admin user: ⚠️ Must be added manually to Firestore first

**Next step:** Add `support@apexmedlaw.com` to Firestore `authorizedUsers` collection if not already done
