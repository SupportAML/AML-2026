// Firebase v9+ modular SDK
import { initializeApp, getApps } from 'firebase/app';
import { 
    getFirestore,
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Load configuration from environment variables for security
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validate that all required Firebase config values are present
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('❌ Firebase configuration is missing!');
    console.error('Please check your .env.local file and ensure all VITE_FIREBASE_* variables are set.');
    console.error('Required variables:');
    console.error('  - VITE_FIREBASE_API_KEY');
    console.error('  - VITE_FIREBASE_AUTH_DOMAIN');
    console.error('  - VITE_FIREBASE_PROJECT_ID');
    console.error('  - VITE_FIREBASE_STORAGE_BUCKET');
    console.error('  - VITE_FIREBASE_MESSAGING_SENDER_ID');
    console.error('  - VITE_FIREBASE_APP_ID');
    throw new Error('Firebase configuration is incomplete. Check .env.local file.');
}

// Initialize Firebase (singleton pattern for HMR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with modern persistent cache (supports multiple tabs)
// Use try-catch to handle HMR (Hot Module Reload) gracefully
let db;
try {
    // Try to initialize with persistent cache
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        })
    });
    console.log('✅ Firebase initialized with offline persistence');
} catch (error: any) {
    // If already initialized (during HMR), just get the existing instance
    if (error.code === 'failed-precondition' || error.message?.includes('already been called')) {
        console.log('🔄 Using existing Firebase instance (HMR)');
        db = getFirestore(app);
    } else {
        console.error('❌ Firebase initialization error:', error);
        throw error;
    }
}

export { db };

// Initialize other Firebase services
export const auth = getAuth(app);
export const storage = getStorage(app);

// Log successful initialization
console.log('✅ Firebase ready');
console.log('   Project ID:', firebaseConfig.projectId);
 