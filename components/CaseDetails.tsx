
import React, { useRef, useState, useEffect, lazy, Suspense } from 'react';
import {
  FileTextIcon,
  UploadIcon,
  FolderIcon,
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
  LayoutTemplateIcon,
  ShieldIcon,
  FolderPlusIcon,
  GripVerticalIcon,
  VideoIcon,
  ImageIcon,
  FileIcon,
  ScanIcon,
  DollarSignIcon,
  AlertTriangleIcon,
  Loader2Icon,
  HardDriveIcon,
  FolderOpenIcon,
  MaximizeIcon,
  CameraIcon,
  LayersIcon,
  CheckSquareIcon,
  SquareIcon
} from 'lucide-react';
import { Case, Document, AuthorizedUser, UserProfile, Client, ReviewStatus, BillingEntry } from '../types';

const DicomStudyViewerComponent = lazy(() => import('./DicomStudyViewer'));
const DicomStudyViewerLazy: React.FC<{
  files: File[];
  onClose: () => void;
  onSaveAnnotation?: (data: any) => void;
  caseId: string;
  authorName: string;
}> = (props) => (
  <Suspense fallback={<div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center"><Loader2Icon className="w-10 h-10 text-cyan-400 animate-spin" /></div>}>
    <DicomStudyViewerComponent {...props} />
  </Suspense>
);

interface CaseDetailsProps {
  caseItem: Case;
  docs: Document[];
  currentUser: UserProfile;
  allUsers: AuthorizedUser[];
  onAssignUser: (caseId: string, userId: string) => void;
  onRemoveUser: (caseId: string, userId: string) => void;
  onOpenDoc: (doc: Document) => void;
  onUpload: (caseId: string, file: File) => void;
  onUploadFolder: (caseId: string, files: FileList | File[]) => void;
  onUpdateCase: (updatedCase: Case) => Promise<void> | void;
  onDeleteDoc: (docId: string) => void;
  onUpdateDocStatus: (docId: string, status: ReviewStatus) => void;
  onUpdateDoc: (doc: Document) => void;
  onOpenAnalysis: () => void;
  onDicomDriveUpload?: (caseId: string, files: File[]) => Promise<void>;
  onSaveDicomAnnotation?: (data: { imageUrl: string; text: string; studyName: string; studyDate: string; patientInfo: string }) => void;
  googleAccessToken?: string | null;
  onRequestDriveAuth?: () => Promise<string | null>;
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
  onRenameFile?: (docId: string, newName: string) => void;
  onRenameFolder?: (folderPath: string, newName: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onDragStartDoc?: (e: React.DragEvent, docId: string) => void;
  onDropOnFolder?: (e: React.DragEvent, folderPath: string) => void;
}> = ({ node, level, onOpenDoc, onDeleteDoc, onUpdateStatus, onRenameFile, onRenameFolder, onDeleteFolder, onDragStartDoc, onDropOnFolder }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === node.name) {
      setIsRenaming(false);
      setRenameValue(node.name);
      return;
    }
    if (node.type === 'file' && node.doc && onRenameFile) {
      onRenameFile(node.doc.id, trimmed);
    } else if (node.type === 'folder' && onRenameFolder) {
      onRenameFolder(node.path, trimmed);
    }
    setIsRenaming(false);
  };

  if (node.type === 'file' && node.doc) {
    const statusColor = {
      'pending': 'text-slate-300',
      'in_review': 'text-amber-500',
      'reviewed': 'text-green-500'
    };

    return (
      <div
        draggable
        onDragStart={(e) => onDragStartDoc?.(e, node.doc!.id)}
        className="flex items-center gap-3 py-2 px-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group"
        style={{ paddingLeft: `${level * 20}px` }}
        onClick={() => !isRenaming && onOpenDoc(node.doc!)}
      >
        <GripVerticalIcon className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0" />
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm shrink-0 ${
          node.doc.type === 'video' ? 'bg-purple-50 border-purple-100 text-purple-500' :
          node.doc.type === 'image' ? 'bg-emerald-50 border-emerald-100 text-emerald-500' :
          node.doc.type === 'dicom' ? 'bg-cyan-50 border-cyan-100 text-cyan-600' :
          node.doc.type === 'other' ? 'bg-slate-50 border-slate-200 text-slate-500' :
          node.doc.category === 'research' ? 'bg-indigo-50 border-indigo-100 text-indigo-500' : 'bg-white border-slate-100 text-red-500'
        }`}>
          {node.doc.type === 'video' ? <VideoIcon className="w-4 h-4" /> :
           node.doc.type === 'image' ? <ImageIcon className="w-4 h-4" /> :
           node.doc.type === 'dicom' ? <ScanIcon className="w-4 h-4" /> :
           node.doc.type === 'other' ? <FileIcon className="w-4 h-4" /> :
           <FileTextIcon className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              ref={renameRef}
              className="text-sm font-semibold text-slate-700 bg-white border border-indigo-300 rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(node.name); } }}
              onBlur={handleRenameSubmit}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 truncate">{node.name}</p>
          )}
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>{node.doc.size}</span>
            {node.doc.uploadDate && (() => {
              try {
                const dt = new Date(node.doc!.uploadDate);
                if (!isNaN(dt.getTime())) {
                  return <span className="whitespace-nowrap">• {dt.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}</span>;
                }
              } catch {
                /* ignore parse errors */
              }
              return null;
            })()}
            <CheckCircle2Icon className="w-3 h-3 text-slate-400" />
          </div>
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setRenameValue(node.name); setIsRenaming(true); }}
            className="p-1 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded opacity-0 group-hover:opacity-100 transition-all"
            title="Rename"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
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

  const hasChildren = Object.keys(node.children).length > 0;

  return (
    <div className="group/folder">
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors select-none ${isDragOver ? 'bg-indigo-50 ring-2 ring-indigo-300' : 'hover:bg-slate-50 text-slate-600'}`}
        style={{ paddingLeft: `${level * 20}px` }}
        onClick={() => !isRenaming && setIsOpen(!isOpen)}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); onDropOnFolder?.(e, node.path); }}
      >
        {isOpen ? <ChevronDownIcon className="w-4 h-4 text-slate-400" /> : <ChevronRightIcon className="w-4 h-4 text-slate-400" />}
        <FolderTreeIcon className={`w-4 h-4 ${isDragOver ? 'text-indigo-600' : 'text-indigo-400'}`} />
        {isRenaming ? (
          <input
            ref={renameRef}
            className="text-sm font-bold bg-white border border-indigo-300 rounded px-2 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(node.name); } }}
            onBlur={handleRenameSubmit}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm font-bold truncate flex-1">{node.name}</span>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover/folder:opacity-100 transition-all" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setRenameValue(node.name); setIsRenaming(true); }}
            className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded"
            title="Rename folder"
          >
            <PencilIcon className="w-3 h-3" />
          </button>
          {!hasChildren && onDeleteFolder && (
            <button
              onClick={() => onDeleteFolder(node.path)}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
              title="Delete empty folder"
            >
              <Trash2Icon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {isOpen && (
        <div className="border-l border-slate-100 ml-4">
          {Object.keys(node.children)
            .sort((a, b) => {
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
                onRenameFile={onRenameFile}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                onDragStartDoc={onDragStartDoc}
                onDropOnFolder={onDropOnFolder}
              />
            ))}
        </div>
      )}
    </div>
  );
};

