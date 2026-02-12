# 🔐 Firebase Configuration & Deployment Guide

## Overview
This guide provides step-by-step instructions for configuring Firebase to support the enterprise authentication system with admin approval workflows and invitation tokens.

---

## 📋 Prerequisites

- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase project created (apex-med-law-prod)
- Admin access to Firebase Console
- Brevo API key configured in `.env.local`

---

## 🔧 Step 1: Manual Database Setup (CRITICAL - DO THIS FIRST!)

### 1.1 Create Admin User

**IMPORTANT:** You MUST create the admin user manually BEFORE deploying security rules, otherwise you'll lock yourself out!

1. Go to [Firebase Console - Firestore](https://console.firebase.google.com/project/apex-med-law-prod/firestore)
2. Click "Start collection"
3. Collection ID: `authorizedUsers`
4. Click "Next"
5. Document ID: **Use your actual Firebase Auth UID** (find this in Authentication > Users)
   - Alternatively, use your email as the ID: `support@apexmedlaw.com`
6. Add fields:
   ```
   email: "support@apexmedlaw.com" (string)
   name: "Support Admin" (string)
   role: "ADMIN" (string)
   status: "active" (string)
   addedAt: "2026-02-07" (string)
   avatarColor: "bg-purple-600" (string)
   ```
7. Click "Save"

### 1.2 Create Additional Collections (Optional - will be auto-created)

These collections will be created automatically when first used, but you can pre-create them:

**Collection: `pendingSignupRequests`**
- Will store signup requests from non-invited users
- Leave empty for now

**Collection: `invitationTokens`**
- Will store secure invitation tokens
- Leave empty for now

---

## 🚀 Step 2: Deploy Firestore Security Rules

### 2.1 Login to Firebase CLI

```bash
firebase login
```

### 2.2 Initialize Firebase (if not already done)

```bash
firebase init
```

Select:
- Firestore: Configure security rules and indexes files
- Use existing project: apex-med-law-prod

 ### 2.3 Deploy Rules

```bash
firebase deploy --only firestore:rules
```

**Expected Output:**
```
✔  firestore: rules file firestore.rules compiled successfully
✔  firestore: released rules firestore.rules to cloud.firestore
✔  Deploy complete!
```

### 2.4 Verify Rules Deployment

1. Go to [Firebase Console - Firestore Rules](https://console.firebase.google.com/project/apex-med-law-prod/firestore/rules)
2. Verify the rules include:
   - `pendingSignupRequests` collection rules
   - `invitationTokens` collection rules
   - Admin-only write access for both

---

## 🧪 Step 3: Test the System

### 3.1 Test Admin Login

1. Navigate to your app URL
2. Login with `support@apexmedlaw.com` and your password
3. Verify you can access "Firm Administration" in the sidebar
4. Should see "Pending Access Requests" section

### 3.2 Test Invitation Flow

1. As admin, go to "Firm Administration"
2. Enter test user details:
   - Name: "Test User"
   - Email: "test@example.com"
   - Role: "USER"
3. Click "Send Invite"
4. Check Firestore for new document in `invitationTokens`
5. Copy the invitation link
6. Open in incognito/private window
7. Should see pre-filled signup form with "Valid Invitation" badge
8. Create account - should auto-authorize

### 3.3 Test Signup Request Flow

1. Open app in incognito window (not logged in)
2. Click "Don't have access? Request it here"
3. Fill in name and email
4. Submit request
5. Check Firestore - should see document in `pendingSignupRequests`
6. Check email (support@apexmedlaw.com) - should receive notification
7. Login as admin
8. Go to "Firm Administration"
9. Should see pending request with Approve/Deny buttons
10. Click "Approve"
11. Check Firestore - user should be in `authorizedUsers`
12. Request status should change to "approved"

### 3.4 Test Unauthorized Access

1. Open app in incognito window
2. Try to create account with random email (no invite)
3. Should be able to create Firebase auth account
4. Should immediately be signed out with "Access Denied" message
5. Should show option to "Request Access"

---

## 🔒 Step 4: Security Verification

### 4.1 Verify Firestore Rules

Test these scenarios in Firebase Console > Firestore > Rules Playground:

**Test 1: Unauthenticated user cannot read cases**
```
Location: /cases/test-case-id
Operation: get
Auth: Unauthenticated
Expected: Denied ❌
```

**Test 2: Authenticated but unauthorized user cannot read cases**
```
Location: /cases/test-case-id
Operation: get
Auth: Authenticated (not in authorizedUsers)
Expected: Denied ❌
```

**Test 3: Authorized user can read cases**
```
Location: /cases/test-case-id
Operation: get
Auth: Authenticated (in authorizedUsers)
Expected: Allowed ✅
```

**Test 4: Non-admin cannot create invitation tokens**
```
Location: /invitationTokens/test-token
Operation: create
Auth: Authenticated USER role
Expected: Denied ❌
```

**Test 5: Admin can create invitation tokens**
```
Location: /invitationTokens/test-token
Operation: create
Auth: Authenticated ADMIN role
Expected: Allowed ✅
```

### 4.2 Verify Email Service

1. Check `.env.local` has `VITE_BREVO_API_KEY`
2. Test invitation email:
   - Send invite from admin panel
   - Check recipient inbox
   - Verify email formatting and link
3. Test signup request notification:
   - Submit access request
   - Check admin inbox (support@apexmedlaw.com)
   - Verify notification received

---

## 📊 Step 5: Monitor & Maintain

### 5.1 Regular Checks

**Daily:**
- Review pending signup requests
- Check for expired invitation tokens

**Weekly:**
- Review authorized users list
- Clean up denied/expired requests
- Monitor email delivery rates

**Monthly:**
- Audit admin actions
- Review security rules effectiveness
- Update documentation if needed

### 5.2 Maintenance Tasks

**Clean up expired tokens:**
```typescript
import { cleanupExpiredTokens } from './services/invitationService';

// Run periodically (e.g., daily cron job)
const cleaned = await cleanupExpiredTokens();
console.log(`Cleaned up ${cleaned} expired tokens`);
```

**Export audit log:**
1. Go to Firestore Console
2. Export `pendingSignupRequests` collection
3. Filter by `reviewedAt` date range
4. Download as JSON for records

---

## 🐛 Troubleshooting

### Issue: "Access Denied" for admin user

**Solution:**
1. Check Firestore `authorizedUsers` collection
2. Verify document exists with your email
3. Verify `role` field is "ADMIN"
4. Check Firebase Auth UID matches document ID (if using UID as ID)

### Issue: Invitation emails not sending

**Solution:**
1. Verify `VITE_BREVO_API_KEY` in `.env.local`
2. Check Brevo dashboard for API key validity
3. Verify sender email (support@apexmedlaw.com) is verified in Brevo
4. Check browser console for error messages
5. Test API key with curl:
   ```bash
   curl -X GET "https://api.brevo.com/v3/account" \
     -H "api-key: YOUR_API_KEY"
   ```

### Issue: "Missing permissions" error in console

**Solution:**
- This is expected during login validation
- Firestore rules allow authenticated users to read `authorizedUsers`
- Error appears before authentication completes
- Safe to ignore if login works correctly

### Issue: Invitation link shows "Invalid or Expired"

**Solution:**
1. Check `invitationTokens` collection in Firestore
2. Verify token document exists
3. Check `status` field (should be "active")
4. Check `expiresAt` date (should be future)
5. Verify `used` field is `false`

### Issue: Signup request not appearing in admin panel

**Solution:**
1. Check Firestore `pendingSignupRequests` collection
2. Verify document was created
3. Check `status` field is "pending"
4. Verify admin user has ADMIN role
5. Check browser console for subscription errors

---

## 📝 Configuration Checklist

Before going to production, verify:

- [ ] Admin user created in Firestore
- [ ] Admin user has ADMIN role
- [ ] Firestore rules deployed
- [ ] Rules tested in Rules Playground
- [ ] Brevo API key configured
- [ ] Sender email verified in Brevo
- [ ] Test invitation sent and received
- [ ] Test signup request submitted
- [ ] Admin can approve/deny requests
- [ ] Unauthorized users blocked from login
- [ ] Invited users can auto-register
- [ ] Email notifications working
- [ ] All collections have proper indexes
- [ ] Backup strategy in place

---

## 🔐 Security Best Practices

1. **Never share admin credentials**
   - Use individual admin accounts
   - Rotate passwords regularly

2. **Monitor invitation tokens**
   - Set reasonable expiration (7 days default)
   - Revoke unused tokens
   - Track token usage

3. **Review signup requests promptly**
   - Don't leave requests pending indefinitely
   - Provide denial reasons
   - Keep audit trail

4. **Regular security audits**
   - Review authorized users quarterly
   - Check for orphaned accounts
   - Verify admin role assignments

5. **Email security**
   - Use environment variables for API keys
   - Never commit keys to git
   - Rotate API keys periodically

---

## 📞 Support

For issues or questions:
- Email: support@apexmedlaw.com
- Firebase Console: https://console.firebase.google.com/project/apex-med-law-prod
- Brevo Dashboard: https://app.brevo.com

---

**Last Updated:** 2026-02-07
**Version:** 1.0
**Status:** Production Ready ✅
