
import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, updateProfile, deleteUser } from "firebase/auth";
import { auth } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { StethoscopeIcon, ArrowRightIcon, MailIcon, LockIcon, Loader2Icon, ShieldAlertIcon, CheckCircleIcon } from 'lucide-react';
import { validateInvitationToken, redeemInvitationToken } from '../services/invitationService';

interface SignUpPageProps {
  onBackToLogin: () => void;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteTokenValid, setInviteTokenValid] = useState<boolean | null>(null);

  // Check for invitation token or approval email parameters in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    const emailParam = params.get('email');
    const nameParam = params.get('name');

    if (token) {
      // Has invitation token - validate it
      setInviteToken(token);
      validateToken(token);
    } else if (emailParam && nameParam) {
      // From approval email - pre-fill email and name
      console.log('📧 Approval email detected - pre-filling form');
      setEmail(decodeURIComponent(emailParam));
      setName(decodeURIComponent(nameParam));
    }
  }, []);

  const validateToken = async (token: string) => {
    setLoading(true);
    const tokenData = await validateInvitationToken(token);
    if (tokenData) {
      setInviteTokenValid(true);
      setEmail(tokenData.email);
      setName(tokenData.name);
    } else {
      setInviteTokenValid(false);
      setError('This invitation link is invalid or has expired. Please request a new invitation.');
    }
    setLoading(false);
  };

  // Check if email is whitelisted
  const isEmailAuthorized = async (email: string): Promise<boolean> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const usersRef = collection(db, 'authorizedUsers');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const snapshot = await getDocs(q);
      console.log('✅ Authorization check for:', cleanEmail, 'Found:', !snapshot.empty);
      return !snapshot.empty;
    } catch (err: any) {
      console.error('❌ Error checking authorization:', err);
      console.error('   Error code:', err.code);
      console.error('   Error message:', err.message);
      // If there's a permission error, it means Firebase rules block unauthenticated reads
      // In this case, allow signup to proceed and let Firebase Auth handle it
      if (err.code === 'permission-denied') {
        console.warn('⚠️ Permission denied - allowing signup to proceed (will be checked post-auth)');
        return true; // Allow signup, auth check will happen after account creation
      }
      return false;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const cleanEmail = email.trim();
      console.log('🔐 Starting signup for:', cleanEmail);
      console.log('   Has invite token:', !!inviteToken);
      console.log('   Invite token valid:', inviteTokenValid);

      // Set flag to prevent App.tsx from rendering main UI during auth check
      sessionStorage.setItem('isCheckingAuthorization', 'true');
      
      // Create Firebase account (authorization will be checked after account creation)
      console.log('📝 Creating Firebase account...');
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await updateProfile(userCred.user, { displayName: name });
      console.log('✅ Firebase account created:', userCred.user.uid);

      const user = userCred.user;

      // (email verification removed per request)

      // If registering with invite token, redeem it and auto-authorize
      if (inviteToken && inviteTokenValid) {
        await redeemInvitationToken(inviteToken, user.uid);

        // Update user status from 'invited' to 'active' in authorizedUsers
        const usersRef = collection(db, 'authorizedUsers');
        const q = query(usersRef, where('email', '==', cleanEmail.toLowerCase()));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          // User found in authorizedUsers - update their status with UID as doc ID
          const userDoc = snapshot.docs[0];
          const userData = userDoc.data();

          // Create/update document with UID as the ID (proper structure)
          await setDoc(doc(db, 'authorizedUsers', user.uid), {
            ...userData,
            status: 'active',
            id: user.uid,
            email: cleanEmail.toLowerCase()
          });

          // Delete the old document if it has a different ID
          if (userDoc.id !== user.uid) {
            await deleteDoc(doc(db, 'authorizedUsers', userDoc.id));
          }
        }
      } else if (!inviteToken) {
        // No invite token - verify authorization post-auth (now we can read Firestore)
        console.log('🔍 Checking authorization for:', cleanEmail);
        
        // Small delay to ensure Firestore is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const authorized = await isEmailAuthorized(cleanEmail);
        console.log('   Authorization result:', authorized);
        
        if (!authorized) {
          // Not authorized - delete the account and show error
          console.log('❌ User not authorized - deleting account and showing error');
          
          // Delete account and sign out FIRST to prevent UI flash
          try {
            await user.delete();
          } catch (deleteError) {
            console.error('Error deleting unauthorized account:', deleteError);
          }
          
          // Force sign out
          try {
            await auth.signOut();
          } catch (signOutError) {
            console.error('Error signing out:', signOutError);
          }
          
          // Clear the flag - authorization check complete (failed)
          sessionStorage.removeItem('isCheckingAuthorization');
          
          // Set error and stop loading - this will show the error on SignUpPage
          setError('🔒 Your email is not authorized. You must be invited by an administrator before creating an account.');
          setErrorCode('auth/unauthorized');
          setLoading(false);
          
          console.log('❌ Error displayed to user - account creation blocked');
          return;
        }
        
        console.log('✅ User authorized - updating status to active');
        // Authorized - update status to active with UID as doc ID
        const usersRef = collection(db, 'authorizedUsers');
        const q = query(usersRef, where('email', '==', cleanEmail.toLowerCase()));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          // User found in authorizedUsers - update their status with UID as doc ID
          const userDoc = snapshot.docs[0];
          const userData = userDoc.data();

          // Create/update document with UID as the ID (proper structure)
          await setDoc(doc(db, 'authorizedUsers', user.uid), {
            ...userData,
            status: 'active',
            id: user.uid,
            email: cleanEmail.toLowerCase()
          });

          // Delete the old document if it has a different ID
          if (userDoc.id !== user.uid) {
            await deleteDoc(doc(db, 'authorizedUsers', userDoc.id));
          }
        }
      }

      console.log('✅ Sign up completed successfully!');
      // Clear the flag - authorization check complete (success)
      sessionStorage.removeItem('isCheckingAuthorization');
      // Force reload to root so App.tsx re-runs onAuthStateChanged with the new user
      window.location.href = '/';

    } catch (err: any) {
      // Clear flag on any error
      sessionStorage.removeItem('isCheckingAuthorization');
      console.error("Sign Up Error:", err.code, err.message);

      const code = err.code || '';
      setErrorCode(code);

      if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (code === 'auth/weak-password') {
        setError('Password should be at least 6 characters long.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else {
        const cleanMessage = err.message.replace(/^Firebase: Error \(auth\//, '').replace(/\)\\.?$/, '').replace(/-/g, ' ');
        setError(cleanMessage.charAt(0).toUpperCase() + cleanMessage.slice(1) || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading screen while validating invitation token
  if (inviteToken && inviteTokenValid === null && loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8 text-center bg-gradient-to-br from-cyan-600 to-blue-700 text-white">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/30">
              <Loader2Icon className="w-8 h-8 text-white animate-spin" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Validating Invitation</h1>
            <p className="text-cyan-100 text-sm">Please wait while we verify your invitation link...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        {/* Separate RED Error Banner for Unauthorized Access */}
        {errorCode === 'auth/unauthorized' && (
          <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl shadow-2xl overflow-hidden border-4 border-red-400 animate-pulse">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <ShieldAlertIcon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                    🚫 Access Denied
                  </h3>
                  <p className="text-red-50 text-sm mb-4 leading-relaxed">
                    {error}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => window.location.href = '/?access=request'}
                      className="flex-1 py-2.5 bg-white text-red-700 rounded-lg font-bold text-sm hover:bg-red-50 transition-all shadow-lg"
                    >
                      Request Access
                    </button>
                    <button
                      onClick={onBackToLogin}
                      className="flex-1 py-2.5 bg-red-800 text-white border-2 border-white/30 rounded-lg font-bold text-sm hover:bg-red-900 transition-all"
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8 text-center bg-cyan-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 relative z-10">
            <StethoscopeIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-serif font-black mb-2 relative z-10">Apex Med Law</h1>
          <p className="text-cyan-200 text-sm relative z-10">Create Your Account</p>

          {inviteToken && inviteTokenValid && (
            <div className="mt-4 bg-emerald-500/20 border border-emerald-400/30 rounded-lg p-3 relative z-10">
              <p className="text-emerald-100 text-xs font-bold">✓ Valid Invitation - You're pre-approved!</p>
            </div>
          )}

          {inviteToken && inviteTokenValid === false && (
            <div className="mt-4 bg-red-500/20 border border-red-400/30 rounded-lg p-3 relative z-10">
              <p className="text-red-100 text-xs font-bold">✗ Invalid or Expired Invitation</p>
            </div>
          )}
        </div>

        <div className="p-8">
          {!inviteToken && (
            <div className="mb-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <ShieldAlertIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-blue-900 mb-1">💡 Have an Invitation Email?</p>
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    If you received an invitation email from your administrator, please click the link in that email instead. It will automatically fill in your details and verify your authorization.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
              <input
                type="text" required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 outline-none text-sm"
                value={name} 
                onChange={(e) => setName(e.target.value)}
                disabled={inviteToken && inviteTokenValid}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email" required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 outline-none text-sm"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={inviteToken && inviteTokenValid}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
              <div className="relative">
                <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password" required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 outline-none text-sm"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {errorCode === 'auth/email-already-in-use' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-2">
                <p className="text-xs text-amber-700 font-bold">This email is already registered.</p>
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="text-[10px] font-black uppercase tracking-widest text-amber-900 hover:underline text-left"
                >
                  Switch to Sign In →
                </button>
              </div>
            ) : error && (
              <p className="text-xs text-red-500 font-bold bg-red-50 border border-red-100 p-3 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 text-white rounded-xl font-bold hover:bg-cyan-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2Icon className="w-5 h-5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>Create New Account <ArrowRightIcon className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6">
            <button
              onClick={onBackToLogin}
              className="w-full text-xs font-bold text-slate-400 hover:text-cyan-600 transition-colors text-center"
            >
              Already have an account? Sign In
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;