const CaseDetails: React.FC<CaseDetailsProps> = ({
  caseItem, docs, onOpenDoc, onUpload, onUploadFolder, onUpdateCase, onDeleteDoc,
  currentUser, allUsers, onAssignUser, onRemoveUser, onUpdateDocStatus, onUpdateDoc, onOpenAnalysis,
  onDicomDriveUpload, onSaveDicomAnnotation, googleAccessToken, onRequestDriveAuth
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dicomFolderInputRef = useRef<HTMLInputElement>(null);
  const dicomDriveFolderInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = folderInputRef.current;
    if (el) el.setAttribute('webkitdirectory', '');
    const dicomEl = dicomFolderInputRef.current;
    if (dicomEl) dicomEl.setAttribute('webkitdirectory', '');
    const dicomDriveEl = dicomDriveFolderInputRef.current;
    if (dicomDriveEl) dicomDriveEl.setAttribute('webkitdirectory', '');
  }, []);

  // DICOM viewer state
  const [showDicomViewer, setShowDicomViewer] = useState(false);
  const [dicomViewerFiles, setDicomViewerFiles] = useState<File[]>([]);
  const [localDicomStudies, setLocalDicomStudies] = useState<{ name: string; files: File[]; selected: boolean }[]>([]);
  const [isDicomUploading, setIsDicomUploading] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editTitle, setEditTitle] = useState(caseItem.title);
  const [editDescription, setEditDescription] = useState(caseItem.description);
  const [editStartDate, setEditStartDate] = useState(caseItem.startDate || caseItem.createdAt);
  const [editPrimaryLawyer, setEditPrimaryLawyer] = useState(caseItem.primaryLawyer || '');
  const [editStatus, setEditStatus] = useState(caseItem.status);
 
  // Ensure modal fields reflect the latest case values when opening the edit modal
  useEffect(() => {
    if (isEditingMetadata) {
      setEditTitle(caseItem.title || '');
      setEditDescription(caseItem.description || '');
      setEditStartDate(caseItem.startDate || caseItem.createdAt || new Date().toISOString());
      setEditPrimaryLawyer(caseItem.primaryLawyer || '');
      setEditStatus(caseItem.status || 'active');
    }
  }, [isEditingMetadata, caseItem]);

  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState<Partial<Client>>({ role: 'Plaintiff' });
  const [customRole, setCustomRole] = useState('');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editClientData, setEditClientData] = useState<Partial<Client>>({});

  // Billing state
  const [showAddBilling, setShowAddBilling] = useState(false);
  const [newBillingType, setNewBillingType] = useState<'retainer' | 'work'>('work');
  const [newBillingDesc, setNewBillingDesc] = useState('');
  const [newBillingHours, setNewBillingHours] = useState('');
  const [newBillingDate, setNewBillingDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingBillingId, setEditingBillingId] = useState<string | null>(null);
  const [editBillingData, setEditBillingData] = useState<Partial<BillingEntry>>({});

  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedAssignUserId, setSelectedAssignUserId] = useState('');
  const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);

  // Folder management state
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);

  const canManageTeam = currentUser.role === 'ADMIN' || currentUser.id === caseItem.ownerId;
  const fileSectionRef = useRef<HTMLDivElement>(null);
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);
  const externalDragCounter = useRef(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (files.length === 1) {
        onUpload(caseItem.id, files[0]);
      } else {
        onUploadFolder(caseItem.id, files);
      }
    }
    e.target.value = '';
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUploadFolder(caseItem.id, files);
    }
    e.target.value = '';
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

  const handleAddClient = async (roleOverride?: string) => {
    if (!newClient.name || !newClient.email) return;
    const client: Client = {
      id: Date.now().toString(),
      name: newClient.name,
      email: newClient.email,
      phone: newClient.phone || '',
      role: (roleOverride || newClient.role) as any || 'Plaintiff'
    };

    // Check if a platform user matches this client's email
    const matchingUser = allUsers.find(u => u.email.toLowerCase() === client.email.toLowerCase());

    const updatedCase = {
      ...caseItem,
      clients: [...(caseItem.clients || []), client]
    };

    if (matchingUser) {
      // User exists in system - add their UID to assignedUserIds
      const currentIds = caseItem.assignedUserIds || [];
      if (!currentIds.includes(matchingUser.id) && matchingUser.id !== caseItem.ownerId) {
        updatedCase.assignedUserIds = [...currentIds, matchingUser.id];
      }
    } else {
      // User doesn't exist yet - add email to assignedUserEmails for pre-authorization
      const currentEmails = caseItem.assignedUserEmails || [];
      const emailLower = client.email.toLowerCase();
      if (!currentEmails.includes(emailLower)) {
        updatedCase.assignedUserEmails = [...currentEmails, emailLower];
      }

      // Invitation email intentionally disabled for client roster additions
    }

    onUpdateCase(updatedCase);
    setNewClient({ role: 'Plaintiff' });
    setCustomRole('');
    setShowAddClient(false);
  };

  const handleRemoveClient = (id: string) => {
    onUpdateCase({
      ...caseItem,
      clients: (caseItem.clients || []).filter(c => c.id !== id)
    });
  };

  const handleAddTeamMember = () => {
    if (!selectedAssignUserId) return;
    onAssignUser(caseItem.id, selectedAssignUserId);
    setSelectedAssignUserId('');
    setIsAssigning(false);
  };

  const handleRemoveTeamMember = (userId: string) => {
    onRemoveUser(caseItem.id, userId);
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const updatedFolders = [...(caseItem.virtualFolders || []), name];
    onUpdateCase({ ...caseItem, virtualFolders: updatedFolders });
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const handleRenameFile = (docId: string, newName: string) => {
    const doc = docs.find(d => d.id === docId);
    if (doc) onUpdateDoc({ ...doc, name: newName });
  };

  const handleRenameFolder = (oldPath: string, newName: string) => {
    const parts = oldPath.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');
    // Update virtualFolders
    const updatedFolders = (caseItem.virtualFolders || []).map(f =>
      f === oldPath ? newPath : f.startsWith(oldPath + '/') ? newPath + f.slice(oldPath.length) : f
    );
    onUpdateCase({ ...caseItem, virtualFolders: updatedFolders });
    // Update all docs that were inside this folder
    docs.forEach(doc => {
      const docFolder = (doc.path || '').replace(/^\/+|\/+$/g, '');
      if (docFolder === oldPath || docFolder.startsWith(oldPath + '/')) {
        const updatedDocPath = newPath + docFolder.slice(oldPath.length);
        onUpdateDoc({ ...doc, path: '/' + updatedDocPath });
      }
    });
  };

  const handleDeleteFolder = (folderPath: string) => {
    const updatedFolders = (caseItem.virtualFolders || []).filter(f => f !== folderPath && !f.startsWith(folderPath + '/'));
    onUpdateCase({ ...caseItem, virtualFolders: updatedFolders });
  };

  const handleDragStartDoc = (e: React.DragEvent, docId: string) => {
    setDraggedDocId(docId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', docId);
  };

  const handleDropOnFolder = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    const docId = e.dataTransfer.getData('text/plain') || draggedDocId;
    if (!docId) return;
    const doc = docs.find(d => d.id === docId);
    if (doc) {
      onUpdateDoc({ ...doc, path: '/' + folderPath });
    }
    setDraggedDocId(null);
  };

  // --- Billing handlers ---
  const billingEntries = caseItem.billingEntries || [];
  const totalBilled = billingEntries.filter(e => e.type === 'retainer').reduce((s, e) => s + e.hours, 0);
  const totalWorked = billingEntries.filter(e => e.type === 'work').reduce((s, e) => s + e.hours, 0);
  const balance = totalBilled - totalWorked;
  const unpaidHours = billingEntries.filter(e => e.type === 'retainer' && !e.fundsReceived).reduce((s, e) => s + e.hours, 0);

  const handleAddBillingEntry = () => {
    const hours = parseFloat(newBillingHours);
    if (!newBillingDesc.trim() || isNaN(hours) || hours <= 0) return;
    const entry: BillingEntry = {
      id: Date.now().toString(),
      type: newBillingType,
      description: newBillingDesc.trim(),
      hours,
      date: newBillingDate,
      createdBy: currentUser.id,
      createdByName: currentUser.name
    };
    onUpdateCase({ ...caseItem, billingEntries: [...billingEntries, entry] });
    setNewBillingDesc('');
    setNewBillingHours('');
    setNewBillingDate(new Date().toISOString().split('T')[0]);
    setShowAddBilling(false);
  };

  const handleDeleteBillingEntry = (entryId: string) => {
    onUpdateCase({ ...caseItem, billingEntries: billingEntries.filter(e => e.id !== entryId) });
  };

  const handleToggleFundsReceived = (entryId: string) => {
    const updated = billingEntries.map(e => {
      if (e.id !== entryId) return e;
      return { ...e, fundsReceived: !e.fundsReceived, fundsReceivedDate: !e.fundsReceived ? new Date().toISOString().split('T')[0] : undefined };
    });
    onUpdateCase({ ...caseItem, billingEntries: updated });
  };

  const handleSaveBillingEdit = (entryId: string) => {
    const updated = billingEntries.map(e => {
      if (e.id !== entryId) return e;
      return { ...e, ...editBillingData } as BillingEntry;
    });
    onUpdateCase({ ...caseItem, billingEntries: updated });
    setEditingBillingId(null);
    setEditBillingData({});
  };

  // ===== DICOM handlers =====
  const handleDicomLocalFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files).filter(f => !f.name.startsWith('.') && f.size > 0);
    if (fileArr.length === 0) return;
    // Group by top-level folder
    const folderMap = new Map<string, File[]>();
    for (const file of fileArr) {
      const relPath = (file as any).webkitRelativePath || file.name;
      const parts = relPath.split('/');
      const topFolder = parts.length >= 2 ? parts[0] : 'DICOM Files';
      if (!folderMap.has(topFolder)) folderMap.set(topFolder, []);
      folderMap.get(topFolder)!.push(file);
    }
    const studies = Array.from(folderMap.entries()).map(([name, files]) => ({
      name,
      files,
      selected: true,
    }));
    setLocalDicomStudies(prev => [...prev, ...studies]);
    e.target.value = '';
  };

  const handleDicomDriveFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files).filter(f => !f.name.startsWith('.') && f.size > 0);
    if (fileArr.length === 0) return;

    if (onDicomDriveUpload) {
      setIsDicomUploading(true);
      try {
        await onDicomDriveUpload(caseItem.id, fileArr);
        // Also add to local studies for immediate viewing
        const folderMap = new Map<string, File[]>();
        for (const file of fileArr) {
          const relPath = (file as any).webkitRelativePath || file.name;
          const parts = relPath.split('/');
          const topFolder = parts.length >= 2 ? parts[0] : 'DICOM Files';
          if (!folderMap.has(topFolder)) folderMap.set(topFolder, []);
          folderMap.get(topFolder)!.push(file);
        }
        const studies = Array.from(folderMap.entries()).map(([name, files]) => ({
          name,
          files,
          selected: true,
        }));
        setLocalDicomStudies(prev => [...prev, ...studies]);
      } catch (err) {
        console.error('DICOM Drive upload failed:', err);
      } finally {
        setIsDicomUploading(false);
      }
    }
    e.target.value = '';
  };

  const toggleDicomStudySelection = (index: number) => {
    setLocalDicomStudies(prev => prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s));
  };

  const removeDicomStudy = (index: number) => {
    setLocalDicomStudies(prev => prev.filter((_, i) => i !== index));
  };

  const openDicomViewer = () => {
    const selectedFiles = localDicomStudies
      .filter(s => s.selected)
      .flatMap(s => s.files);
    if (selectedFiles.length === 0) {
      alert('Please select at least one DICOM study to view.');
      return;
    }
    setDicomViewerFiles(selectedFiles);
    setShowDicomViewer(true);
  };

  // Count existing DICOM docs in the case
  const dicomDocs = docs.filter(d => d.type === 'dicom');

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
    // Include virtual (empty) folders
    (caseItem.virtualFolders || []).forEach(folderPath => {
      const parts = folderPath.split('/');
      let currentLevel = root;
      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!currentLevel[part]) {
          currentLevel[part] = { name: part, type: 'folder', path: currentPath, children: {} };
        }
        currentLevel = currentLevel[part].children;
      });
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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Case Title & Description */}
          <div className="lg:col-span-2">
            <div className="relative group">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">CASE ID: {caseItem.id}</span>
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${caseItem.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  caseItem.status === 'planning' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                  }`}>{caseItem.status.replace('_', ' ')}</span>
                {canManageTeam && (
                  <button onClick={() => setIsEditingMetadata(true)} className="text-slate-400 hover:text-indigo-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <h2 className="text-4xl font-serif font-black text-slate-900 mb-2">{caseItem.title}</h2>
              <div className="max-w-2xl">
                <div className="text-slate-600 leading-relaxed max-h-32 overflow-y-auto pr-2 whitespace-pre-wrap">
                  {caseItem.description}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Billing & Hours Tracker */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <DollarSignIcon className="w-4 h-4" /> Billing & Hours
              </h3>
              <button onClick={() => setShowAddBilling(!showAddBilling)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                {showAddBilling ? <XIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
              </button>
            </div>

            {/* Balance Summary */}
            <div className="grid grid-cols-4 gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billed</p>
                <p className="text-lg font-black text-slate-700">{totalBilled}<span className="text-xs font-medium text-slate-400 ml-0.5">hrs</span></p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Worked</p>
                <p className="text-lg font-black text-slate-700">{totalWorked}<span className="text-xs font-medium text-slate-400 ml-0.5">hrs</span></p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Balance</p>
                <p className={`text-lg font-black ${balance < 0 ? 'text-red-600' : balance > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {balance > 0 ? '+' : ''}{balance}<span className="text-xs font-medium ml-0.5">hrs</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unpaid</p>
                <p className={`text-lg font-black ${unpaidHours > 0 ? 'text-amber-600' : 'text-slate-700'}`}>{unpaidHours}<span className="text-xs font-medium ml-0.5">hrs</span></p>
              </div>
            </div>
            {balance < 0 && (
              <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <AlertTriangleIcon className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <p className="text-[11px] font-bold text-red-700">Physician has worked {Math.abs(balance)} hrs beyond billed hours — additional billing needed</p>
              </div>
            )}

            {/* Add Entry Form */}
            {showAddBilling && (
              <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-2 animate-in slide-in-from-top-2 duration-200">
                <div className="flex gap-2">
                  <select
                    className="text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-white"
                    value={newBillingType}
                    onChange={(e) => setNewBillingType(e.target.value as 'retainer' | 'work')}
                  >
                    <option value="work">Hours Worked</option>
                    <option value="retainer">Hours Billed / Retainer</option>
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="w-20 text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                    placeholder="Hours"
                    value={newBillingHours}
                    onChange={(e) => setNewBillingHours(e.target.value)}
                  />
                  <input
                    type="date"
                    className="text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                    value={newBillingDate}
                    onChange={(e) => setNewBillingDate(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                    placeholder={newBillingType === 'retainer' ? 'e.g., Initial 5-hour retainer' : 'e.g., Document review & analysis'}
                    value={newBillingDesc}
                    onChange={(e) => setNewBillingDesc(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddBillingEntry(); }}
                  />
                  <button
                    onClick={handleAddBillingEntry}
                    className="bg-indigo-600 text-white px-4 py-1 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Billing Entries Table */}
            <div className="flex-1 overflow-y-auto max-h-64">
              {billingEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                  <DollarSignIcon className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs italic">No billing entries yet.</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      <th className="px-4 py-2 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Description</th>
                      <th className="px-2 py-2 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Hours</th>
                      <th className="px-2 py-2 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Date</th>
                      <th className="px-2 py-2 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Funds Rec'd</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[...billingEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors group/row">
                        {editingBillingId === entry.id ? (
                          <>
                            <td className="px-4 py-2">
                              <input className="w-full text-xs p-1 border border-slate-200 rounded" value={editBillingData.description || ''} onChange={(e) => setEditBillingData(prev => ({ ...prev, description: e.target.value }))} />
                            </td>
                            <td className="px-2 py-2">
                              <input type="number" step="0.5" className="w-16 text-xs p-1 border border-slate-200 rounded" value={editBillingData.hours || ''} onChange={(e) => setEditBillingData(prev => ({ ...prev, hours: parseFloat(e.target.value) }))} />
                            </td>
                            <td className="px-2 py-2">
                              <input type="date" className="text-xs p-1 border border-slate-200 rounded" value={editBillingData.date || ''} onChange={(e) => setEditBillingData(prev => ({ ...prev, date: e.target.value }))} />
                            </td>
                            <td className="px-2 py-2">
                              <button onClick={() => handleSaveBillingEdit(entry.id)} className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold">Save</button>
                              <button onClick={() => { setEditingBillingId(null); setEditBillingData({}); }} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold ml-1">Cancel</button>
                            </td>
                            <td></td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${entry.type === 'retainer' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                                <span className="font-medium text-slate-700 truncate">{entry.description}</span>
                                <span className={`text-[8px] font-black px-1 py-0.5 rounded border uppercase tracking-tighter shrink-0 ${entry.type === 'retainer' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                  {entry.type === 'retainer' ? 'BILLED' : 'WORK'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 ml-3.5">{entry.createdByName}</p>
                            </td>
                            <td className="px-2 py-2 font-bold text-slate-700">{entry.hours}</td>
                            <td className="px-2 py-2 text-slate-500 whitespace-nowrap">
                              {(() => { try { const d = new Date(entry.date + 'T00:00:00'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return entry.date; } })()}
                            </td>
                            <td className="px-2 py-2">
                              {entry.type === 'retainer' ? (
                                <button
                                  onClick={() => handleToggleFundsReceived(entry.id)}
                                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${entry.fundsReceived ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600'}`}
                                >
                                  {entry.fundsReceived ? <CheckIcon className="w-3 h-3" /> : <ClockIcon className="w-3 h-3" />}
                                  {entry.fundsReceived ? (
                                    <span>{(() => { try { const d = new Date(entry.fundsReceivedDate + 'T00:00:00'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return 'Paid'; } })()}</span>
                                  ) : 'Pending'}
                                </button>
                              ) : (
                                <span className="text-slate-300 text-[10px]">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-all">
                                <button
                                  onClick={() => { setEditingBillingId(entry.id); setEditBillingData(entry); }}
                                  className="p-1 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded"
                                  title="Edit"
                                >
                                  <PencilIcon className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteBillingEntry(entry.id)}
                                  className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded"
                                  title="Delete"
                                >
                                  <Trash2Icon className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {isEditingMetadata && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <PencilIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Edit Case Details</h3>
                  <p className="text-xs text-slate-500">Update case information below</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingMetadata(false)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Case Title */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Case Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Description / Summary
                </label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Case Start Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Case Start Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 transition-all text-slate-600"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 transition-all text-slate-600 appearance-none cursor-pointer"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditingMetadata(false)}
                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMetadata}
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all translate-y-0 hover:-translate-y-0.5"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Pillar 1: Client Roster */}
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
            <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-2 animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 gap-2">
                <input className="text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" placeholder="Name" value={newClient.name || ''} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
                <input className="text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" placeholder="Email" value={newClient.email || ''} onChange={e => setNewClient({ ...newClient, email: e.target.value })} />
              </div>
              <input className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" placeholder="Phone (optional)" type="tel" value={newClient.phone || ''} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <select
                  className="text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 col-span-2"
                  value={newClient.role === 'Other' ? 'Other' : (newClient.role || 'Plaintiff')}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'Other') {
                      setNewClient({ ...newClient, role: 'Other' });
                      setCustomRole('');
                    } else {
                      setNewClient({ ...newClient, role: val as any });
                      setCustomRole('');
                    }
                  }}
                >
                  <option value="Plaintiff">Plaintiff</option>
                  <option value="Defendant">Defendant</option>
                  <option value="Lawyer">Lawyer</option>
                  <option value="Petitioner">Petitioner</option>
                  <option value="Respondent">Respondent</option>
                  <option value="Intervenor">Intervenor</option>
                  <option value="Amicus">Amicus</option>
                  <option value="Third-Party Defendant">Third-Party Defendant</option>
                  <option value="Claimant">Claimant</option>
                  <option value="Other">Other (specify)</option>
                </select>
                <button
                  onClick={() => {
                    if (newClient.role === 'Other') {
                      if (!customRole.trim()) {
                        alert('Please specify the role for "Other".');
                        return;
                      }
                      handleAddClient(customRole.trim());
                      return;
                    }
                    handleAddClient();
                  }}
                  className="bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all"
                >
                  Add
                </button>
              </div>
              {newClient.role === 'Other' && (
                <input
                  className="w-full text-xs p-2 border border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-500 bg-indigo-50"
                  placeholder="Specify role (e.g., Expert Witness, Consultant)"
                  value={customRole}
                  onChange={e => setCustomRole(e.target.value)}
                />
              )}
            </div>
          )}

          <div className="divide-y divide-slate-100 flex-1 min-h-[150px]">
            {(caseItem.clients || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-slate-300">
                <UsersIcon className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs italic">No clients added yet.</p>
              </div>
            ) : (
              (caseItem.clients || []).map(client => (
                <div key={client.id} className="p-3 px-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  {editingClientId === client.id ? (
                    <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                      <input
                        className="col-span-5 text-sm p-2 border border-slate-200 rounded-lg"
                        value={editClientData.name || ''}
                        onChange={(e) => setEditClientData(prev => ({ ...prev, name: e.target.value }))}
                      />
                      <input
                        className="col-span-4 text-sm p-2 border border-slate-200 rounded-lg"
                        value={editClientData.email || ''}
                        onChange={(e) => setEditClientData(prev => ({ ...prev, email: e.target.value }))}
                      />
                      <select
                        className="col-span-2 text-sm p-2 border border-slate-200 rounded-lg"
                        value={editClientData.role || client.role}
                        onChange={(e) => setEditClientData(prev => ({ ...prev, role: e.target.value as any }))}
                      >
                        <option value="Plaintiff">Plaintiff</option>
                        <option value="Defendant">Defendant</option>
                        <option value="Lawyer">Lawyer</option>
                        <option value="Other">Other</option>
                      </select>
                      <div className="col-span-1 flex gap-1">
                        <button
                          onClick={() => {
                            // Save edits
                            const updatedClients = (caseItem.clients || []).map(c => c.id === client.id ? { ...c, ...editClientData } as Client : c);
                            onUpdateCase({ ...caseItem, clients: updatedClients });
                            setEditingClientId(null);
                            setEditClientData({});
                          }}
                          className="px-2 py-1 bg-indigo-600 text-white rounded text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingClientId(null); setEditClientData({}); }}
                          className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-700">{client.name}</p>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${client.role === 'Plaintiff' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            client.role === 'Lawyer' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                              'bg-slate-50 text-slate-500 border-slate-100'
                            }`}>
                            {client.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{client.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingClientId(client.id); setEditClientData(client); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          title="Edit client"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleRemoveClient(client.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all" title="Remove client">
                          <Trash2Icon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pillar 2: Team Access */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldIcon className="w-4 h-4" /> Team Access
            </h3>
            {canManageTeam && (
              <button onClick={() => setIsAssigning(!isAssigning)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                {isAssigning ? <XIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
              </button>
            )}
          </div>

          {isAssigning && (
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex gap-2 animate-in slide-in-from-top-2 duration-200">
              <select
                className="flex-1 text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-white"
                value={selectedAssignUserId}
                onChange={(e) => setSelectedAssignUserId(e.target.value)}
              >
                <option value="">Select member to assign...</option>
                {assignableUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
                {assignableUsers.length === 0 && <option disabled>No other members available</option>}
              </select>
              <button
                onClick={handleAddTeamMember}
                disabled={!selectedAssignUserId}
                className="bg-indigo-600 text-white px-4 py-1 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
              >
                Assign
              </button>
            </div>
          )}

          <div className="divide-y divide-slate-100 flex-1 min-h-[150px]">
            {/* Case Owner */}
            <div className="p-3 px-4 flex items-center justify-between bg-white group/owner">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-100">
                  {caseItem.ownerName ? caseItem.ownerName.charAt(0) : 'O'}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{caseItem.ownerName}</p>
                  <p className="text-[10px] text-slate-400 font-medium">Case Owner</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-tighter">Owner</span>
                {canManageTeam && (
                  <button
                    onClick={() => setIsTransferringOwnership(!isTransferringOwnership)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg opacity-0 group-hover/owner:opacity-100 transition-all"
                    title="Transfer Ownership"
                  >
                    <ArrowRightLeftIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Ownership Transfer UI */}
            {isTransferringOwnership && canManageTeam && (
              <div className="p-4 bg-amber-50 border-b border-amber-100 animate-in slide-in-from-top-2 duration-200">
                <p className="text-xs font-bold text-amber-900 mb-2 uppercase tracking-wider">Transfer Ownership</p>
                <p className="text-xs text-amber-700 mb-3">Select new owner for this case. Current owner will become a team member.</p>
                <div className="flex gap-2">
                  <select
                    className="flex-1 text-xs p-2 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-400 bg-white"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value && confirm(`Transfer ownership to ${potentialOwners.find(u => u.id === e.target.value)?.name}?`)) {
                        const newOwner = potentialOwners.find(u => u.id === e.target.value);
                        if (newOwner) {
                          // Transfer ownership
                          onUpdateCase({
                            ...caseItem,
                            ownerId: newOwner.id,
                            ownerName: newOwner.name,
                            assignedUserIds: [
                              ...(caseItem.assignedUserIds || []).filter(id => id !== newOwner.id),
                              caseItem.ownerId // Add old owner to team
                            ].filter(Boolean)
                          });
                          setIsTransferringOwnership(false);
                        }
                      }
                      e.target.value = '';
                    }}
                  >
                    <option value="">Select new owner...</option>
                    {potentialOwners.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setIsTransferringOwnership(false)}
                    className="px-3 py-1 text-xs bg-white border border-amber-200 rounded-lg hover:bg-amber-50 font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Assigned Users */}
            {assignedUsers.map(u => (
              <div key={u.id} className="p-3 px-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${u.avatarColor || 'bg-slate-400'}`}>
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">{u.name}</p>
                    <p className="text-[10px] text-slate-400">{u.role === 'ADMIN' ? 'Team Administrator' : 'Expert Physician'}</p>
                  </div>
                </div>
                <button onClick={() => handleRemoveTeamMember(u.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2Icon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {assignedUsers.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-[10px] text-slate-300 italic">No additional team members assigned.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={fileSectionRef} className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-serif font-black text-slate-800">Case Files</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <UploadIcon className="w-4 h-4" />
            Upload Files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <FolderIcon className="w-4 h-4" />
            Upload Folder
          </button>
          <button
            onClick={() => setShowNewFolderInput(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-600 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all shadow-lg shadow-slate-100"
          >
            <FolderPlusIcon className="w-4 h-4" />
            New Folder
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFolderChange}
            className="hidden"
            multiple
          />
        </div>
      </div>

      <div
        className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm min-h-[400px] p-6 transition-all ${isExternalDragOver ? 'border-cyan-400 bg-cyan-50/30 ring-2 ring-cyan-200' : 'border-slate-200'}`}
        onDragEnter={(e) => {
          e.preventDefault();
          externalDragCounter.current++;
          // Only show external drop zone if dragging files from OS (not internal doc reorder)
          if (e.dataTransfer.types.includes('Files')) setIsExternalDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          externalDragCounter.current--;
          if (externalDragCounter.current <= 0) { setIsExternalDragOver(false); externalDragCounter.current = 0; }
        }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes('Files') ? 'copy' : 'move'; }}
        onDrop={(e) => {
          e.preventDefault();
          externalDragCounter.current = 0;
          setIsExternalDragOver(false);
          // Check if this is an external file drop (from OS)
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).filter(f => !f.name.startsWith('.') && f.size > 0);
            if (files.length === 0) {
              alert('No valid files found. Please drop files to upload.');
              return;
            }
            if (files.length === 1) {
              onUpload(caseItem.id, files[0]);
            } else {
              onUploadFolder(caseItem.id, files);
            }
            return;
          }
          // Internal doc reorder (drag between folders)
          const docId = e.dataTransfer.getData('text/plain') || draggedDocId;
          if (docId) {
            const doc = docs.find(d => d.id === docId);
            if (doc) onUpdateDoc({ ...doc, path: '/' });
          }
          setDraggedDocId(null);
        }}
      >
        {/* External drag overlay */}
        {isExternalDragOver && (
          <div className="flex flex-col items-center justify-center py-12 mb-4 border-2 border-dashed border-cyan-400 rounded-xl bg-cyan-50/50 pointer-events-none">
            <UploadIcon className="w-10 h-10 text-cyan-500 mb-3" />
            <p className="text-sm font-bold text-cyan-700">Drop files here to upload</p>
            <p className="text-xs text-cyan-500 mt-1">PDFs, images, videos, DICOM imaging, and all file types</p>
          </div>
        )}
        {showNewFolderInput && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-200">
            <FolderPlusIcon className="w-4 h-4 text-indigo-500 shrink-0" />
            <input
              autoFocus
              className="flex-1 text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); } }}
            />
            <button onClick={handleCreateFolder} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all">Create</button>
            <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="space-y-1">
          {Object.keys(treeData).length === 0 && !showNewFolderInput ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UploadIcon className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-sm font-bold text-slate-500 mb-1">No documents uploaded yet</p>
              <p className="text-xs text-slate-400 mb-4">Drag & drop PDF files here, or use the buttons above</p>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                <UploadIcon className="w-4 h-4 text-slate-400" />
                <span className="text-[11px] text-slate-500">Drop files or folders anywhere in this area</span>
              </div>
            </div>
          ) : (
            Object.keys(treeData).sort((a, b) => {
              const nodeA = treeData[a];
              const nodeB = treeData[b];
              if (nodeA.type !== nodeB.type) return nodeA.type === 'folder' ? -1 : 1;
              return a.localeCompare(b);
            }).map(key => (
              <FileTreeItem
                key={treeData[key].path}
                node={treeData[key]}
                level={0}
                onOpenDoc={onOpenDoc}
                onDeleteDoc={onDeleteDoc}
                onUpdateStatus={onUpdateDocStatus}
                onRenameFile={handleRenameFile}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onDragStartDoc={handleDragStartDoc}
                onDropOnFolder={handleDropOnFolder}
              />
            ))
          )}
        </div>
        {Object.keys(treeData).length > 0 && !isExternalDragOver && (
          <p className="text-center text-[10px] text-slate-400 mt-4 pt-3 border-t border-dashed border-slate-200">
            Drag & drop PDF files here to add more documents
          </p>
        )}
      </div>

      {/* ===== DICOM Studies Section ===== */}
      <div className="mt-10 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-serif font-black text-slate-800 flex items-center gap-2">
              <ScanIcon className="w-5 h-5 text-cyan-600" />
              DICOM Medical Imaging
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Upload DICOM folders from your computer or link from Google Drive — opens in a full-screen viewer
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm">
          {/* Upload buttons */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => dicomDriveFolderInputRef.current?.click()}
                disabled={isDicomUploading}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-xl font-bold text-sm hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-100 disabled:opacity-50"
              >
                <HardDriveIcon className="w-4 h-4" />
                {isDicomUploading ? 'Uploading to Drive...' : 'Link Drive & Upload DICOM'}
              </button>
              <button
                onClick={() => dicomFolderInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-600 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all shadow-lg shadow-slate-100"
              >
                <FolderOpenIcon className="w-4 h-4" />
                Upload Local DICOM Folder
              </button>
              {localDicomStudies.some(s => s.selected) && (
                <button
                  onClick={openDicomViewer}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 ml-auto"
                >
                  <MaximizeIcon className="w-4 h-4" />
                  Open DICOM Viewer ({localDicomStudies.filter(s => s.selected).length} studies)
                </button>
              )}
              <input
                type="file"
                ref={dicomFolderInputRef}
                onChange={handleDicomLocalFolderSelect}
                className="hidden"
                multiple
              />
              <input
                type="file"
                ref={dicomDriveFolderInputRef}
                onChange={handleDicomDriveFolderSelect}
                className="hidden"
                multiple
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              DICOM files uploaded via Drive are stored on your Google Drive to keep the app lightweight. Local uploads are for immediate viewing only.
            </p>
          </div>

          {/* Study list */}
          <div className="p-4">
            {localDicomStudies.length === 0 && dicomDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 bg-cyan-50 rounded-2xl flex items-center justify-center mb-4">
                  <LayersIcon className="w-7 h-7 text-cyan-400" />
                </div>
                <p className="text-sm font-bold text-slate-500 mb-1">No DICOM studies loaded</p>
                <p className="text-xs text-slate-400 mb-1">Upload DICOM folders from your computer or Google Drive</p>
                <p className="text-[10px] text-slate-300">Supports CT, MRI, X-ray, Ultrasound, and all standard DICOM formats</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Local DICOM studies */}
                {localDicomStudies.map((study, idx) => (
                  <div
                    key={`local-${idx}`}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      study.selected
                        ? 'bg-cyan-50/50 border-cyan-200 ring-1 ring-cyan-100'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => toggleDicomStudySelection(idx)}
                  >
                    <div className="shrink-0">
                      {study.selected ? (
                        <CheckSquareIcon className="w-5 h-5 text-cyan-600" />
                      ) : (
                        <SquareIcon className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0">
                      <ScanIcon className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{study.name}</p>
                      <p className="text-[10px] text-slate-400">{study.files.length} files · Local</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeDicomStudy(idx); }}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <Trash2Icon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {/* Drive-linked DICOM documents */}
                {dicomDocs.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <HardDriveIcon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{doc.size}</span>
                        {doc.storageLocation === 'drive' && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded font-bold">Google Drive</span>}
                        <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DICOM Fullscreen Viewer */}
      {showDicomViewer && (
        <DicomStudyViewerLazy
          files={dicomViewerFiles}
          onClose={() => setShowDicomViewer(false)}
          onSaveAnnotation={onSaveDicomAnnotation}
          caseId={caseItem.id}
          authorName={currentUser.name}
        />
      )}

      <button
        onClick={onOpenAnalysis}
        className="w-full mt-8 bg-[#4F46E5] text-white p-8 rounded-[2rem] shadow-2xl shadow-indigo-100 hover:scale-[1.01] transition-all group flex items-center justify-between"
      >
        <div className="flex items-center gap-6">
          <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30">
            <LayoutTemplateIcon className="w-10 h-10 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-2xl font-serif font-black">Open Clinical Synthesis Workspace</h3>
            <p className="text-indigo-100 text-sm font-medium opacity-80">Analyze timeline, research medical literature, and draft legal reports.</p>
          </div>
        </div>
        <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <ChevronRightIcon className="w-6 h-6 text-[#4F46E5]" />
        </div>
      </button>
    </div>
  );
};

export default CaseDetails;
