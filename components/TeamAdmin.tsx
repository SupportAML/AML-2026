
import React, { useState } from 'react';
import {
    UsersIcon,
    UserPlusIcon,
    Trash2Icon,
    MailIcon,
    ShieldCheckIcon,
    SearchIcon,
    FilterIcon,
    ActivityIcon,
    CopyIcon,
    CheckIcon,
    ExternalLinkIcon,
    XIcon
} from 'lucide-react';
import { AuthorizedUser, UserRole, UserProfile } from '../types';
import { sendInvitationEmail } from '../services/emailService';
import { createInvitationToken } from '../services/invitationService';
import { SignupRequestsPanel } from './SignupRequestsPanel';

interface TeamAdminProps {
    authorizedUsers: AuthorizedUser[];
    onInviteUser: (email: string, role: UserRole, name: string) => void;
    onDeleteUser: (id: string, action?: 'keep' | 'reassign' | 'delete', reassignToId?: string) => void | Promise<void>;
    currentUser: UserProfile;
}

export const TeamAdmin: React.FC<TeamAdminProps> = ({
    authorizedUsers, onInviteUser, onDeleteUser, currentUser
}) => {
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('USER');
    const [searchQuery, setSearchQuery] = useState('');
    const [lastInviteLink, setLastInviteLink] = useState('');
    const [copied, setCopied] = useState(false);

    const [isInviting, setIsInviting] = useState(false);
    const [inviteSuccess, setInviteSuccess] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [emailError, setEmailError] = useState('');

    // Delete user modal state
    const [deleteTarget, setDeleteTarget] = useState<AuthorizedUser | null>(null);
    const [deleteAction, setDeleteAction] = useState<'keep' | 'reassign' | 'delete'>('keep');
    const [reassignToId, setReassignToId] = useState<string>('');
    const [isDeleting, setIsDeleting] = useState(false);

    const closeInviteModal = () => {
        setInviteSuccess(false);
        setEmailError('');
        setEmailSent(false);
    };

    const handleInvite = async () => {
        if (!newUserEmail || !newUserName) {
            alert("Please provide both name and email.");
            return;
        }

        setIsInviting(true);
        setInviteSuccess(false);
        setEmailSent(false);
        setEmailError('');

        try {
            // 1. Create secure invitation token in database
            const tokenResult = await createInvitationToken(
                newUserEmail,
                newUserName,
                newUserRole,
                currentUser.id,
                currentUser.name
            );

            if (!tokenResult.success || !tokenResult.token) {
                throw new Error(tokenResult.error || 'Failed to create invitation token');
            }

            const inviteUrl = `${window.location.origin}?invite=${tokenResult.token.id}`;

            // 2. Also add to authorizedUsers with 'invited' status
            await onInviteUser(newUserEmail, newUserRole, newUserName);

            // 3. Send email via Brevo
            try {
                await sendInvitationEmail(newUserEmail, newUserName, inviteUrl, currentUser.name);
                setEmailSent(true);
            } catch (emailError) {
                console.error("❌ Email service error:", emailError);
                const errorMessage = emailError instanceof Error ? emailError.message : 'Unknown email error';
                setEmailError(errorMessage);
            }

            setLastInviteLink(inviteUrl);
            setInviteSuccess(true);
            setNewUserName('');
            setNewUserEmail('');

        } catch (error) {
            console.error("❌ Failed to create invitation:", error);
            alert("Failed to create invitation. Please try again.");
        } finally {
            setIsInviting(false);
        }
    };

    const copyInviteLink = () => {
        navigator.clipboard.writeText(lastInviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const filteredUsers = authorizedUsers.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest flex items-center gap-1">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> Sandbox
                        </span>
                    </div>
                    <h2 className="text-4xl font-serif font-bold text-slate-900">Firm Administration</h2>
                    <p className="text-slate-500 mt-2">Manage expert physician access and clinical review permissions.</p>
                </div>

                <div className="flex gap-4">
                    {/* Summary Stats */}
                    <div className="flex gap-6">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm w-48">
                            <div className="flex items-center gap-2 mb-2 text-slate-400">
                                <UsersIcon className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Total Staff</span>
                            </div>
                            <p className="text-3xl font-bold text-slate-800">{authorizedUsers.length}</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm w-48 text-emerald-600">
                            <div className="flex items-center gap-2 mb-2 text-emerald-400">
                                <ShieldCheckIcon className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Active Licenses</span>
                            </div>
                            <p className="text-3xl font-bold text-slate-800">{authorizedUsers.filter(u => u.status === 'active').length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Signup Requests Panel */}
            <div className="mb-8">
                <SignupRequestsPanel currentUserUid={currentUser.id} />
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-8">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search team members..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-500 transition-all"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <table className="w-full text-left">
                    <thead className="bg-slate-50/50">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User Details</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Security Role</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Status</th>
                            <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm ${user.avatarColor || 'bg-slate-400'}`}>
                                            {user.name ? user.name.charAt(0) : user.email.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{user.name || 'Pending Invitation'}</p>
                                            <p className="text-xs text-slate-400">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter ${user.role === 'ADMIN'
                                        ? 'bg-purple-50 text-purple-600 border-purple-100'
                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-400'}`} />
                                        <span className={`text-xs font-bold uppercase tracking-wider ${user.status === 'active' ? 'text-slate-600' : 'text-amber-600'}`}>
                                            {user.status}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {user.id !== currentUser.id && (
                                        <button
                                            onClick={() => { setDeleteTarget(user); setDeleteAction('keep'); setReassignToId(''); }}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2Icon className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Delete User Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full mx-4 relative">
                        <button onClick={() => setDeleteTarget(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                            <XIcon className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                                <Trash2Icon className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-slate-900">Remove {deleteTarget.name}</h4>
                                <p className="text-xs text-slate-500">{deleteTarget.email}</p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-600 mb-4">What should happen to this user's cases and data?</p>

                        <div className="space-y-2 mb-6">
                            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${deleteAction === 'keep' ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                <input type="radio" name="deleteAction" checked={deleteAction === 'keep'} onChange={() => setDeleteAction('keep')} className="mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Revoke access only</p>
                                    <p className="text-xs text-slate-500">Remove login access but keep all cases and data in place.</p>
                                </div>
                            </label>
                            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${deleteAction === 'reassign' ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                <input type="radio" name="deleteAction" checked={deleteAction === 'reassign'} onChange={() => setDeleteAction('reassign')} className="mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-800">Reassign cases to another user</p>
                                    <p className="text-xs text-slate-500 mb-2">Transfer ownership of all their cases to a team member.</p>
                                    {deleteAction === 'reassign' && (
                                        <select
                                            value={reassignToId}
                                            onChange={e => setReassignToId(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                                        >
                                            <option value="">Select team member...</option>
                                            {authorizedUsers
                                                .filter(u => u.id !== deleteTarget.id && u.id !== currentUser.id ? true : u.id === currentUser.id)
                                                .filter(u => u.id !== deleteTarget.id)
                                                .map(u => (
                                                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                                ))
                                            }
                                        </select>
                                    )}
                                </div>
                            </label>
                            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${deleteAction === 'delete' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                <input type="radio" name="deleteAction" checked={deleteAction === 'delete'} onChange={() => setDeleteAction('delete')} className="mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-red-700">Delete all their cases</p>
                                    <p className="text-xs text-red-500">Permanently remove all cases, documents, and annotations they own.</p>
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (deleteAction === 'reassign' && !reassignToId) {
                                        alert('Please select a team member to reassign cases to.');
                                        return;
                                    }
                                    setIsDeleting(true);
                                    try {
                                        await onDeleteUser(deleteTarget.id, deleteAction, reassignToId || undefined);
                                    } catch (e) {
                                        console.error('Error deleting user:', e);
                                    }
                                    setIsDeleting(false);
                                    setDeleteTarget(null);
                                }}
                                disabled={isDeleting}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                                {isDeleting ? 'Removing...' : 'Remove User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal Overlay - Fixed Position */}
            {inviteSuccess && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full mx-4 animate-in zoom-in slide-in-from-bottom-4 duration-300 relative">
                        <button
                            onClick={closeInviteModal}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className={`w-16 h-16 ${emailSent ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'} rounded-full flex items-center justify-center shadow-lg`}>
                                <CheckIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-slate-900 mb-2">
                                    {emailSent ? 'Invitation Sent!' : 'User Registered!'}
                                </h4>
                                <p className="text-sm text-slate-600 max-w-[320px]">
                                    {emailSent ? (
                                        'Our system has dispatched a secure access link to the expert\'s email.'
                                    ) : emailError ? (
                                        <>Email delivery failed: {emailError}</>
                                    ) : (
                                        'User added but email could not be sent. Use the link below.'
                                    )}
                                </p>
                                {!emailSent && (
                                    <p className="text-sm text-cyan-600 font-medium mt-3 flex items-center justify-center gap-2">
                                        <CheckIcon className="w-4 h-4" />
                                        User can still join using the invite link
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <button
                                    onClick={copyInviteLink}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg"
                                >
                                    {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                                    {copied ? 'Copied!' : 'Copy Link'}
                                </button>
                                <button
                                    onClick={() => {
                                        setInviteSuccess(false);
                                        setEmailError('');
                                        setEmailSent(false);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600 text-white rounded-xl text-sm font-bold hover:bg-cyan-700 transition-all shadow-lg"
                                >
                                    <UserPlusIcon className="w-4 h-4" />
                                    Invite Another
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Refined Invitation Section */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="flex-1">
                    <h3 className="text-xl font-serif font-bold text-slate-900 mb-1 flex items-center gap-2">
                        <UserPlusIcon className="w-5 h-5 text-cyan-600" />
                        Invite New Expert
                    </h3>
                    <p className="text-slate-500 text-sm">A secure invitation link will be sent to their email to join the platform.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <input
                        placeholder="Full Name"
                        disabled={isInviting}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-slate-700 min-w-[180px] transition-all"
                        value={newUserName}
                        onChange={e => setNewUserName(e.target.value)}
                    />
                    <input
                        placeholder="Expert Email"
                        type="email"
                        disabled={isInviting}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-slate-700 min-w-[220px] transition-all"
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                    />
                    <select
                        disabled={isInviting}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-slate-600 font-medium transition-all"
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value as UserRole)}
                    >
                        <option value="USER">Expert Physician</option>
                        <option value="ADMIN">Administrator</option>
                    </select>
                    <button
                        onClick={handleInvite}
                        disabled={isInviting}
                        className={`min-w-[120px] px-6 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isInviting
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-cyan-600 text-white hover:bg-cyan-700 shadow-lg shadow-cyan-100'
                            }`}
                    >
                        {isInviting ? (
                            <>
                                <ActivityIcon className="w-4 h-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <MailIcon className="w-4 h-4" />
                                Send Invite
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
