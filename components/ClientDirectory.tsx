
import React, { useState } from 'react';
import {
  UsersIcon,
  SearchIcon,
  FilterIcon,
  UploadIcon,
  BriefcaseIcon,
  PhoneIcon,
  MailIcon
} from 'lucide-react';
import { Client, Case, UserProfile } from '../types';

interface ClientDirectoryProps {
  cases: Case[];
  currentUser: UserProfile;
  onUpdateCase: (c: Case) => void;
}

const ClientDirectory: React.FC<ClientDirectoryProps> = ({ cases, currentUser, onUpdateCase }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState<string>('ALL');

  // Aggregate clients from all cases
  const allClients = cases.reduce((acc, currentCase) => {
    if (!currentCase.clients) return acc;
    // Map clients to include case info for context
    const caseClients = currentCase.clients.map(c => ({
      ...c,
      caseId: currentCase.id,
      caseTitle: currentCase.title,
      caseOwnerId: currentCase.ownerId,
      caseOwnerName: currentCase.ownerName
    }));
    return [...acc, ...caseClients];
  }, [] as (Client & { caseId: string, caseTitle: string, caseOwnerId: string, caseOwnerName?: string })[]);

  // Filter Logic
  const filteredClients = allClients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUser = filterUser === 'ALL' ? true :
      filterUser === 'ME' ? c.caseOwnerId === currentUser.id :
        c.caseOwnerId !== currentUser.id; // Others

    return matchesSearch && matchesUser;
  });

  const handleMassImport = () => {
    // Mock CSV Import
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        alert(`Imported clients from ${file.name}. (Mock Action)`);
        // Here you would parse CSV and call an onImport prop to add to state
      }
    };
    input.click();
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editClient, setEditClient] = useState<Partial<Client> | null>(null);
  const [editClientOriginalCaseId, setEditClientOriginalCaseId] = useState<string | null>(null);

  const openEditModal = (client: any) => {
    setEditClient({ id: client.id, name: client.name, email: client.email, phone: client.phone, role: client.role });
    setEditClientOriginalCaseId(client.caseId);
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!editClient || !editClient.id) return;
    const targetCaseId = (editClient as any).caseId || editClientOriginalCaseId;
    // If associated case changed, move client between cases
    const originalCaseId = editClientOriginalCaseId;
    const updatedCases = cases.map(c => {
      // clone
      const clone = { ...c, clients: (c.clients || []).slice() };
      if (c.id === originalCaseId) {
        clone.clients = clone.clients.filter(cli => cli.id !== editClient.id);
      }
      return clone;
    });

    const targetCase = updatedCases.find(c => c.id === targetCaseId);
    if (targetCase) {
      const updatedClient: Client = {
        id: editClient.id!,
        name: editClient.name || '',
        email: editClient.email || '',
        phone: editClient.phone || '',
        role: editClient.role as any || 'Other'
      };
      // if client exists in target, replace, else push
      const existsIdx = (targetCase.clients || []).findIndex(cli => cli.id === updatedClient.id);
      if (existsIdx >= 0) {
        targetCase.clients![existsIdx] = updatedClient;
      } else {
        targetCase.clients = [...(targetCase.clients || []), updatedClient];
      }
      onUpdateCase(targetCase);
    }

    // If original case was different, also update it via onUpdateCase
    if (originalCaseId && originalCaseId !== targetCaseId) {
      const orig = updatedCases.find(c => c.id === originalCaseId);
      if (orig) onUpdateCase(orig);
    }

    setShowEditModal(false);
    setEditClient(null);
    setEditClientOriginalCaseId(null);
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditClient(null);
    setEditClientOriginalCaseId(null);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-serif font-black text-slate-900 flex items-center gap-3">
            <UsersIcon className="w-8 h-8 text-rose-600" />
            Client Directory
          </h1>
          <button
            onClick={handleMassImport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-rose-600 transition-colors shadow-sm"
          >
            <UploadIcon className="w-4 h-4" />
            Import CSV
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="relative w-64">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-rose-500"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <FilterIcon className="w-4 h-4 text-slate-400" />
              <select
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
              >
                <option value="ALL">All Clients</option>
                {currentUser.role === 'ADMIN' && <option value="ME">My Cases</option>}
                {currentUser.role === 'ADMIN' && <option value="OTHERS">Other Physicians</option>}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Associated Case</th>
                  {currentUser.role === 'ADMIN' && <th className="px-6 py-4">Physician</th>}
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                      No clients found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client, idx) => (
                    <tr key={`${client.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 font-bold text-slate-700">
                        {client.name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-slate-600">
                            <MailIcon className="w-3 h-3 text-slate-400" /> {client.email}
                          </div>
                          <div className="flex items-center gap-2 text-slate-500 text-xs">
                            <PhoneIcon className="w-3 h-3 text-slate-300" /> {client.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${client.role === 'Plaintiff' ? 'bg-emerald-50 text-emerald-700' :
                            client.role === 'Defendant' ? 'bg-red-50 text-red-700' :
                              'bg-slate-100 text-slate-600'
                          }`}>
                          {client.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-indigo-600 font-medium">
                          <BriefcaseIcon className="w-4 h-4" />
                          {client.caseTitle}
                        </div>
                      </td>
                      {currentUser.role === 'ADMIN' && (
                        <td className="px-6 py-4 text-slate-500">
                          {client.caseOwnerName || 'Unknown'}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(client)}
                            title="Edit client"
                            className="p-2 rounded hover:bg-slate-100 text-slate-500"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <span className="sr-only">Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showEditModal && editClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Edit Client</h3>
              <button onClick={handleCancelEdit} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Name</label>
                <input className="w-full p-2 border rounded" value={editClient.name || ''} onChange={e => setEditClient(prev => ({ ...(prev||{}), name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email</label>
                <input className="w-full p-2 border rounded" value={editClient.email || ''} onChange={e => setEditClient(prev => ({ ...(prev||{}), email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Phone</label>
                <input className="w-full p-2 border rounded" value={editClient.phone || ''} onChange={e => setEditClient(prev => ({ ...(prev||{}), phone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Role</label>
                <select className="w-full p-2 border rounded" value={editClient.role || 'Other'} onChange={e => setEditClient(prev => ({ ...(prev||{}), role: e.target.value as any }))}>
                  <option value="Plaintiff">Plaintiff</option>
                  <option value="Defendant">Defendant</option>
                  <option value="Lawyer">Lawyer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Associated Case</label>
                <select className="w-full p-2 border rounded" value={editClientOriginalCaseId || ''} onChange={e => setEditClient(prev => ({ ...(prev||{}), caseId: e.target.value }))}>
                  <option value="">Select case</option>
                  {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={handleCancelEdit} className="px-4 py-2 text-slate-600 rounded bg-slate-50">Cancel</button>
                <button onClick={handleSaveEdit} className="px-4 py-2 bg-indigo-600 text-white rounded">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDirectory;
