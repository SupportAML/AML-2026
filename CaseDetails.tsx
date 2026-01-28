
import React, { useRef, useState } from 'react';
import { 
  FileTextIcon, 
  UploadIcon, 
  CheckCircle2Icon,
  FolderTreeIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Trash2Icon,
  UsersIcon,
  PlusIcon,
  XIcon,
  PencilIcon,
  ScaleIcon,
  StarIcon,
  CheckIcon,
  ArrowRightLeftIcon,
  EyeIcon,
  ClockIcon,
  LayoutTemplateIcon
} from 'lucide-react';
import { Case, Document, AuthorizedUser, UserProfile, Client, ReviewStatus } from '../types';

interface CaseDetailsProps {
  caseItem: Case;
  docs: Document[];
  currentUser: UserProfile;
  allUsers: AuthorizedUser[];
  onAssignUser: (caseId: string, userId: string) => void;
  onRemoveUser: (caseId: string, userId: string) => void;
  onOpenDoc: (doc: Document) => void;
  onUpload: (caseId: string, file: File) => void;
  onUpdateCase: (updatedCase: Case) => void;
  onDeleteDoc: (docId: string) => void;
  onUpdateDocStatus: (docId: string, status: ReviewStatus) => void;
  onOpenAnalysis: () => void;
}

interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  path: string;
  doc?: Document;
  children: Record<string, TreeNode>;
  isOpen?: boolean;
}

