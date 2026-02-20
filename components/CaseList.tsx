
import React, { useState, useEffect, useRef } from 'react';
import { PlusIcon, UsersIcon, SearchIcon, FilterIcon, Trash2Icon, PencilIcon, SlidersHorizontalIcon, UserIcon } from 'lucide-react';
import { Case, UserProfile, AuthorizedUser } from '../types';

interface CaseListProps {
    cases: Case[];
    onSelect: (c: Case) => void;
    onCreate: () => void;
    onEdit: (c: Case) => void;
    currentUser: UserProfile;
    onDeleteCase: (id: string) => void;
    onUpdateCase: (c: Case) => void;
    authorizedUsers?: AuthorizedUser[];
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

/** Format ISO or date string to MM/DD/YYYY for display (US) */
const formatDate = (val: string | undefined): string => {
    if (!val) return '—';
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch {
        try {
            return new Date(val).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        } catch {
            return '—';
        }
    }
};

/** Derive last activity date - uses auto-updated lastActivityAt field, falls back to heuristics */
const getLastActivityDate = (c: Case): string => {
    // Primary: use the auto-stamped field (updated on every case/doc/annotation change)
    if (c.lastActivityAt) return formatDate(c.lastActivityAt);
    // Fallback: derive from embedded data
    const dates: number[] = [];
    const add = (s: string | undefined) => {
        if (!s) return;
        const t = new Date(s).getTime();
        if (!isNaN(t)) dates.push(t);
    };
    add(c.createdAt);
    (c.exportHistory || []).forEach(e => add(e.date));
    (c.draftVersions || []).forEach(d => add(d.date));
    const walk = (comments: { timestamp: number; replies?: unknown[] }[]) => {
        comments.forEach(cc => {
            dates.push(cc.timestamp);
            if (cc.replies?.length) walk(cc.replies as { timestamp: number; replies?: unknown[] }[]);
        });
    };
    walk(c.reportComments || []);
    if (dates.length === 0) return formatDate(c.createdAt);
    return formatDate(new Date(Math.max(...dates)).toISOString());
};

const CaseList: React.FC<CaseListProps> = ({ cases, onSelect, onCreate, onEdit, currentUser, onDeleteCase, onUpdateCase, authorizedUsers = [] }) => {
    const isAdmin = currentUser.role === 'ADMIN';

    const [activeTab, setActiveTab] = useState<CaseStatus>(() => {
        return (localStorage.getItem('apex_dashboard_tab') as CaseStatus) || 'active';
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filterAttorney, setFilterAttorney] = useState('');
    const [filterPhysician, setFilterPhysician] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterOwner, setFilterOwner] = useState('');
    // Admin view mode: 'mine' = default (only owned/shared), 'all' = override to see everything
    const [adminViewMode, setAdminViewMode] = useState<'mine' | 'all'>('mine');
    const filterRef = useRef<HTMLDivElement>(null);

    const hasActiveFilters = !!(filterAttorney || filterPhysician || filterDateFrom || filterDateTo || filterOwner);

    const clearFilters = () => {
        setFilterAttorney('');
        setFilterPhysician('');
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterOwner('');
    };

    // Collect unique attorneys and assigned physicians from cases
    const uniqueAttorneys = [...new Set(cases.map(c => c.primaryLawyer).filter(Boolean))] as string[];
    const uniquePhysicians = authorizedUsers.filter(u => u.status === 'active');

    // Build a lookup map for owner names from authorizedUsers
    const ownerNameMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        authorizedUsers.forEach(u => { map[u.id] = u.name; });
        return map;
    }, [authorizedUsers]);

    /** Resolve owner display name for a case */
    const getOwnerName = (c: Case): string => {
        if (c.ownerName) return c.ownerName;
        if (ownerNameMap[c.ownerId]) return ownerNameMap[c.ownerId];
        return 'Unknown';
    };

    // Unique owners derived from the full cases list (for the owner filter dropdown)
    const uniqueOwners = React.useMemo(() => {
        const seen = new Set<string>();
        const result: { id: string; name: string }[] = [];
        cases.forEach(c => {
            if (!seen.has(c.ownerId)) {
                seen.add(c.ownerId);
                result.push({ id: c.ownerId, name: getOwnerName(c) });
            }
        });
        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, [cases, ownerNameMap]);

    useEffect(() => {
        localStorage.setItem('apex_dashboard_tab', activeTab);
    }, [activeTab]);

    // Ensure Roboto font is available for this page
    useEffect(() => {
        try {
            const id = 'apex-roboto-font';
            if (!document.getElementById(id)) {
                const link = document.createElement('link');
                link.id = id;
                link.rel = 'stylesheet';
                link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap';
                document.head.appendChild(link);
            }
        } catch (e) {
            // ignore font-load errors
            console.warn('Could not load Roboto font', e);
        }
    }, []);

    // Handle Legacy Statuses from Mock Data if any
    const normalizedCases = cases.map(c => ({
        ...c,
        status: (['planning', 'active', 'on_hold', 'cancelled', 'archived'].includes(c.status) ? c.status : 'active') as CaseStatus
    }));

    // Calculate Counts — counts are based on admin ownership filter too
    const countsSource = isAdmin && adminViewMode === 'mine'
        ? normalizedCases.filter(c => {
            const emailLower = currentUser.email?.toLowerCase();
            return c.ownerId === currentUser.id ||
                (c.assignedUserIds || []).includes(currentUser.id) ||
                (emailLower && (c.assignedUserEmails || []).includes(emailLower));
        })
        : normalizedCases;

    const counts = countsSource.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
    }, {} as Record<CaseStatus, number>);

    const filteredCases = normalizedCases.filter(c => {
        const matchesTab = c.status === activeTab;
        const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.primaryLawyer || '').toLowerCase().includes(searchTerm.toLowerCase());

        // Admin ownership visibility constraint (default: show only owned/shared cases)
        let matchesOwnershipConstraint = true;
        if (isAdmin && adminViewMode === 'mine') {
            const emailLower = currentUser.email?.toLowerCase();
            matchesOwnershipConstraint =
                c.ownerId === currentUser.id ||
                (c.assignedUserIds || []).includes(currentUser.id) ||
                (emailLower && (c.assignedUserEmails || []).includes(emailLower));
        }

        // Filter by case owner (reporting attribute — works in both 'mine' and 'all' view)
        const matchesOwner = !filterOwner || c.ownerId === filterOwner;

        // Filter by attorney
        const matchesAttorney = !filterAttorney || (c.primaryLawyer || '') === filterAttorney;

        // Filter by assigned physician
        const matchesPhysician = !filterPhysician ||
          c.ownerId === filterPhysician ||
          (c.assignedUserIds || []).includes(filterPhysician) ||
          (c.assignedUserEmails || []).includes(filterPhysician);

        // Filter by date range (using startDate or createdAt)
        const caseDate = c.startDate || c.createdAt || '';
        const matchesDateFrom = !filterDateFrom || caseDate >= filterDateFrom;
        const matchesDateTo = !filterDateTo || caseDate <= filterDateTo;

        return matchesTab && matchesSearch && matchesOwnershipConstraint && matchesOwner && matchesAttorney && matchesPhysician && matchesDateFrom && matchesDateTo;
    });

    const handleDelete = (e: React.MouseEvent, c: Case) => {
        e.stopPropagation();
        onDeleteCase(c.id);
    };

    const handleEdit = (e: React.MouseEvent, c: Case) => {
        e.stopPropagation();
        onEdit(c);
    };

    return (
        <div className="p-8 max-w-[1400px] mx-auto w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-8 shrink-0">
                <div>
                    <h2 className="text-3xl font-black text-slate-900" style={{ fontFamily: "'Roboto', sans-serif" }}>Cases Dashboard</h2>
                    <p className="text-slate-500 mt-1" style={{ fontFamily: "'Roboto', sans-serif" }}>Track case progress, manage medical opinions, and coordinate with counsel.</p>
                </div>
                <button
                    onClick={onCreate}
                    className="flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-100 font-semibold"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>New Legal Case</span>
                </button>
            </div>

            <div className="flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 min-h-0 min-w-0">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 gap-3 flex-wrap">
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

                    <div className="flex items-center gap-2 ml-auto">
                        {/* Admin View Mode Toggle */}
                        {isAdmin && (
                            <div className="flex items-center bg-slate-200/50 rounded-lg p-0.5 text-xs font-bold gap-0.5">
                                <button
                                    onClick={() => setAdminViewMode('mine')}
                                    className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${adminViewMode === 'mine'
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                    title="Show only cases you own or that are shared with you"
                                >
                                    My Cases
                                </button>
                                <button
                                    onClick={() => setAdminViewMode('all')}
                                    className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${adminViewMode === 'all'
                                        ? 'bg-white text-cyan-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                    title="Show all cases across all physicians"
                                >
                                    All Cases
                                </button>
                            </div>
                        )}

                        <div className="relative w-56">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all"
                                placeholder="Search cases..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="relative" ref={filterRef}>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${hasActiveFilters
                                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <SlidersHorizontalIcon className="w-3.5 h-3.5" />
                                Filters
                                {hasActiveFilters && <span className="w-4 h-4 bg-cyan-600 text-white rounded-full text-[9px] flex items-center justify-center">!</span>}
                            </button>
                            {showFilters && (
                                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filters</span>
                                        {hasActiveFilters && (
                                            <button onClick={clearFilters} className="text-[10px] font-bold text-red-500 hover:text-red-700">Clear All</button>
                                        )}
                                    </div>

                                    {/* Case Owner filter — always visible, enables filtering by physician */}
                                    {isAdmin && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Case Owner</label>
                                            <select
                                                value={filterOwner}
                                                onChange={e => {
                                                    setFilterOwner(e.target.value);
                                                    // When filtering by a specific owner, switch to All Cases view so the selection is visible
                                                    if (e.target.value) setAdminViewMode('all');
                                                }}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                                            >
                                                <option value="">All Owners</option>
                                                {uniqueOwners.map(o => (
                                                    <option key={o.id} value={o.id}>
                                                        {o.id === currentUser.id ? `${o.name} (me)` : o.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Attorney</label>
                                        <select
                                            value={filterAttorney}
                                            onChange={e => setFilterAttorney(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                                        >
                                            <option value="">All Attorneys</option>
                                            {uniqueAttorneys.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Assigned Physician</label>
                                        <select
                                            value={filterPhysician}
                                            onChange={e => setFilterPhysician(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                                        >
                                            <option value="">All Physicians</option>
                                            {uniquePhysicians.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date From</label>
                                            <input
                                                type="date"
                                                value={filterDateFrom}
                                                onChange={e => setFilterDateFrom(e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date To</label>
                                            <input
                                                type="date"
                                                value={filterDateTo}
                                                onChange={e => setFilterDateTo(e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowFilters(false)}
                                        className="w-full py-2 bg-cyan-600 text-white rounded-lg text-xs font-bold hover:bg-cyan-700 transition-all"
                                    >
                                        Apply Filters
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Admin context banner */}
                {isAdmin && adminViewMode === 'all' && (
                    <div className="px-6 py-2 bg-cyan-50 border-b border-cyan-100 flex items-center justify-between text-xs">
                        <span className="text-cyan-700 font-medium flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5" />
                            Showing all cases across all physicians
                            {filterOwner && (() => {
                                const owner = uniqueOwners.find(o => o.id === filterOwner);
                                return owner ? ` — filtered to: ${owner.name}` : '';
                            })()}
                        </span>
                        <button
                            onClick={() => { setAdminViewMode('mine'); setFilterOwner(''); }}
                            className="text-cyan-600 font-bold hover:text-cyan-800 underline"
                        >
                            Back to My Cases
                        </button>
                    </div>
                )}

                {/* Table - header + body in same scroll context for alignment */}
                <div className="flex-1 min-h-0 min-w-0 overflow-auto">
                    {/* Table Header */}
                    <div className="grid grid-cols-[2fr_1fr_1.1fr_1fr_1.1fr_0.85fr_0.9fr_0.9fr] gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 sticky top-0 z-10 min-w-[1000px]">
                        <div>Case Details</div>
                        <div>Case Owner</div>
                        <div>Client</div>
                        <div>Start Date</div>
                        <div>Assigned Attorney</div>
                        <div>Status</div>
                        <div>Last Activity</div>
                        <div className="text-right">Actions</div>
                    </div>

                    {/* Table Body */}
                    {filteredCases.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <FilterIcon className="w-12 h-12 mb-2 opacity-20" />
                            <p>No cases found in {STATUS_LABELS[activeTab]}</p>
                            {isAdmin && adminViewMode === 'mine' && (
                                <button
                                    onClick={() => setAdminViewMode('all')}
                                    className="mt-3 text-xs text-cyan-600 font-bold hover:underline"
                                >
                                    Switch to All Cases view
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredCases.map(c => {
                                const ownerName = getOwnerName(c);
                                const isOwner = c.ownerId === currentUser.id;
                                return (
                                    <div
                                        key={c.id}
                                        onClick={() => onSelect(c)}
                                        className="grid grid-cols-[2fr_1fr_1.1fr_1fr_1.1fr_0.85fr_0.9fr_0.9fr] gap-4 px-6 py-4 transition-colors cursor-pointer group items-center hover:bg-slate-50 min-w-[1000px]"
                                    >
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-cyan-600 transition-colors truncate">{c.title}</h3>
                                            <p className="text-xs text-slate-500 line-clamp-1">{c.description}</p>
                                        </div>
                                        {/* Case Owner column */}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${isOwner ? 'bg-slate-800' : 'bg-indigo-400'}`}>
                                                    {ownerName.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-sm text-slate-700 truncate block">{ownerName}</span>
                                                    {isOwner && (
                                                        <span className="text-[9px] text-slate-400 font-medium">You</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            {(c.clients && c.clients.length > 0) ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                                                        {c.clients[0].name.charAt(0)}
                                                    </div>
                                                    <span className="text-sm text-slate-700 truncate">{c.clients[0].name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">No Client</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-600 font-mono whitespace-nowrap">
                                            {formatDate(c.startDate || c.createdAt)}
                                        </div>
                                        <div className="min-w-0">
                                            {c.primaryLawyer ? (
                                                <div className="flex items-center gap-2 text-sm text-slate-700">
                                                    <UsersIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span className="truncate">{c.primaryLawyer}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Unassigned</span>
                                            )}
                                        </div>
                                        <div>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[c.status]}`}>
                                                {STATUS_LABELS[c.status]}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-600 font-mono whitespace-nowrap">
                                            {getLastActivityDate(c)}
                                        </div>
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={(e) => handleEdit(e, c)}
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
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 border-t border-slate-200 p-3 text-xs text-slate-400 text-center shrink-0">
                    Showing {filteredCases.length} case{filteredCases.length !== 1 && 's'}
                    {isAdmin && adminViewMode === 'mine' && ' (My Cases)'}
                    {isAdmin && adminViewMode === 'all' && ' (All Cases)'}
                </div>
            </div>
        </div>
    );
};

export default CaseList;
