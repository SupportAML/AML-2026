
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
}

const ClientDirectory: React.FC<ClientDirectoryProps> = ({ cases, currentUser }) => {
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDirectory;
