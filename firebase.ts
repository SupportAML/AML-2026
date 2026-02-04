// Firebase v9+ modular SDK
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Log successful initialization (helpful for debugging)
/*
console.log('✅ Firebase initialized successfully');
console.log('   Project ID:', firebaseConfig.projectId);
console.log('   Auth Domain:', firebaseConfig.authDomain);
console.log('   Storage Bucket:', firebaseConfig.storageBucket);
*/