const FileTreeItem: React.FC<{ 
  node: TreeNode; 
  level: number; 
  onOpenDoc: (d: Document) => void;
  onDeleteDoc: (id: string) => void;
  onUpdateStatus: (id: string, status: ReviewStatus) => void;
}> = ({ node, level, onOpenDoc, onDeleteDoc, onUpdateStatus }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (node.type === 'file' && node.doc) {
    const statusColor = {
        'pending': 'text-slate-300',
        'in_review': 'text-amber-500',
        'reviewed': 'text-green-500'
    };

    return (
      <div 
        className="flex items-center gap-3 py-2 px-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group"
        style={{ paddingLeft: `${level * 20}px` }}
        onClick={() => onOpenDoc(node.doc!)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm shrink-0 ${node.doc.category === 'research' ? 'bg-indigo-50 border-indigo-100 text-indigo-500' : 'bg-white border-slate-100 text-red-500'}`}>
          <FileTextIcon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 truncate">{node.name}</p>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
             <span>{node.doc.size}</span>
             <CheckCircle2Icon className="w-3 h-3 text-slate-400" />
          </div>
        </div>
        
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <button 
                onClick={() => {
                    const nextStatus: ReviewStatus = node.doc!.reviewStatus === 'pending' ? 'in_review' : node.doc!.reviewStatus === 'in_review' ? 'reviewed' : 'pending';
                    onUpdateStatus(node.doc!.id, nextStatus);
                }}
                className={`p-1.5 rounded-full hover:bg-slate-100 transition-colors ${statusColor[node.doc!.reviewStatus || 'pending']}`}
                title={`Status: ${node.doc!.reviewStatus || 'pending'}`}
            >
                {(!node.doc!.reviewStatus || node.doc!.reviewStatus === 'pending') && <ClockIcon className="w-4 h-4" />}
                {node.doc!.reviewStatus === 'in_review' && <EyeIcon className="w-4 h-4" />}
                {node.doc!.reviewStatus === 'reviewed' && <CheckCircle2Icon className="w-4 h-4" />}
            </button>
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); onDeleteDoc(node.doc!.id); }}
          className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2Icon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="group/folder">
      <div 
        className="flex items-center gap-2 py-2 px-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors text-slate-600 select-none"
        style={{ paddingLeft: `${level * 20}px` }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDownIcon className="w-4 h-4 text-slate-400" /> : <ChevronRightIcon className="w-4 h-4 text-slate-400" />}
        <FolderTreeIcon className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-bold truncate flex-1">{node.name}</span>
      </div>
      {isOpen && (
        <div className="border-l border-slate-100 ml-4">
           {Object.keys(node.children)
              .sort((a,b) => {
                 const nodeA = node.children[a];
                 const nodeB = node.children[b];
                 if (nodeA.type !== nodeB.type) return nodeA.type === 'folder' ? -1 : 1;
                 return a.localeCompare(b);
              })
              .map(key => (
                 <FileTreeItem 
                    key={node.children[key].path} 
                    node={node.children[key]} 
                    level={level + 1} 
                    onOpenDoc={onOpenDoc}
                    onDeleteDoc={onDeleteDoc}
                    onUpdateStatus={onUpdateStatus}
                 />
              ))}
        </div>
      )}
    </div>
  );
};

export const CaseDetails: React.FC<CaseDetailsProps> = ({ 
  caseItem, docs, onOpenDoc, onUpload, onUpdateCase, onDeleteDoc,
  currentUser, allUsers, onAssignUser, onRemoveUser, onUpdateDocStatus, onOpenAnalysis
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editTitle, setEditTitle] = useState(caseItem.title);
  const [editDescription, setEditDescription] = useState(caseItem.description);
  const [editStartDate, setEditStartDate] = useState(caseItem.startDate || caseItem.createdAt);
  const [editPrimaryLawyer, setEditPrimaryLawyer] = useState(caseItem.primaryLawyer || '');
  const [editStatus, setEditStatus] = useState(caseItem.status);

  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState<Partial<Client>>({ role: 'Plaintiff' });
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editClientData, setEditClientData] = useState<Partial<Client>>({});

  const [isAssigning, setIsAssigning] = useState(false);
  const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);

  const canManageTeam = currentUser.role === 'ADMIN' || currentUser.id === caseItem.ownerId;
  const fileSectionRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(caseItem.id, file);
    }
  };

  const handleSaveMetadata = () => {
    onUpdateCase({
      ...caseItem,
      title: editTitle,
      description: editDescription,
      startDate: editStartDate,
      primaryLawyer: editPrimaryLawyer,
      status: editStatus
    });
    setIsEditingMetadata(false);
  };

  const handleAddClient = () => {
    if (!newClient.name || !newClient.email) return;
    const client: Client = {
      id: Date.now().toString(),
      name: newClient.name,
      email: newClient.email,
      phone: newClient.phone || '',
      role: newClient.role as any || 'Plaintiff'
    };
    onUpdateCase({
      ...caseItem,
      clients: [...(caseItem.clients || []), client]
    });
    setNewClient({ role: 'Plaintiff' });
    setShowAddClient(false);
  };

  const handleRemoveClient = (id: string) => {
    onUpdateCase({
      ...caseItem,
      clients: (caseItem.clients || []).filter(c => c.id !== id)
    });
  };

  const handleTransferOwnership = (newOwnerId: string) => {
    const newOwner = allUsers.find(u => u.id === newOwnerId);
    if (!newOwner) return;
    const confirm = window.confirm(`Are you sure you want to transfer ownership of this case to ${newOwner.name}?`);
    if (confirm) {
      onUpdateCase({
        ...caseItem,
        ownerId: newOwner.id,
        ownerName: newOwner.name
      });
      setIsTransferringOwnership(false);
    }
  };

  const buildTree = (): Record<string, TreeNode> => {
    const root: Record<string, TreeNode> = {};
    docs.forEach(doc => {
       const cleanPath = (doc.path || '/').replace(/^\/+|\/+$/g, ''); 
       const parts = cleanPath ? cleanPath.split('/') : [];
       let currentLevel = root;
       let currentPath = '';
       parts.forEach(part => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          if (!currentLevel[part]) {
             currentLevel[part] = { name: part, type: 'folder', path: currentPath, children: {} };
          }
          currentLevel = currentLevel[part].children;
       });
       currentLevel[doc.id] = {
         name: doc.name, type: 'file', path: doc.path ? `${doc.path}/${doc.name}` : doc.name, doc: doc, children: {}
       };
    });
    return root;
  };

  const treeData = buildTree();
  const assignedUsers = (caseItem.assignedUserIds || []).map(id => allUsers.find(u => u.id === id)).filter(Boolean) as AuthorizedUser[];
  const assignableUsers = allUsers.filter(u => u.id !== caseItem.ownerId && !(caseItem.assignedUserIds || []).includes(u.id));
  const potentialOwners = allUsers.filter(u => u.id !== caseItem.ownerId);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
          <div className="flex flex-col gap-6">
             <div className="flex items-start justify-between">
                <div className="relative group">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">CASE ID: {caseItem.id}</span>
                      <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                          caseItem.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                          caseItem.status === 'planning' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                      }`}>{caseItem.status.replace('_', ' ')}</span>
                      {canManageTeam && (
                        <button onClick={() => setIsEditingMetadata(true)} className="text-slate-400 hover:text-indigo-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <h2 className="text-4xl font-serif font-bold text-slate-900 mb-2">{caseItem.title}</h2>
                    <p className="text-slate-600 leading-relaxed max-w-2xl">{caseItem.description}</p>
                </div>
             </div>

             <button 
                onClick={onOpenAnalysis}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 rounded-2xl shadow-xl shadow-indigo-100 hover:shadow-2xl hover:scale-[1.01] transition-all group flex items-center justify-between"
             >
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <LayoutTemplateIcon className="w-8 h-8 text-white" />
                   </div>
                   <div className="text-left">
                      <h3 className="text-xl font-bold">Open Clinical Synthesis Workspace</h3>
                      <p className="text-indigo-100 text-sm">Analyze timeline, research medical literature, and draft legal reports.</p>
                   </div>
                </div>
                <div className="bg-white/10 p-2 rounded-full group-hover:bg-white/20 transition-colors">
                   <ChevronRightIcon className="w-6 h-6" />
                </div>
             </button>
          </div>
      </div>

      {isEditingMetadata && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
             <div className="bg-white p-6 rounded-2xl shadow-xl max-w-lg w-full">
                <h3 className="text-lg font-bold mb-4">Edit Case Details</h3>
                <div className="space-y-4">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                      <input className="w-full p-2 border rounded" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                      <select className="w-full p-2 border rounded" value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)}>
                          <option value="planning">Planning</option>
                          <option value="active">Active</option>
                          <option value="on_hold">On Hold</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="archived">Archived</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Primary Lawyer</label>
                      <input className="w-full p-2 border rounded" value={editPrimaryLawyer} onChange={(e) => setEditPrimaryLawyer(e.target.value)} />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                      <textarea className="w-full p-2 border rounded h-24" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                   </div>
                   <div className="flex gap-2 justify-end mt-4">
                       <button onClick={() => setIsEditingMetadata(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                       <button onClick={handleSaveMetadata} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Save Changes</button>
                </div>
             </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   <UsersIcon className="w-4 h-4" /> Client Roster
                </h3>
                <button onClick={() => setShowAddClient(!showAddClient)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                   {showAddClient ? <XIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
                </button>
             </div>
             
             {showAddClient && (
                <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-4 gap-2">
                   <input className="text-xs p-2 border rounded" placeholder="Name" value={newClient.name || ''} onChange={e => setNewClient({...newClient, name: e.target.value})} />
                   <input className="text-xs p-2 border rounded" placeholder="Email" value={newClient.email || ''} onChange={e => setNewClient({...newClient, email: e.target.value})} />
                   <select className="text-xs p-2 border rounded" value={newClient.role} onChange={e => setNewClient({...newClient, role: e.target.value as any})}>
                      <option value="Plaintiff">Plaintiff</option>
                      <option value="Defendant">Defendant</option>
                      <option value="Lawyer">Lawyer</option>
                      <option value="Other">Other</option>
                   </select>
                   <button onClick={handleAddClient} className="bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700">Add</button>
                </div>
             )}

             <div className="divide-y divide-slate-100 flex-1">
                {(caseItem.clients || []).length === 0 ? (
                   <p className="p-4 text-xs text-slate-400 italic text-center">No clients added.</p>
                ) : (
                   (caseItem.clients || []).map(client => (
                      <div key={client.id} className="p-3 flex items-center justify-between hover:bg-slate-50 group">
                         <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-700">{client.name}</p>
                              {caseItem.primaryLawyer === client.name && client.role === 'Lawyer' && (
                                 <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded font-bold uppercase tracking-wider flex items-center gap-0.5">
                                    <ScaleIcon className="w-2 h-2" /> Primary
                                 </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">{client.email}</p>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${client.role === 'Plaintiff' ? 'bg-emerald-50 text-emerald-600' : client.role === 'Lawyer' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                              {client.role}
                            </span>
                            <button onClick={() => handleRemoveClient(client.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                               <Trash2Icon className="w-3 h-3" />
                            </button>
                         </div>
                      </div>
                   ))
                )}
             </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
             <div className="flex items-center justify-between mb-3">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Team Access</span>
               {canManageTeam && (
                 <button onClick={() => setIsAssigning(!isAssigning)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-full">
                   <PlusIcon className="w-4 h-4" />
                 </button>
               )}
             </div>
             
             <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between group">
                   <div className="flex items-center gap-2">
                     <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center text-[10px] font-bold text-white">
                        O
                     </div>
                     <span className="text-xs font-bold text-slate-700">{caseItem.ownerName}</span>
                   </div>
                   <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">OWNER</span>
                </div>
                {assignedUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between group">
                     <div className="flex items-center gap-2">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${u.avatarColor || 'bg-slate-400'}`}>
                          {u.name.charAt(0)}
                       </div>
                       <span className="text-xs font-medium text-slate-600">{u.name}</span>
                     </div>
                  </div>
                ))}
             </div>
          </div>
      </div>

      <div ref={fileSectionRef} className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-800">Case Files</h3>
        <button 
          onClick={() => fileInputRef.current?.click()} 
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <UploadIcon className="w-4 h-4" />
          Upload Document
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm min-h-[400px] p-6">
         <div className="space-y-1">
           {Object.keys(treeData).length === 0 ? (
              <p className="text-sm text-slate-500 italic text-center py-20">No documents uploaded to this case yet.</p>
           ) : (
              Object.keys(treeData).sort().map(key => (
                 <FileTreeItem 
                    key={treeData[key].path} 
                    node={treeData[key]} 
                    level={0} 
                    onOpenDoc={onOpenDoc} 
                    onDeleteDoc={onDeleteDoc} 
                    onUpdateStatus={onUpdateDocStatus}
                 />
              ))
           )}
         </div>
      </div>
    </div>
  );
};

export default CaseDetails;
