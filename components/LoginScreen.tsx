
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from '../firebase';
import { StethoscopeIcon, ArrowRightIcon, MailIcon, LockIcon, Loader2Icon, PlayCircleIcon } from 'lucide-react';

interface LoginScreenProps {
  onDemoLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onDemoLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const cleanEmail = email.trim();
      if (isRegistering) {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(userCred.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
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
        const cleanMessage = err.message.replace(/^Firebase: Error \(auth\//, '').replace(/\)\.?$/, '').replace(/-/g, ' ');
        setError(cleanMessage.charAt(0).toUpperCase() + cleanMessage.slice(1) || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 text-center bg-cyan-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 relative z-10">
            <StethoscopeIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-serif font-black mb-2 relative z-10">Apex Med Law</h1>
          <p className="text-cyan-200 text-sm relative z-10">Enterprise Clinical Case Management</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                <input
                  type="text" required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 outline-none text-sm"
                  value={name} onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
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

            {errorCode === 'auth/email-already-in-use' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-2">
                <p className="text-xs text-amber-700 font-bold">This email is already registered.</p>
                <button
                  type="button"
                  onClick={() => { setIsRegistering(false); setError(null); }}
                  className="text-[10px] font-black uppercase tracking-widest text-amber-900 hover:underline text-left"
                >
                  Switch to Login Mode →
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
              {loading ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <>{isRegistering ? 'Create New Account' : 'Secure Login'} <ArrowRightIcon className="w-4 h-4" /></>}
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
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
              }}
              className="text-xs font-bold text-slate-400 hover:text-cyan-600 transition-colors text-center"
            >
              {isRegistering ? "Already have an account? Sign In" : "Need clinical access? Register here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
