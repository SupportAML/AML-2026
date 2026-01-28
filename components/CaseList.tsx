
import React, { useState, useEffect } from 'react';
import { PlusIcon, ClockIcon, UsersIcon, FileIcon, SearchIcon, FilterIcon, CalendarIcon, Trash2Icon, PencilIcon, SaveIcon, XIcon } from 'lucide-react';
import { Case, UserProfile } from '../types';

interface CaseListProps {
    cases: Case[];
    onSelect: (c: Case) => void;
    onCreate: () => void;
    currentUser: UserProfile;
    onDeleteCase: (id: string) => void;
    onUpdateCase: (c: Case) => void;
}

type CaseStatus = 'planning' | 'active' | 'on_hold' | 'cancelled' | 'archived';

const STATUS_LABELS: Record<CaseStatus, string> = {
    planning: 'Planning',
    active: 'Active',
    on_hold: 'On Hold',
    cancelled: 'Cancelled',
    archived: 'Archived'
};

const STATUS_COLORS: Record<CaseStatus, string> = {
    planning: 'bg-indigo-100 text-indigo-700',
    active: 'bg-emerald-100 text-emerald-700',
    on_hold: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
    archived: 'bg-slate-100 text-slate-700'
};

const CaseList: React.FC<CaseListProps> = ({ cases, onSelect, onCreate, currentUser, onDeleteCase, onUpdateCase }) => {
    const [activeTab, setActiveTab] = useState<CaseStatus>(() => {
        return (localStorage.getItem('apex_dashboard_tab') as CaseStatus) || 'active';
    });

    const [searchTerm, setSearchTerm] = useState('');

    // Inline Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Case>>({});

    useEffect(() => {
        localStorage.setItem('apex_dashboard_tab', activeTab);
    }, [activeTab]);

    // Handle Legacy Statuses from Mock Data if any
    const normalizedCases = cases.map(c => ({
        ...c,
        status: (['planning', 'active', 'on_hold', 'cancelled', 'archived'].includes(c.status) ? c.status : 'active') as CaseStatus
    }));

    // Calculate Counts
    const counts = normalizedCases.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
    }, {} as Record<CaseStatus, number>);

    const filteredCases = normalizedCases.filter(c => {
        const matchesTab = c.status === activeTab;
        const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.primaryLawyer || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesTab && matchesSearch;
    });

    const handleDelete = (e: React.MouseEvent, c: Case) => {
        e.stopPropagation();
        onDeleteCase(c.id);
    };

    const startEditing = (e: React.MouseEvent, c: Case) => {
        e.stopPropagation();
        setEditingId(c.id);
        setEditForm({ ...c });
    };

    const cancelEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(null);
        setEditForm({});
    };

    const saveEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editingId && editForm) {
            // Find original case to merge
            const original = cases.find(c => c.id === editingId);
            if (original) {
                const updated = { ...original, ...editForm } as Case;
                // Handle Client Name update simply here if editing form allows it
                // For deeper client editing, we rely on the CaseDetails page, but we can update the client array's 0th element name
                if (editForm.clients && editForm.clients.length > 0 && original.clients.length > 0) {
                    // Simplified logic: assume we are just updating the title/desc/lawyer/status mostly
                }
                onUpdateCase(updated);
            }
        }
        setEditingId(null);
        setEditForm({});
    };

    // Helper to update client name in local form state (mocking single client update)
    const updateClientName = (name: string) => {
        if (!editForm.clients || editForm.clients.length === 0) {
            setEditForm({ ...editForm, clients: [{ id: 'new', name, email: '', phone: '', role: 'Plaintiff' }] });
        } else {
            const updatedClients = [...editForm.clients];
            updatedClients[0] = { ...updatedClients[0], name };
            setEditForm({ ...editForm, clients: updatedClients });
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
            <div className="flex items-center justify-between mb-8 shrink-0">
                <div>
                    <h2 className="text-3xl font-serif font-black text-slate-900">Cases Dashboard</h2>
                    <p className="text-slate-500 mt-1">Track case progress, manage medical opinions, and coordinate with counsel.</p>
                </div>
                <button
                    onClick={onCreate}
                    className="flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-100 font-semibold"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>New Legal Case</span>
                </button>
            </div>

            <div className="flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 min-h-0">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex gap-2 bg-slate-200/50 p-1 rounded-lg overflow-x-auto">
                        {(Object.keys(STATUS_LABELS) as CaseStatus[]).map(status => (
                            <button
                                key={status}
                                onClick={() => setActiveTab(status)}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeTab === status
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {STATUS_LABELS[status]} ({counts[status] || 0})
                            </button>
                        ))}
                    </div>

                    <div className="relative w-64 ml-4">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all"
                            placeholder="Search cases..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
                    <div className="col-span-4">Case Details</div>
                    <div className="col-span-2">Client</div>
                    <div className="col-span-2">Primary Lawyer</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                {/* Table Body */}
                <div className="overflow-y-auto flex-1">
                    {filteredCases.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <FilterIcon className="w-12 h-12 mb-2 opacity-20" />
                            <p>No cases found in {STATUS_LABELS[activeTab]}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredCases.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => editingId !== c.id && onSelect(c)}
                                    className={`grid grid-cols-12 gap-4 px-6 py-4 transition-colors cursor-pointer group items-center ${editingId === c.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="col-span-4">
                                        {editingId === c.id ? (
                                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                <input
                                                    className="w-full text-sm font-bold border rounded p-1"
                                                    value={editForm.title || ''}
                                                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                                />
                                                <input
                                                    className="w-full text-xs border rounded p-1"
                                                    value={editForm.description || ''}
                                                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-cyan-600 transition-colors truncate">{c.title}</h3>
                                                <p className="text-xs text-slate-500 line-clamp-1">{c.description}</p>
                                            </>
                                        )}
                                    </div>
                                    <div className="col-span-2">
                                        {editingId === c.id ? (
                                            <input
                                                className="w-full text-sm border rounded p-1"
                                                value={editForm.clients?.[0]?.name || ''}
                                                onChange={e => updateClientName(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                placeholder="Client Name"
                                            />
                                        ) : (
                                            (c.clients && c.clients.length > 0) ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                        {c.clients[0].name.charAt(0)}
                                                    </div>
                                                    <span className="text-sm text-slate-700 truncate">{c.clients[0].name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">No Client</span>
                                            )
                                        )}
                                    </div>
                                    <div className="col-span-2">
                                        {editingId === c.id ? (
                                            <input
                                                className="w-full text-sm border rounded p-1"
                                                value={editForm.primaryLawyer || ''}
                                                onChange={e => setEditForm({ ...editForm, primaryLawyer: e.target.value })}
                                                onClick={e => e.stopPropagation()}
                                                placeholder="Lawyer Name"
                                            />
                                        ) : (
                                            c.primaryLawyer ? (
                                                <div className="flex items-center gap-2 text-sm text-slate-700">
                                                    <UsersIcon className="w-3 h-3 text-slate-400" />
                                                    <span className="truncate">{c.primaryLawyer}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Unassigned</span>
                                            )
                                        )}
                                    </div>
                                    <div className="col-span-2">
                                        {editingId === c.id ? (
                                            <select
                                                className="w-full text-xs border rounded p-1"
                                                value={editForm.status}
                                                onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                {Object.keys(STATUS_LABELS).map(k => (
                                                    <option key={k} value={k}>{STATUS_LABELS[k as CaseStatus]}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                                                {STATUS_LABELS[c.status]}
                                            </span>
                                        )}
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        {editingId === c.id ? (
                                            <>
                                                <button onClick={saveEditing} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"><SaveIcon className="w-4 h-4" /></button>
                                                <button onClick={cancelEditing} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded"><XIcon className="w-4 h-4" /></button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-xs text-slate-500 font-mono mr-2">{c.createdAt}</span>
                                                <button
                                                    onClick={(e) => startEditing(e, c)}
                                                    className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Edit Case"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                {(currentUser.role === 'ADMIN' || c.ownerId === currentUser.id) && (
                                                    <button
                                                        onClick={(e) => handleDelete(e, c)}
                                                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Delete Case"
                                                    >
                                                        <Trash2Icon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 border-t border-slate-200 p-3 text-xs text-slate-400 text-center">
                    Showing {filteredCases.length} case{filteredCases.length !== 1 && 's'}
                </div>
            </div>
        </div>
    );
};

export default CaseList;
