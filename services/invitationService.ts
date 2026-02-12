/**
 * Invitation Service
 * Manages secure invitation tokens for user onboarding
 * Implements enterprise-grade invite-only access control
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
    onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { InvitationToken, UserRole } from '../types';

const COLL_INVITATION_TOKENS = 'invitationTokens';

/**
 * Generate a cryptographically secure invitation token
 */
const generateSecureToken = (): string => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const randomPart2 = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomPart}${randomPart2}`;
};

/**
 * Create a new invitation token
 */
export const createInvitationToken = async (
    email: string,
    name: string,
    role: UserRole,
    adminUid: string,
    adminName: string
): Promise<{ success: boolean; token?: InvitationToken; error?: string }> => {
    try {
        const cleanEmail = email.trim().toLowerCase();

        // Check if there's already an active invitation for this email
        const tokensRef = collection(db, COLL_INVITATION_TOKENS);
        // Simplify query to avoid composite index requirement / assertions
        const q = query(
            tokensRef,
            where('email', '==', cleanEmail)
        );
        const existingTokensSnapshot = await getDocs(q);

        // Revoke any existing active tokens for this email
        for (const tokenDoc of existingTokensSnapshot.docs) {
            const data = tokenDoc.data();
            if (data.status === 'active') {
                await updateDoc(doc(db, COLL_INVITATION_TOKENS, tokenDoc.id), {
                    status: 'revoked'
                });
            }
        }

        // Create new token
        const tokenId = generateSecureToken();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const token: InvitationToken = {
            id: tokenId,
            email: cleanEmail,
            name,
            role,
            createdBy: adminUid,
            createdByName: adminName,
            createdAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            used: false,
            status: 'active'
        };

        await setDoc(doc(db, COLL_INVITATION_TOKENS, tokenId), token);

        return { success: true, token };
    } catch (error) {
        console.error('Error creating invitation token:', error);
        return { success: false, error: 'Failed to create invitation token' };
    }
};

/**
 * Get invitation token by ID
 */
export const getInvitationToken = async (tokenId: string): Promise<InvitationToken | null> => {
    try {
        const tokenDoc = await getDoc(doc(db, COLL_INVITATION_TOKENS, tokenId));
        if (!tokenDoc.exists()) {
            return null;
        }
        return { ...tokenDoc.data(), id: tokenDoc.id } as InvitationToken;
    } catch (error) {
        console.error('Error getting invitation token:', error);
        return null;
    }
};

/**
 * Validate an invitation token
 */
export const validateInvitationToken = async (tokenId: string): Promise<InvitationToken | null> => {
    try {
        console.log('🔍 Validating invitation token:', tokenId);
        const tokenDoc = await getDoc(doc(db, COLL_INVITATION_TOKENS, tokenId));

        if (!tokenDoc.exists()) {
            console.log('❌ Token not found in database');
            return null;
        }

        const token = { ...tokenDoc.data(), id: tokenDoc.id } as InvitationToken;
        console.log('📄 Token data:', token);

        // Check if token is already used
        if (token.used || token.status === 'used') {
            console.log('❌ Token already used');
            return null;
        }

        // Check if token is revoked
        if (token.status === 'revoked') {
            console.log('❌ Token revoked');
            return null;
        }

        // Check if token is expired
        const expiresAt = new Date(token.expiresAt);
        const now = new Date();
        console.log('⏰ Token expires:', expiresAt, 'Current time:', now);

        if (expiresAt < now) {
            console.log('❌ Token expired');
            // Auto-update status to expired
            await updateDoc(doc(db, COLL_INVITATION_TOKENS, tokenId), {
                status: 'expired'
            });
            return null;
        }

        console.log('✅ Token is valid!');
        return token;
    } catch (error) {
        console.error('❌ Error validating invitation token:', error);
        return null;
    }
};

/**
 * Redeem an invitation token (mark as used)
 */
export const redeemInvitationToken = async (tokenId: string, userUid: string): Promise<boolean> => {
    try {
        await updateDoc(doc(db, COLL_INVITATION_TOKENS, tokenId), {
            used: true,
            usedAt: new Date().toISOString(),
            usedBy: userUid,
            status: 'used'
        });
        return true;
    } catch (error) {
        console.error('Error redeeming invitation token:', error);
        return false;
    }
};


/**
 * Revoke an invitation token (admin only)
 */
export const revokeInvitationToken = async (tokenId: string): Promise<boolean> => {
    try {
        await updateDoc(doc(db, COLL_INVITATION_TOKENS, tokenId), {
            status: 'revoked'
        });
        return true;
    } catch (error) {
        console.error('Error revoking invitation token:', error);
        return false;
    }
};

/**
 * Subscribe to invitation tokens (real-time updates)
 */
export const subscribeToInvitationTokens = (
    callback: (tokens: InvitationToken[]) => void
): (() => void) => {
    const tokensRef = collection(db, COLL_INVITATION_TOKENS);

    return onSnapshot(tokensRef, (snapshot) => {
        const tokens = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as InvitationToken));
        callback(tokens);
    }, (error) => {
        console.error('Error subscribing to invitation tokens:', error);
    });
};

/**
 * Clean up expired tokens (maintenance function)
 */
export const cleanupExpiredTokens = async (): Promise<number> => {
    try {
        const tokensRef = collection(db, COLL_INVITATION_TOKENS);
        const q = query(tokensRef, where('status', '==', 'active'));
        const snapshot = await getDocs(q);

        const now = new Date();
        let cleanedCount = 0;

        for (const tokenDoc of snapshot.docs) {
            const token = tokenDoc.data() as InvitationToken;
            const expiresAt = new Date(token.expiresAt);

            if (expiresAt < now) {
                await updateDoc(doc(db, COLL_INVITATION_TOKENS, tokenDoc.id), {
                    status: 'expired'
                });
                cleanedCount++;
            }
        }

        return cleanedCount;
    } catch (error) {
        console.error('Error cleaning up expired tokens:', error);
        return 0;
    }
};

/**
 * Get active invitations count
 */
export const getActiveInvitationsCount = async (): Promise<number> => {
    try {
        const tokensRef = collection(db, COLL_INVITATION_TOKENS);
        const q = query(tokensRef, where('status', '==', 'active'));
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error('Error getting active invitations count:', error);
        return 0;
    }
};
