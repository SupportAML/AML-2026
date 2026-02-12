/**
 * Authentication Service
 * Handles signup requests, invitation validation, and user authorization
 * Following enterprise best practices for invite-only systems
 */

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    updateDoc,
    deleteDoc,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { PendingSignupRequest, InvitationToken, AuthorizedUser, UserRole } from '../types';

const COLL_PENDING_REQUESTS = 'pendingSignupRequests';
const COLL_INVITATION_TOKENS = 'invitationTokens';
const COLL_AUTHORIZED_USERS = 'authorizedUsers';

/**
 * Check if a user is authorized (exists in authorizedUsers collection)
 */
export const isUserAuthorized = async (email: string): Promise<boolean> => {
    try {
        const cleanEmail = email.trim().toLowerCase();
        const usersRef = collection(db, COLL_AUTHORIZED_USERS);
        const q = query(usersRef, where('email', '==', cleanEmail));
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking user authorization:', error);
        return false;
    }
};

/**
 * Check if a user is an admin
 */
export const isUserAdmin = async (uid: string): Promise<boolean> => {
    try {
        const userDoc = await getDoc(doc(db, COLL_AUTHORIZED_USERS, uid));
        if (!userDoc.exists()) {
            return false;
        }
        const userData = userDoc.data();
        return userData.role === 'ADMIN';
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
};

/**
 * Create a signup request for non-invited users
 */
export const createSignupRequest = async (
    email: string,
    name: string,
    metadata?: { ipAddress?: string; userAgent?: string }
): Promise<{ success: boolean; requestId?: string; error?: string }> => {
    try {
        const cleanEmail = email.trim().toLowerCase();

        // Authorization check removed to allow unauthenticated 'blind writes'
        // Users cannot check if they are already authorized (privacy)

        /*
        // Check if user is already authorized
        const authorized = await isUserAuthorized(cleanEmail);
        if (authorized) {
            return { success: false, error: 'User is already authorized' };
        }
        */

        // Duplicate check removed to allow unauthenticated 'blind writes'
        // This prevents "Permission Denied" errors since users can create but not read

        /* 
        // Check if there's already a pending request
        const requestsRef = collection(db, COLL_PENDING_REQUESTS);
        const q = query(
            requestsRef,
            where('email', '==', cleanEmail),
            where('status', '==', 'pending')
        );
        const existingRequests = await getDocs(q);

        if (!existingRequests.empty) {
            return { success: false, error: 'A pending request already exists for this email' };
        }
        */

        // Create new request
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const request: PendingSignupRequest = {
            id: requestId,
            email: cleanEmail,
            name,
            requestedAt: new Date().toISOString(),
            status: 'pending',
            ipAddress: metadata?.ipAddress || null, // Fix: Firestore doesn't accept undefined
            userAgent: metadata?.userAgent || null  // Fix: Firestore doesn't accept undefined
        };

        await setDoc(doc(db, COLL_PENDING_REQUESTS, requestId), request);

        return { success: true, requestId };
    } catch (error: any) {
        console.error('Error creating signup request:', error);
        return { success: false, error: error.message || 'Failed to create signup request' };
    }
};

/**
 * Approve a signup request (admin only)
 */
export const approveSignupRequest = async (
    requestId: string,
    adminUid: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        // Get the request
        const requestDoc = await getDoc(doc(db, COLL_PENDING_REQUESTS, requestId));
        if (!requestDoc.exists()) {
            return { success: false, error: 'Request not found' };
        }

        const request = requestDoc.data() as PendingSignupRequest;

        // Create authorized user entry
        const userId = request.email.toLowerCase();
        const authorizedUser: AuthorizedUser = {
            id: userId,
            email: request.email,
            name: request.name,
            role: 'USER',
            status: 'active',
            addedAt: new Date().toISOString(),
            avatarColor: ['bg-cyan-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-rose-600', 'bg-amber-600'][
                Math.floor(Math.random() * 5)
            ]
        };

        await setDoc(doc(db, COLL_AUTHORIZED_USERS, userId), authorizedUser);

        // Update request status
        await updateDoc(doc(db, COLL_PENDING_REQUESTS, requestId), {
            status: 'approved',
            reviewedBy: adminUid,
            reviewedAt: new Date().toISOString()
        });

        return { success: true };
    } catch (error) {
        console.error('Error approving signup request:', error);
        return { success: false, error: 'Failed to approve request' };
    }
};

/**
 * Deny a signup request (admin only)
 */
export const denySignupRequest = async (
    requestId: string,
    adminUid: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const requestDoc = await getDoc(doc(db, COLL_PENDING_REQUESTS, requestId));
        if (!requestDoc.exists()) {
            return { success: false, error: 'Request not found' };
        }

        await updateDoc(doc(db, COLL_PENDING_REQUESTS, requestId), {
            status: 'denied',
            reviewedBy: adminUid,
            reviewedAt: new Date().toISOString(),
            denialReason: reason || 'No reason provided'
        });

        return { success: true };
    } catch (error) {
        console.error('Error denying signup request:', error);
        return { success: false, error: 'Failed to deny request' };
    }
};

/**
 * Get pending signup request for a specific email
 */
export const getPendingRequestByEmail = async (email: string): Promise<PendingSignupRequest | null> => {
    try {
        const cleanEmail = email.trim().toLowerCase();
        const requestsRef = collection(db, COLL_PENDING_REQUESTS);
        const q = query(
            requestsRef,
            where('email', '==', cleanEmail),
            where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as PendingSignupRequest;
    } catch (error) {
        console.error('Error getting pending request:', error);
        return null;
    }
};

/**
 * Delete a signup request
 */
export const deleteSignupRequest = async (requestId: string): Promise<boolean> => {
    try {
        await deleteDoc(doc(db, COLL_PENDING_REQUESTS, requestId));
        return true;
    } catch (error) {
        console.error('Error deleting signup request:', error);
        return false;
    }
};
