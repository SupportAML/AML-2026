import React, { useState, useEffect } from 'react';
import {
    SettingsIcon,
    BellIcon,
    ShieldIcon,
    DatabaseIcon,
    PaletteIcon,
    GlobeIcon,
    MailIcon,
    KeyIcon,
    SaveIcon,
    CheckCircle2Icon,
    AlertCircleIcon,
    Loader2Icon
} from 'lucide-react';
import {
    loadSettings,
    saveSettings,
    OrganizationSettings,
    DEFAULT_SETTINGS
} from '../services/settingsService';

interface SettingsProps {
    currentUser: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
}

export const Settings: React.FC<SettingsProps> = ({ currentUser }) => {
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'security' | 'integrations'>('general');

    // Settings state
    const [settings, setSettings] = useState<OrganizationSettings>(DEFAULT_SETTINGS);

    // Load settings on mount
    useEffect(() => {
        const loadInitialSettings = async () => {
            try {
                setLoading(true);
                const loadedSettings = await loadSettings();
                setSettings(loadedSettings);
                console.log('📋 Settings loaded:', loadedSettings);
            } catch (err) {
                console.error('Error loading settings:', err);
                setError('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };

        loadInitialSettings();
    }, []);

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);

            await saveSettings(settings, currentUser.email);

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            console.log('✅ Settings saved successfully');
        } catch (err) {
            console.error('Error saving settings:', err);
            setError('Failed to save settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const SettingSection = ({ icon: Icon, title, children }: any) => (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-cyan-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            </div>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );

    const SettingRow = ({ label, description, children }: any) => (
        <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
            <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">{label}</p>
                {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
            </div>
            <div className="ml-4">
                {children}
            </div>
        </div>
    );

    const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
        <button
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-cyan-600' : 'bg-slate-300'
                }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
                    }`}
            />
        </button>
    );

    const tabs = [
        { id: 'general', label: 'General', icon: SettingsIcon },
        { id: 'notifications', label: 'Notifications', icon: BellIcon },
        { id: 'security', label: 'Security', icon: ShieldIcon },
        { id: 'integrations', label: 'Integrations', icon: DatabaseIcon }
    ];

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2Icon className="w-10 h-10 text-cyan-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-slate-50">
            <div className="max-w-5xl mx-auto p-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-purple-50 text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-100 uppercase tracking-widest">
                            Admin Only
                        </span>
                    </div>
                    <h1 className="text-4xl font-serif font-bold text-slate-900 mb-2">Platform Settings</h1>
                    <p className="text-slate-600">Manage your organization's configuration and preferences.</p>
                    {error && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                            <AlertCircleIcon className="w-4 h-4 text-red-600" />
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-200">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === tab.id
                                ? 'border-cyan-600 text-cyan-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* General Settings */}
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <SettingSection icon={GlobeIcon} title="Organization">
                            <SettingRow label="Organization Name" description="The name of your law firm or organization">
                                <input
                                    type="text"
                                    value={settings.organizationName}
                                    onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })}
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-64"
                                />
                            </SettingRow>
                            <SettingRow label="Timezone" description="Default timezone for all users">
                                <select
                                    value={settings.timezone}
                                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-64"
                                >
                                    <option value="America/New_York">Eastern Time (ET)</option>
                                    <option value="America/Chicago">Central Time (CT)</option>
                                    <option value="America/Denver">Mountain Time (MT)</option>
                                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                                </select>
                            </SettingRow>
                            <SettingRow label="Date Format" description="How dates are displayed throughout the platform">
                                <select
                                    value={settings.dateFormat}
                                    onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-64"
                                >
                                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                </select>
                            </SettingRow>
                        </SettingSection>

                        <SettingSection icon={PaletteIcon} title="Appearance">
                            <SettingRow label="Language" description="Platform display language">
                                <select
                                    value={settings.language}
                                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-64"
                                >
                                    <option value="en">English</option>
                                    <option value="es">Spanish</option>
                                    <option value="fr">French</option>
                                </select>
                            </SettingRow>
                        </SettingSection>
                    </div>
                )}

                {/* Notifications */}
                {activeTab === 'notifications' && (
                    <div className="space-y-6">
                        <SettingSection icon={BellIcon} title="Email Notifications">
                            <SettingRow label="Email Notifications" description="Receive email notifications for platform activities">
                                <Toggle
                                    checked={settings.emailNotifications}
                                    onChange={() => setSettings({ ...settings, emailNotifications: !settings.emailNotifications })}
                                />
                            </SettingRow>
                            <SettingRow label="Case Updates" description="Get notified when cases are updated">
                                <Toggle
                                    checked={settings.caseUpdates}
                                    onChange={() => setSettings({ ...settings, caseUpdates: !settings.caseUpdates })}
                                />
                            </SettingRow>
                            <SettingRow label="Document Uploads" description="Get notified when new documents are uploaded">
                                <Toggle
                                    checked={settings.documentUploads}
                                    onChange={() => setSettings({ ...settings, documentUploads: !settings.documentUploads })}
                                />
                            </SettingRow>
                            <SettingRow label="Team Invites" description="Get notified when new team members are invited">
                                <Toggle
                                    checked={settings.teamInvites}
                                    onChange={() => setSettings({ ...settings, teamInvites: !settings.teamInvites })}
                                />
                            </SettingRow>
                            <SettingRow label="Weekly Digest" description="Receive a weekly summary of platform activity">
                                <Toggle
                                    checked={settings.weeklyDigest}
                                    onChange={() => setSettings({ ...settings, weeklyDigest: !settings.weeklyDigest })}
                                />
                            </SettingRow>
                        </SettingSection>
                    </div>
                )}

                {/* Security */}
                {activeTab === 'security' && (
                    <div className="space-y-6">
                        <SettingSection icon={ShieldIcon} title="Authentication & Security">
                            <SettingRow label="Two-Factor Authentication" description="Require 2FA for all admin users">
                                <Toggle
                                    checked={settings.twoFactorAuth}
                                    onChange={() => setSettings({ ...settings, twoFactorAuth: !settings.twoFactorAuth })}
                                />
                            </SettingRow>
                            <SettingRow label="Session Timeout" description="Automatically log out users after inactivity (minutes)">
                                <input
                                    type="number"
                                    value={settings.sessionTimeout}
                                    onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 30 })}
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-32"
                                    min="5"
                                    max="120"
                                />
                            </SettingRow>
                            <SettingRow label="Password Expiry" description="Force password change after this many days">
                                <input
                                    type="number"
                                    value={settings.passwordExpiry}
                                    onChange={(e) => setSettings({ ...settings, passwordExpiry: parseInt(e.target.value) || 90 })}
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-32"
                                    min="30"
                                    max="365"
                                />
                            </SettingRow>
                        </SettingSection>

                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                            <div className="flex gap-3">
                                <AlertCircleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-amber-900 mb-1">Security Notice</h4>
                                    <p className="text-sm text-amber-800">
                                        Changing security settings will affect all users. Make sure to communicate any changes to your team.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Integrations */}
                {activeTab === 'integrations' && (
                    <div className="space-y-6">
                        <SettingSection icon={DatabaseIcon} title="Third-Party Services">
                            <SettingRow label="Google Drive Integration" description="Enable Google Drive for document storage">
                                <Toggle
                                    checked={settings.googleDriveEnabled}
                                    onChange={() => setSettings({ ...settings, googleDriveEnabled: !settings.googleDriveEnabled })}
                                />
                            </SettingRow>
                            <SettingRow label="Email Service (Brevo)" description="Enable automated email invitations">
                                <Toggle
                                    checked={settings.emailServiceEnabled}
                                    onChange={() => setSettings({ ...settings, emailServiceEnabled: !settings.emailServiceEnabled })}
                                />
                            </SettingRow>
                            <SettingRow label="AI Assistant (Gemini)" description="Enable AI-powered features and insights">
                                <Toggle
                                    checked={settings.aiAssistantEnabled}
                                    onChange={() => setSettings({ ...settings, aiAssistantEnabled: !settings.aiAssistantEnabled })}
                                />
                            </SettingRow>
                        </SettingSection>

                        <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-6">
                            <div className="flex gap-3">
                                <KeyIcon className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-cyan-900 mb-1">API Keys</h4>
                                    <p className="text-sm text-cyan-800 mb-3">
                                        API keys are configured in your environment variables (.env file). Contact your system administrator to update them.
                                    </p>
                                    <div className="flex gap-2 text-xs">
                                        <span className="px-2 py-1 bg-white rounded border border-cyan-200 text-cyan-700 font-mono">
                                            VITE_GEMINI_API_KEY
                                        </span>
                                        <span className="px-2 py-1 bg-white rounded border border-cyan-200 text-cyan-700 font-mono">
                                            VITE_BREVO_API_KEY
                                        </span>
                                        <span className="px-2 py-1 bg-white rounded border border-cyan-200 text-cyan-700 font-mono">
                                            VITE_GOOGLE_DRIVE_API_KEY
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Save Button */}
                <div className="sticky bottom-0 bg-slate-50 pt-6 pb-2 mt-8 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-600">
                            Changes will be applied to all users immediately.
                        </p>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white rounded-xl font-bold hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <Loader2Icon className="w-5 h-5 animate-spin" />
                                    Saving...
                                </>
                            ) : saved ? (
                                <>
                                    <CheckCircle2Icon className="w-5 h-5" />
                                    Saved!
                                </>
                            ) : (
                                <>
                                    <SaveIcon className="w-5 h-5" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
