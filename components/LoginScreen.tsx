
import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { StethoscopeIcon, ArrowRightIcon, MailIcon, LockIcon, Loader2Icon, PlayCircleIcon, ShieldAlertIcon, CheckCircleIcon, ClockIcon } from 'lucide-react';
import { createSignupRequest, getPendingRequestByEmail } from '../services/authService';
import { sendSignupRequestNotification } from '../services/emailService';

interface LoginScreenProps {
  onDemoLogin: () => void;
  autoShowRequestAccess?: boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onDemoLogin, autoShowRequestAccess = false }) => {
  const [isRequestingAccess, setIsRequestingAccess] = useState(autoShowRequestAccess);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  // Check if email is whitelisted
  const isEmailAuthorized = async (email: string): Promise<boolean> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const usersRef = collection(db, 'authorizedUsers');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (err) {
      console.error('Error checking authorization:', err);
      return false;
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      console.log('🔍 Requesting access for:', cleanEmail, 'Name:', name);

      /*
      // Check if already authorized
      const authorized = await isEmailAuthorized(cleanEmail);
      console.log('✅ Authorization check:', authorized);

      if (authorized) {
        setError('This email is already authorized. Please use the login form.');
        setLoading(false);
        return;
      }

      // Check if already has pending request
      const pending = await getPendingRequestByEmail(cleanEmail);
      console.log('📋 Pending request check:', pending);

      if (pending) {
        setHasPendingRequest(true);
        setLoading(false);
        return;
      }
      */

      // Create signup request
      console.log('📝 Creating signup request...');
      const result = await createSignupRequest(cleanEmail, name, {
        userAgent: navigator.userAgent
      });
      console.log('📄 Signup request result:', result);

      if (result.success) {
        // Send notification to admin
        try {
          console.log('📧 Sending admin notification...');
          await sendSignupRequestNotification('support@apexmedlaw.com', name, cleanEmail);
          console.log('✅ Admin notification sent');
        } catch (emailError) {
          console.error('❌ Failed to send admin notification:', emailError);
          // Continue anyway - request is created
        }

        setRequestSubmitted(true);
      } else {
        console.error('❌ Signup request failed:', result.error);
        setError(result.error || 'Failed to submit access request');
      }
    } catch (error) {
      console.error('❌ Error requesting access:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const cleanEmail = email.trim();

      // Sign in
      const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCred.user;

      // Check if email is authorized
      const authorized = await isEmailAuthorized(cleanEmail);

      if (!authorized) {
        // Check if they have a pending request
        const pending = await getPendingRequestByEmail(cleanEmail);

        await auth.signOut();

        if (pending) {
          setError('Your access request is pending admin approval. You will be notified via email once approved.');
          setErrorCode('auth/pending-approval');
        } else {
          setError('Access denied. Your email is not authorized. Please request access or contact your administrator.');
          setErrorCode('auth/unauthorized-email');
        }

        setLoading(false);
        return;
      }

    } catch (err: any) {
      console.error("Auth Error:", err.code, err.message);

      // Clean up common Firebase error codes into user-friendly messages
      const code = err.code || '';
      setErrorCode(code);

      if (code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found') {
        setError('The email or password you entered is incorrect.');
      } else if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (code === 'auth/weak-password') {
        setError('Password should be at least 6 characters long.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        // Fallback: strip technical prefix if it exists
        const cleanMessage = err.message.replace(/^Firebase: Error \(auth\//, '').replace(/\)\\.?$/, '').replace(/-/g, ' ');
        setError(cleanMessage.charAt(0).toUpperCase() + cleanMessage.slice(1) || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Show request submitted success screen
  if (requestSubmitted || hasPendingRequest) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8 text-center bg-gradient-to-br from-cyan-600 to-blue-700 text-white">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/30">
              <ClockIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Request Submitted!</h1>
            <p className="text-cyan-100 text-sm">Your access request is being reviewed</p>
          </div>

          <div className="p-8">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
              <h3 className="font-bold text-blue-900 mb-2">What happens next?</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Our admin team has been notified</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>You'll receive an email once your request is reviewed</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>If approved, you can create your account and login</span>
                </li>
              </ul>
            </div>

            <p className="text-center text-sm text-slate-500 mb-4">
              Request for: <strong className="text-slate-700">{email}</strong>
            </p>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show request access form
  if (isRequestingAccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8 text-center bg-gradient-to-br from-amber-600 to-orange-700 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 relative z-10">
              <MailIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-serif font-black mb-2 relative z-10">Request Access</h1>
            <p className="text-amber-100 text-sm relative z-10">Submit a request to join ApexMedLaw</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleRequestAccess} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                <input
                  type="text" required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm"
                  value={name} onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                <div className="relative">
                  <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email" required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 font-bold bg-red-50 border border-red-100 p-3 rounded-xl">
                  {error}
                </p>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <>Submit Request <ArrowRightIcon className="w-4 h-4" /></>}
              </button>
            </form>

            <button
              onClick={() => {
                setIsRequestingAccess(false);
                setError(null);
              }}
              className="w-full mt-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all text-sm"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main login screen
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 text-center bg-cyan-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 relative z-10">
            <StethoscopeIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-serif font-black mb-2 relative z-10">Apex Med Law</h1>
          <p className="text-cyan-200 text-sm relative z-10">Secure Sign In</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email" required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 outline-none text-sm"
                  value={email} onChange={(e) => setEmail(e.target.value)}
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
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>


            {errorCode === 'auth/unauthorized-email' || errorCode === 'auth/pending-approval' ? (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                <ShieldAlertIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-700 font-bold mb-1">
                    {errorCode === 'auth/pending-approval' ? 'Request Pending' : 'Access Denied'}
                  </p>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
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
              {loading ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <>Secure Login <ArrowRightIcon className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={onDemoLogin}
              className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <PlayCircleIcon className="w-4 h-4 text-cyan-600" />
              Try Demo Access
            </button>

            <button
              onClick={() => window.location.href = '/?signup=true'}
              className="text-xs font-bold text-slate-400 hover:text-cyan-600 transition-colors text-center"
            >
              Have an invitation link? Create Account
            </button>

            <button
              onClick={() => setIsRequestingAccess(true)}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors text-center"
            >
              Don't have access? Request it here →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
