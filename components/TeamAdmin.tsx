
import React, { useState } from 'react';
import {
    UsersIcon,
    UserPlusIcon,
    Trash2Icon,
    MailIcon,
    ShieldCheckIcon,
    SearchIcon,
    FilterIcon,
    ActivityIcon
} from 'lucide-react';
import { AuthorizedUser, UserRole, UserProfile } from '../types';

interface TeamAdminProps {
    authorizedUsers: AuthorizedUser[];
    onInviteUser: (email: string, role: UserRole, name: string) => void;
    onDeleteUser: (id: string) => void;
    currentUser: UserProfile;
}

export const TeamAdmin: React.FC<TeamAdminProps> = ({
    authorizedUsers, onInviteUser, onDeleteUser, currentUser
}) => {
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('USER');
    const [searchQuery, setSearchQuery] = useState('');

    const handleInvite = () => {
        if (!newUserEmail) return;
        onInviteUser(newUserEmail, newUserRole, newUserName);
        setNewUserName('');
        setNewUserEmail('');
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
                    <div className="flex gap-6 mr-8">
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

                    <button
                        onClick={() => {/* Toggle modal or inline form */ }}
                        className="bg-cyan-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-cyan-100 hover:bg-cyan-700 transition-all self-end"
                    >
                        <UserPlusIcon className="w-5 h-5" />
                        Invite Clinician
                    </button>
                </div>
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
                                            onClick={() => onDeleteUser(user.id)}
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

            {/* Quick Invite Form (could be a modal) */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex items-center justify-between text-white shadow-2xl">
                <div>
                    <h3 className="text-xl font-serif font-bold mb-1">Invite New Expert</h3>
                    <p className="text-slate-400 text-sm">Send a clinical access invitation to a new physician expert.</p>
                </div>
                <div className="flex gap-3">
                    <input
                        placeholder="Expert Email"
                        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-cyan-500 text-white min-w-[250px]"
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                    />
                    <select
                        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-cyan-500 text-slate-300"
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value as UserRole)}
                    >
                        <option value="USER">Expert Physician</option>
                        <option value="ADMIN">Team Administrator</option>
                    </select>
                    <button
                        onClick={handleInvite}
                        className="bg-cyan-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-cyan-400 shadow-lg shadow-cyan-900/20 transition-all"
                    >
                        Invite
                    </button>
                </div>
            </div>
        </div>
    );
};
