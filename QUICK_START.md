# 🚀 Quick Start Guide - Authentication System

## ⚡ 5-Minute Setup

### Step 1: Create Admin User (CRITICAL!)
1. Go to: https://console.firebase.google.com/project/apex-med-law-prod/firestore
2. Collection: `authorizedUsers`
3. Document ID: `support@apexmedlaw.com` (or your email)
4. Add fields:
   ```
   email: "support@apexmedlaw.com"
   name: "Support Admin"
   role: "ADMIN"
   status: "active"
   addedAt: "2026-02-07"
   avatarColor: "bg-purple-600"
   ```

### Step 2: Environment Variables
Copy `.env.template` to `.env.local` and fill in your API keys.
Required: `VITE_FIREBASE_*`, `VITE_BREVO_API_KEY`, `VITE_ANTHROPIC_API_KEY`

### Step 3: Start App
```bash
npm run dev
```

### Step 4: Test Login
1. Open app
2. Login with your admin email
3. Go to "Firm Administration"
4. You should see "Pending Access Requests" panel

---

## 🎯 Common Tasks

### Invite a User
1. Login as admin
2. Go to "Firm Administration"
3. Fill in: Name, Email, Role
4. Click "Send Invite"
5. User receives email with link
6. User clicks link → Auto-approved signup

### Approve Signup Request
1. Login as admin
2. Go to "Firm Administration"
3. See pending requests
4. Click "Approve" or "Deny"
5. User receives email notification

### Handle Unauthorized User
- User tries to login without approval
- System blocks access
- Shows "Request Access" option
- User submits request
- Admin receives notification

---

## 🐛 Quick Troubleshooting

### "Access Denied" for Admin
→ Check Firestore `authorizedUsers` collection
→ Verify `role: "ADMIN"` exists

### Emails Not Sending
→ Check `VITE_BREVO_API_KEY` in `.env.local`
→ Verify sender email in Brevo dashboard

### Invitation Link Invalid
→ Check `invitationTokens` collection
→ Verify `status: "active"` and `expiresAt` is future

---

## 📚 Full Documentation

- `IMPLEMENTATION_COMPLETE.md` - Complete feature list
- `FIREBASE_SETUP_GUIDE.md` - Detailed setup instructions
- `AUTHENTICATION_IMPLEMENTATION_PLAN.md` - Technical details

---

## ✅ Verification Checklist

- [ ] Admin user created in Firestore
- [ ] Can login as admin
- [ ] Can access "Firm Administration"
- [ ] Can send test invitation
- [ ] Invitation email received
- [ ] Can approve signup requests
- [ ] Unauthorized users blocked

---

**Status:** ✅ Ready for Production
**Last Updated:** 2026-02-07
