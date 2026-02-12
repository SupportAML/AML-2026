
import React, { useState } from 'react';
import {
  LayoutDashboardIcon,
  MessageSquareIcon,
  SettingsIcon,
  PlusIcon,
  ScaleIcon,
  GripVerticalIcon,
  ArchiveIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  UsersIcon,
  UserPlusIcon,
  XIcon,
  Trash2Icon,
  ShieldIcon,
  MailIcon,
  CheckCircle2Icon,
  EyeIcon,
  CompassIcon,
  BookUserIcon,
  UserIcon,
  SparklesIcon
} from 'lucide-react';
import { ViewMode, Case, UserProfile, AuthorizedUser, UserRole } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  setView: (v: ViewMode) => void;
  activeCase: Case | null;
  onSelectCase: (c: Case) => void;
  cases: Case[];
  onCreateCase: () => void;
  onOpenSettings: () => void;
  currentUser: UserProfile;
  onReorderCases: (draggedId: string, targetId: string) => void;
  authorizedUsers: AuthorizedUser[];
  onInviteUser: (email: string, role: UserRole, name: string) => void;
  onDeleteUser: (id: string) => void;
  onImpersonate?: (userId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setView,
  activeCase,
  onSelectCase,
  cases,
  onCreateCase,
  onOpenSettings,
  currentUser,
  onReorderCases,
  authorizedUsers,
  onInviteUser,
  onDeleteUser,
  onImpersonate
}) => {
  const [draggedCaseId, setDraggedCaseId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [collapsedUsers, setCollapsedUsers] = useState<Set<string>>(new Set());
  // team management moved to full Team Admin view

  // New User State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('USER');

  // Filter Cases: Owner OR Assigned
  const myActiveCases = cases.filter(c =>
    c.status === 'active' &&
    (c.ownerId === currentUser.id || c.assignedUserIds?.includes(currentUser.id))
  );

  const myInactiveCases = cases.filter(c =>
    ['on_hold', 'cancelled', 'archived'].includes(c.status) &&
    (c.ownerId === currentUser.id || c.assignedUserIds?.includes(currentUser.id))
  );

  // For Admin View: Group cases by owner (exclude self to avoid duplication if admin owns cases)
  const otherUsersCases = currentUser.role === 'ADMIN'
    ? cases.filter(c => c.ownerId !== currentUser.id)
    : [];

  const groupedOtherCases: Record<string, Case[]> = {};
  if (currentUser.role === 'ADMIN') {
    otherUsersCases.forEach(c => {
      const owner = c.ownerName || 'Unknown User';
      if (!groupedOtherCases[owner]) groupedOtherCases[owner] = [];
      groupedOtherCases[owner].push(c);
    });
  }

  const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${active
        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-200'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span>{label}</span>
    </button>
  );

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCaseId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedCaseId && draggedCaseId !== targetId) {
      onReorderCases(draggedCaseId, targetId);
    }
    setDraggedCaseId(null);
  };

  const toggleUserCollapse = (owner: string) => {
    const newSet = new Set(collapsedUsers);
    if (newSet.has(owner)) newSet.delete(owner);
    else newSet.add(owner);
    setCollapsedUsers(newSet);
  };

  const handleInvite = () => {
    if (newUserEmail) {
      if (authorizedUsers.some(u => u.email === newUserEmail)) {
        alert("User already exists.");
        return;
      }
      onInviteUser(newUserEmail, newUserRole, newUserName);
      setNewUserName('');
      setNewUserEmail('');
    }
  };

  return (
    <aside className="w-64 bg-white border-r flex flex-col h-full shrink-0 relative">
      

      <div className="p-6 pb-2">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center text-white shadow-lg">
            <ScaleIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xl font-extrabold tracking-[-0.02em] text-slate-900 leading-none">ApexMedLaw</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 block">Admin Access</span>
          </div>
        </div>

        <nav className="space-y-1 mb-6">
          <NavItem
            icon={LayoutDashboardIcon}
            label="Dashboard"
            active={currentView === ViewMode.DASHBOARD}
            onClick={() => setView(ViewMode.DASHBOARD)}
          />
          <NavItem
            icon={BookUserIcon}
            label="Clients"
            active={currentView === ViewMode.CLIENTS}
            onClick={() => setView(ViewMode.CLIENTS)}
          />
          <NavItem
            icon={CompassIcon}
            label="Orientation"
            active={currentView === ViewMode.ORIENTATION}
            onClick={() => setView(ViewMode.ORIENTATION)}
          />
          <div className="pt-4 mt-4 border-t border-slate-100">
            <NavItem
              icon={UserIcon}
              label="Profile"
              active={currentView === ViewMode.PROFILE}
              onClick={() => setView(ViewMode.PROFILE)}
            />
            {currentUser.role === 'ADMIN' && (
              <>
                <NavItem
                  icon={SettingsIcon}
                  label="Settings"
                  active={currentView === ViewMode.SETTINGS}
                  onClick={() => setView(ViewMode.SETTINGS)}
                />
                <NavItem
                  icon={SparklesIcon}
                  label="Admin Insights"
                  active={currentView === ViewMode.ADMIN_INSIGHTS}
                  onClick={() => setView(ViewMode.ADMIN_INSIGHTS)}
                />
                <NavItem
                  icon={ShieldIcon}
                  label="Team Admin"
                  active={currentView === ViewMode.TEAM_ADMIN}
                  onClick={() => setView(ViewMode.TEAM_ADMIN)}
                />
              </>
            )}
          </div>
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
        {/* ACTIVE CASES (My Cases) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Legal Cases</span>
            <button
              onClick={onCreateCase}
              className="text-slate-400 hover:text-cyan-600 transition-colors"
              title="New Legal Case"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            {myActiveCases.map(c => (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => handleDragStart(e, c.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, c.id)}
                onClick={() => onSelectCase(c)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer group relative ${activeCase?.id === c.id && currentView !== ViewMode.DASHBOARD
                  ? 'bg-cyan-50 text-cyan-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  } ${draggedCaseId === c.id ? 'opacity-50 border-2 border-dashed border-cyan-300' : ''}`}
              >
                <GripVerticalIcon className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing" />
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeCase?.id === c.id ? 'bg-cyan-600' : 'bg-slate-300'}`} />
                <span className="truncate flex-1">{c.title}</span>
                {c.ownerId !== currentUser.id && (
                  <span title="Shared with you">
                    <UsersIcon className="w-3 h-3 text-slate-400" />
                  </span>
                )}
              </div>
            ))}
            {myActiveCases.length === 0 && (
              <p className="text-xs text-slate-300 italic px-2">No active cases</p>
            )}
          </div>
        </div>

        {/* INACTIVE CASES */}
        <div>
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 mb-2 w-full"
          >
            {showInactive ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
            Archived
          </button>

          {showInactive && (
            <div className="space-y-1 pl-2 border-l-2 border-slate-100 ml-1">
              {myInactiveCases.map(c => (
                <button
                  key={c.id}
                  onClick={() => onSelectCase(c)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left ${activeCase?.id === c.id
                    ? 'text-slate-700 font-semibold bg-slate-100'
                    : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  <ArchiveIcon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{c.title}</span>
                </button>
              ))}
              {myInactiveCases.length === 0 && (
                <p className="text-xs text-slate-300 italic px-2">No archived cases</p>
              )}
            </div>
          )}
        </div>

        {/* ADMIN VIEW */}
        {currentUser.role === 'ADMIN' && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldIcon className="w-3.5 h-3.5 text-cyan-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Firm Access</span>
              </div>
              <button
                onClick={() => setView(ViewMode.TEAM_ADMIN)}
                className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400"
                title="Manage Team"
              >
                <UserPlusIcon className="w-4 h-4" />
              </button>
            </div>

            {Object.keys(groupedOtherCases).length > 0 && (
              <div className="space-y-3">
                {Object.entries(groupedOtherCases).map(([owner, cases]) => (
                  <div key={owner}>
                    <button
                      onClick={() => toggleUserCollapse(owner)}
                      className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-cyan-600 w-full mb-1"
                    >
                      {collapsedUsers.has(owner) ? <ChevronRightIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                      {owner}
                    </button>
                    {!collapsedUsers.has(owner) && (
                      <div className="pl-3 space-y-1 border-l border-slate-100 ml-1.5">
                        {cases.map(c => (
                          <button
                            key={c.id}
                            onClick={() => onSelectCase(c)}
                            className={`w-full text-left text-xs truncate py-1 px-2 rounded ${activeCase?.id === c.id ? 'bg-slate-100 text-slate-800 font-bold' : 'text-slate-400 hover:text-slate-600'
                              }`}
                          >
                            {c.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto p-4 border-t bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm ${currentUser.avatarColor || 'bg-cyan-600'}`}>
            {currentUser.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-700 truncate">{currentUser.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
