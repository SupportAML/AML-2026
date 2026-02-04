/**
 * Settings Service
 * Manages organization-wide settings stored in Firestore
 */

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const COLL_SETTINGS = 'settings';
const DOC_ORGANIZATION = 'organization';

export interface OrganizationSettings {
    // General
    organizationName: string;
    timezone: string;
    dateFormat: string;
    language: string;

    // Notifications
    emailNotifications: boolean;
    caseUpdates: boolean;
    documentUploads: boolean;
    teamInvites: boolean;
    weeklyDigest: boolean;

    // Security
    twoFactorAuth: boolean;
    sessionTimeout: number; // minutes
    passwordExpiry: number; // days

    // Integrations
    googleDriveEnabled: boolean;
    emailServiceEnabled: boolean;
    aiAssistantEnabled: boolean;

    // Metadata
    lastUpdatedBy?: string;
    lastUpdatedAt?: string;
}

// Default settings
export const DEFAULT_SETTINGS: OrganizationSettings = {
    // General
    organizationName: 'ApexMedLaw',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    language: 'en',

    // Notifications
    emailNotifications: true,
    caseUpdates: true,
    documentUploads: true,
    teamInvites: true,
    weeklyDigest: false,

    // Security
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordExpiry: 90,

    // Integrations
    googleDriveEnabled: true,
    emailServiceEnabled: true,
    aiAssistantEnabled: true
};

/**
 * Load organization settings from Firestore
 */
export const loadSettings = async (): Promise<OrganizationSettings> => {
    try {
        const docRef = doc(db, COLL_SETTINGS, DOC_ORGANIZATION);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log('✅ Settings loaded from Firestore');
            return { ...DEFAULT_SETTINGS, ...docSnap.data() } as OrganizationSettings;
        } else {
            console.log('📝 No settings found, using defaults');
            // Create default settings in Firestore
            await saveSettings(DEFAULT_SETTINGS);
            return DEFAULT_SETTINGS;
        }
    } catch (error) {
        console.error('❌ Error loading settings:', error);
        return DEFAULT_SETTINGS;
    }
};

/**
 * Save organization settings to Firestore
 */
export const saveSettings = async (
    settings: OrganizationSettings,
    updatedBy?: string
): Promise<void> => {
    try {
        const docRef = doc(db, COLL_SETTINGS, DOC_ORGANIZATION);
        const settingsWithMetadata = {
            ...settings,
            lastUpdatedBy: updatedBy || 'system',
            lastUpdatedAt: new Date().toISOString()
        };

        await setDoc(docRef, settingsWithMetadata);
        console.log('✅ Settings saved to Firestore');
    } catch (error) {
        console.error('❌ Error saving settings:', error);
        throw error;
    }
};

/**
 * Subscribe to settings changes in real-time
 */
export const subscribeToSettings = (
    callback: (settings: OrganizationSettings) => void
): (() => void) => {
    const docRef = doc(db, COLL_SETTINGS, DOC_ORGANIZATION);

    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const settings = { ...DEFAULT_SETTINGS, ...docSnap.data() } as OrganizationSettings;
            callback(settings);
        } else {
            callback(DEFAULT_SETTINGS);
        }
    }, (error) => {
        console.error('❌ Error in settings subscription:', error);
        callback(DEFAULT_SETTINGS);
    });
};

/**
 * Format date according to organization settings
 */
export const formatDate = (date: Date | string, settings: OrganizationSettings): string => {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) {
        return 'Invalid Date';
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    switch (settings.dateFormat) {
        case 'DD/MM/YYYY':
            return `${day}/${month}/${year}`;
        case 'YYYY-MM-DD':
            return `${year}-${month}-${day}`;
        case 'MM/DD/YYYY':
        default:
            return `${month}/${day}/${year}`;
    }
};

/**
 * Format date and time according to organization settings
 */
export const formatDateTime = (date: Date | string, settings: OrganizationSettings): string => {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) {
        return 'Invalid Date';
    }

    const dateStr = formatDate(d, settings);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${dateStr} ${hours}:${minutes}`;
};

/**
 * Check if a feature is enabled
 */
export const isFeatureEnabled = (
    feature: 'googleDrive' | 'emailService' | 'aiAssistant',
    settings: OrganizationSettings
): boolean => {
    switch (feature) {
        case 'googleDrive':
            return settings.googleDriveEnabled;
        case 'emailService':
            return settings.emailServiceEnabled;
        case 'aiAssistant':
            return settings.aiAssistantEnabled;
        default:
            return false;
    }
};

/**
 * Check if notifications are enabled for a specific type
 */
export const isNotificationEnabled = (
    type: 'email' | 'caseUpdates' | 'documentUploads' | 'teamInvites' | 'weeklyDigest',
    settings: OrganizationSettings
): boolean => {
    if (!settings.emailNotifications) {
        return false; // Master switch is off
    }

    switch (type) {
        case 'email':
            return settings.emailNotifications;
        case 'caseUpdates':
            return settings.caseUpdates;
        case 'documentUploads':
            return settings.documentUploads;
        case 'teamInvites':
            return settings.teamInvites;
        case 'weeklyDigest':
            return settings.weeklyDigest;
        default:
            return false;
    }
};
