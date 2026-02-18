
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, signInAnonymously, updateProfile } from "firebase/auth";
import { auth } from './firebase';
import { Case, Document, Annotation, ViewMode, UserProfile, AuthorizedUser, ReviewStatus, UserRole } from './types';
import Sidebar from './components/Sidebar';
const CaseList = React.lazy(() => import('./components/CaseList'));
const LoginScreen = React.lazy(() => import('./components/LoginScreen'));
const SignUpPage = React.lazy(() => import('./components/SignUpPage'));

// Lazy load major components for code splitting
const DocumentViewer = React.lazy(() => import('./components/DocumentViewer'));
const CaseDetails = React.lazy(() => import('./components/CaseDetails'));
const Orientation = React.lazy(() => import('./components/Orientation'));
const ClientDirectory = React.lazy(() => import('./components/ClientDirectory'));
const AnnotationRollup = React.lazy(() => import('./components/AnnotationRollup').then(m => ({ default: m.AnnotationRollup })));
const TeamAdmin = React.lazy(() => import('./components/TeamAdmin').then(m => ({ default: m.TeamAdmin })));
const AdminInsights = React.lazy(() => import('./components/AdminInsights').then(m => ({ default: m.AdminInsights })));
const Settings = React.lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
import { NewCaseModal } from './components/NewCaseModal';
import { UploadProgress } from './components/UploadProgress';
import { uploadFile } from './services/fileService';
import {
  subscribeToCases,
  subscribeToAnnotations,
  subscribeToDocuments,
  upsertCase,
  upsertAnnotation,
  upsertDocument,
  deleteCaseFromStore,
  deleteAnnotationFromStore,
  deleteDocumentFromStore,
  enableDemoMode,
  subscribeToUsers,
  upsertUser,
  deleteUserFromStore,
  ensureAdminUser,
  getProfile,
  upsertProfile,
  reassignUserCases,
  deleteUserCases
} from './services/storageService';
import { Loader2Icon, CloudCheckIcon, LogOutIcon, ShieldIcon } from 'lucide-react';

const ProfileEditForm: React.FC<{
  initialName: string;
  initialQualifications: string;
  initialBio: string;
  onSave: (name: string, qualifications: string, bio: string) => void | Promise<void>;
  onCancel: () => void;
}> = ({ initialName, initialQualifications, initialBio, onSave, onCancel }) => {
  const [name, setName] = useState(initialName);
  const [qualifications, setQualifications] = useState(initialQualifications);
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave(name, qualifications, bio);
        setSaving(false);
      }}
    >
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition"
          placeholder="Your full name"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Qualifications</label>
        <input
          type="text"
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition"
          placeholder="e.g. MD, PhD, Board Certified..."
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition resize-y"
          placeholder="Brief bio used to auto-generate Physician Expert segments in legal reports..."
        />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all disabled:opacity-60">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.DASHBOARD);

  const [cases, setCases] = useState<Case[]>([]);
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [activeAnnotations, setActiveAnnotations] = useState<Annotation[]>([]);
  const [activeDocuments, setActiveDocuments] = useState<Document[]>([]);
  const [viewerInitialPage, setViewerInitialPage] = useState<number>(1);
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null);
  const [isEditingAnnotation, setIsEditingAnnotation] = useState(false);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | undefined>(undefined);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadTotalFiles, setUploadTotalFiles] = useState<number | undefined>(undefined);
  const [uploadCurrentFileIndex, setUploadCurrentFileIndex] = useState<number | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);


  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      // Check if we're in the middle of signup authorization check
      const isCheckingAuth = sessionStorage.getItem('isCheckingAuthorization') === 'true';
      
      if (user) {
        // If checking authorization, wait before setting current user to prevent UI flash
        if (isCheckingAuth) {
          console.log('⏸️ Authorization check in progress - delaying main UI render');
          setLoading(true); // Keep loading state active
          return; // Don't set currentUser yet - wait for auth check to complete
        }
        
        setCurrentUser({
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || "Expert User",
          email: user.email || "user@apexmedlaw.com",
          role: 'USER' // Default to USER, will be upgraded if in authorizedUsers
        });

        // Ensure support@apexmedlaw.com is an admin
        if (user.email) {
          await ensureAdminUser(user.email, user.uid);
        }
      } else {
        // Only clear if we aren't in explicit demo mode
        if (!isDemoUser) {
          setCurrentUser(null);
        }
      }
      setLoading(false);
    });
    return () => unsubAuth();
  }, [isDemoUser]);

  useEffect(() => {
    if (!currentUser) return;
    const unsubCases = subscribeToCases(setCases, currentUser.id, currentUser.email, currentUser.role);
    const unsubUsers = subscribeToUsers(setAuthorizedUsers);
    return () => {
      unsubCases();
      unsubUsers();
    };
  }, [currentUser]);



  // Sync user role and profile from authorizedUsers + auto sign-out if revoked
  useEffect(() => {
    if (!currentUser || isDemoUser) return;
    if (authorizedUsers.length === 0) return; // Still loading
    const profile = authorizedUsers.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
    if (!profile) {
      // User was removed from authorizedUsers - force sign out immediately
      console.log('🚫 User removed from authorized list - forcing sign out');
      signOut(auth).then(() => {
        setCurrentUser(null);
        setViewMode(ViewMode.DASHBOARD);
        setActiveCase(null);
        alert('Your access has been revoked by an administrator. You have been signed out.');
        window.location.href = '/';
      });
      return;
    }
    if (profile.role !== currentUser.role) {
      setCurrentUser(prev => prev ? { ...prev, role: profile.role } : null);
    }
  }, [authorizedUsers, currentUser?.email]);

  // Load extended profile (qualifications, bio) from Firestore
  useEffect(() => {
    if (!currentUser) return;
    getProfile(currentUser.id).then((p) => {
      setCurrentUser(prev =>
        prev ? { ...prev, name: p.name || prev.name, qualifications: p.qualifications, bio: p.bio } : null
      );
    });
  }, [currentUser?.id]);

  // Keep activeCase in sync with cases array
  useEffect(() => {
    if (activeCase && cases.length > 0) {
      const updated = cases.find(c => c.id === activeCase.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(activeCase)) {
        setActiveCase(updated);
      }
    }
  }, [cases, activeCase]);

  // 1. Initial Load / URL Sync on Mount or Cases Update
  useEffect(() => {
    if (cases.length === 0) return; // Wait for cases to load

    const params = new URLSearchParams(window.location.search);
    const caseIdFromUrl = params.get('caseId');

    // If URL has caseId but we aren't viewing a case, try to restore it
    if (caseIdFromUrl && !activeCase) {
      const found = cases.find(c => c.id === caseIdFromUrl);
      if (found) {
        setActiveCase(found);
        setViewMode(ViewMode.CASE_VIEW);
      }
    }
  }, [cases]);

  // 2. Sync State -> URL (Push State)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCaseId = params.get('caseId');

    if (activeCase && viewMode === ViewMode.CASE_VIEW) {
      if (urlCaseId !== activeCase.id) {
        window.history.pushState({ caseId: activeCase.id }, '', `?caseId=${activeCase.id}`);
      }
    } else if (viewMode === ViewMode.DASHBOARD && urlCaseId) {
      // If we went back to dashboard but URL still has caseId, clear it
      window.history.pushState({}, '', '/');
    }
  }, [activeCase, viewMode]);

  // 3. Sync URL -> State (PopState / Back Button)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const caseId = params.get('caseId');

      if (caseId) {
        const found = cases.find(c => c.id === caseId);
        if (found) {
          setActiveCase(found);
          setViewMode(ViewMode.CASE_VIEW);
        }
      } else {
        setActiveCase(null);
        setViewMode(ViewMode.DASHBOARD);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [cases]);

  useEffect(() => {
    if (!activeCase) {
      setActiveDocuments([]);
      setActiveAnnotations([]);
      return;
    }
    const unsubDocs = subscribeToDocuments(activeCase.id, setActiveDocuments);
    const unsubAnns = subscribeToAnnotations(activeCase.id, setActiveAnnotations);
    return () => {
      unsubDocs();
      unsubAnns();
    };
  }, [activeCase]);

  const handleLogout = async () => {
    setIsDemoUser(false);
    await signOut(auth);
    setCurrentUser(null);
    setViewMode(ViewMode.DASHBOARD);
    setActiveCase(null);
    // Reload to clear in-memory mock data
    window.location.reload();
  };

  const handleDemoLogin = () => {
    // Enable offline demo mode in storage service
    enableDemoMode();

    // Set local state directly, bypassing Firebase Auth
    setIsDemoUser(true);
    setCurrentUser({
      id: "demo-user-id",
      name: "Demo Physician",
      email: "demo@apexmedlaw.com",
      role: 'ADMIN',
      avatarColor: 'bg-cyan-600'
    });
  };

  const handleCreateCase = () => {
    if (!currentUser) return;
    setEditingCase(undefined);
    setShowNewCaseModal(true);
  };

  const handleEditCase = (caseItem: Case) => {
    if (!currentUser) return;
    setEditingCase(caseItem);
    setShowNewCaseModal(true);
  };

  const handleSaveNewCase = (caseData: Partial<Case>, clientName: string) => {
    if (!currentUser) return;

    // If editing, merge with existing case
    if (editingCase) {
      const updatedCase: Case = {
        ...editingCase,
        ...caseData,
        // Update client name if changed and clients exist, or add new if none
        clients: clientName
          ? (editingCase.clients && editingCase.clients.length > 0
            ? editingCase.clients.map((c, i) => i === 0 ? { ...c, name: clientName } : c)
            : [{ id: Math.random().toString(36).substr(2, 9), name: clientName, email: '', phone: '', role: 'Plaintiff' }])
          : editingCase.clients
      };
      upsertCase(updatedCase);
      // Update active case if we're editing the currently active one
      if (activeCase?.id === updatedCase.id) {
        setActiveCase(updatedCase);
      }
    } else {
      // Create new case
      const newCase: Case = {
        id: Math.random().toString(36).substr(2, 9),
        title: caseData.title || 'New Clinical Matter',
        description: caseData.description || '',
        createdAt: caseData.createdAt || new Date().toISOString().split('T')[0],
        status: 'active',
        ownerId: currentUser.id,
        ownerName: currentUser.name,
        primaryLawyer: caseData.primaryLawyer || '',
        clients: clientName ? [{
          id: Math.random().toString(36).substr(2, 9),
          name: clientName,
          email: '',
          phone: '',
          role: 'Plaintiff'
        }] : [],
        assignedUserIds: [],
        reportStatus: 'idle',
        ...caseData
      } as Case;

      upsertCase(newCase);
      setActiveCase(newCase);
      setViewMode(ViewMode.CASE_VIEW);
    }
    setShowNewCaseModal(false);
    setEditingCase(undefined);
  };

  const handleFileUpload = async (caseId: string, file: File) => {
    // Validate file size - allow up to 1GB
    const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB in bytes
    if (file.size > MAX_FILE_SIZE) {
      alert(`File size exceeds 1GB limit. File size: ${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB`);
      return;
    }

    setIsUploading(true);
    setUploadFileName(file.name);
    setUploadProgress(0);
    try {
      let fileData;
      try {
        fileData = await uploadFile(caseId, file, (data) => {
          setUploadProgress(data.progress);
        });
      } catch (e) {
        if (isDemoUser) {
          console.warn("Demo upload simulation");
          fileData = {
            url: URL.createObjectURL(file),
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
            storagePath: undefined
          };
        } else {
          throw e;
        }
      }

      // Smart path detection based on filename
      const detectPath = (filename: string): string => {
        const lower = filename.toLowerCase();

        // Medical Records categories
        if (lower.includes('surgery') || lower.includes('surgical') || lower.includes('operation')) {
          return 'Medical Records/Surgery';
        }
        if (lower.includes('nursing') || lower.includes('nurse')) {
          return 'Medical Records/Nursing';
        }
        if (lower.includes('radiology') || lower.includes('xray') || lower.includes('x-ray') || lower.includes('mri') || lower.includes('ct scan')) {
          return 'Medical Records/Radiology';
        }
        if (lower.includes('lab') || lower.includes('pathology') || lower.includes('blood')) {
          return 'Medical Records/Laboratory';
        }
        if (lower.includes('discharge') || lower.includes('admission')) {
          return 'Medical Records/Hospital Records';
        }
        if (lower.includes('prescription') || lower.includes('medication') || lower.includes('pharmacy')) {
          return 'Medical Records/Pharmacy';
        }

        // Legal Documents
        if (lower.includes('deposition') || lower.includes('testimony')) {
          return 'Legal Documents/Depositions';
        }
        if (lower.includes('contract') || lower.includes('agreement')) {
          return 'Legal Documents/Contracts';
        }
        if (lower.includes('correspondence') || lower.includes('letter')) {
          return 'Legal Documents/Correspondence';
        }

        // Default fallback
        return 'Medical Records/General';
      };

      const newDoc: Document = {
        id: Math.random().toString(36).substr(2, 9),
        caseId,
        name: fileData.name,
        type: 'pdf',
        url: fileData.url,
        // storagePath returned by uploadFile (may be undefined in demo fallback)
        storagePath: (fileData as any).storagePath || undefined,
        // store full ISO timestamp so UI can format user-friendly date/time
        uploadDate: new Date().toISOString(),
        size: fileData.size,
        reviewStatus: 'pending',
        path: detectPath(fileData.name)
      };
      await upsertDocument(newDoc);
    } catch (e) {
      alert("Failed to upload file. Ensure Firebase Storage is configured or use Demo mode.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadFileName('');
      setUploadTotalFiles(undefined);
      setUploadCurrentFileIndex(undefined);
    }
  };

  const handleFolderUpload = async (caseId: string, fileList: FileList | File[]) => {
    const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
    const files = Array.from(fileList);
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    const tooLarge: string[] = [];
    const toUpload = pdfFiles.filter(f => {
      if (f.size > MAX_FILE_SIZE) {
        tooLarge.push(f.name);
        return false;
      }
      return true;
    });

    const skippedNonPdf = pdfFiles.length < files.length ? files.length - pdfFiles.length : 0;
    if (toUpload.length === 0) {
      const parts: string[] = [];
      if (skippedNonPdf) parts.push(`${skippedNonPdf} non-PDF file(s) skipped`);
      if (tooLarge.length) parts.push(`${tooLarge.length} file(s) exceed 1GB: ${tooLarge.slice(0, 3).join(', ')}${tooLarge.length > 3 ? '...' : ''}`);
      alert(parts.length ? `No PDFs to upload. ${parts.join('. ')}` : 'No PDF files found in the selected folder.');
      return;
    }

    setIsUploading(true);
    setUploadTotalFiles(toUpload.length);
    setUploadCurrentFileIndex(1);
    setUploadFileName(toUpload.length > 1 ? 'Folder upload' : toUpload[0].name);
    setUploadProgress(0);

    const getFolderPath = (file: File): string => {
      const rp = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const parts = rp.replace(/\\/g, '/').split('/');
      parts.pop(); // remove filename
      return parts.filter(Boolean).join('/');
    };

    try {
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        setUploadCurrentFileIndex(i + 1);
        setUploadFileName(file.name);
        setUploadProgress(0);
        let fileData;
        try {
          fileData = await uploadFile(caseId, file, (data) => {
            setUploadProgress(data.progress);
          });
        } catch (e) {
          if (isDemoUser) {
            fileData = {
              url: URL.createObjectURL(file),
              name: file.name,
              size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
              storagePath: undefined
            };
          } else throw e;
        }
        const folderPath = getFolderPath(file);
        const newDoc: Document = {
          id: Math.random().toString(36).substr(2, 9),
          caseId,
          name: fileData.name,
          type: 'pdf',
          url: fileData.url,
          storagePath: (fileData as { storagePath?: string }).storagePath,
          uploadDate: new Date().toISOString(),
          size: fileData.size,
          reviewStatus: 'pending',
          path: folderPath || undefined
        };
        await upsertDocument(newDoc);
      }
      const parts: string[] = [`Uploaded ${toUpload.length} file(s).`];
      if (skippedNonPdf) parts.push(`${skippedNonPdf} non-PDF skipped`);
      if (tooLarge.length) parts.push(`${tooLarge.length} exceeded 1GB`);
      if (parts.length > 1) console.info(parts.join(' '));
    } catch (e) {
      alert("Failed to upload folder. Ensure Firebase Storage is configured or use Demo mode.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadFileName('');
      setUploadTotalFiles(undefined);
      setUploadCurrentFileIndex(undefined);
    }
  };

  const handleSaveProfile = async (name: string, qualifications: string, bio: string) => {
    if (!currentUser) return;
    const uid = auth.currentUser?.uid ?? currentUser.id;
    if (!uid) {
      alert('You must be signed in to save your profile.');
      return;
    }
    const trimmedName = name.trim();
    const trimmedQuals = qualifications.trim() || undefined;
    const trimmedBio = bio.trim() || undefined;
    try {
      // Save to Firestore first (main profile storage)
      await upsertProfile(uid, { name: trimmedName, qualifications: trimmedQuals, bio: trimmedBio });
      setCurrentUser(prev => prev ? { ...prev, name: trimmedName, qualifications: trimmedQuals, bio: trimmedBio } : null);
      setIsEditingProfile(false);

      // Optionally update Firebase Auth displayName (may fail for some providers; non-critical)
      const user = auth.currentUser;
      if (user && trimmedName) {
        try {
          await updateProfile(user, { displayName: trimmedName });
        } catch (authErr) {
          console.warn('Auth displayName update skipped:', authErr);
        }
      }
    } catch (e: any) {
      console.error('Failed to save profile:', e);
      const msg = e?.message || e?.code || String(e);
      const hint = msg.includes('permission') || msg.includes('Permission') ? ' Deploy Firestore rules: firebase deploy --only firestore:rules' : '';
      alert(`Failed to save profile: ${msg}${hint}`);
    }
  };

  const handleAddAnnotation = (
    page: number,
    text: string,
    category: string,
    x: number,
    y: number,
    type: any = 'point',
    imageUrl?: string,
    width?: number,
    height?: number,
    author?: string,
    eventDate?: string,
    eventTime?: string,
    documentId?: string
  ) => {
    if (!activeCase) return;
    const finalDocId = documentId || activeDoc?.id;
    if (!finalDocId) return;

    const newAnn: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      documentId: finalDocId,
      caseId: activeCase.id,
      page, text, author: author || currentUser?.name || 'Expert User', category, x, y, width, height, imageUrl,
      eventDate: eventDate?.trim() ? eventDate.trim() : undefined,
      eventTime: eventTime?.trim() ? eventTime.trim() : undefined,
      timestamp: new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }),
      type
    };
    upsertAnnotation(newAnn);
  };

  const handleNavigateToAnnotation = (annId: string, edit: boolean = false) => {
    const ann = activeAnnotations.find(a => a.id === annId);
    if (!ann) return;

    const doc = activeDocuments.find(d => d.id === ann.documentId);
    if (doc) {
      setActiveDoc(doc);
      setViewerInitialPage(ann.page);
      setFocusedAnnotationId(annId);
      setIsEditingAnnotation(edit);
      setViewMode(ViewMode.DOC_VIEWER);
    }
  };

  const handleInviteUser = (email: string, role: UserRole, name: string) => {
    const newUser: AuthorizedUser = {
      id: email.toLowerCase(),
      name,
      email,
      role,
      status: 'invited',
      addedAt: new Date().toISOString().split('T')[0],
      avatarColor: ['bg-cyan-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-rose-600', 'bg-amber-600'][Math.floor(Math.random() * 5)]
    };
    upsertUser(newUser);
  };

  const handleDeleteUser = async (id: string, action?: 'keep' | 'reassign' | 'delete', reassignToId?: string) => {
    // action: 'keep' = just remove auth (default), 'reassign' = reassign cases, 'delete' = delete cases
    if (action === 'reassign' && reassignToId) {
      const targetUser = authorizedUsers.find(u => u.id === reassignToId);
      if (targetUser) {
        await reassignUserCases(id, reassignToId, targetUser.name);
      }
    } else if (action === 'delete') {
      await deleteUserCases(id);
    }
    await deleteUserFromStore(id);
  };

  const handleAssignUser = (caseId: string, userId: string) => {
    const c = cases.find(x => x.id === caseId);
    if (!c) return;
    const updated = {
      ...c,
      assignedUserIds: [...(c.assignedUserIds || []), userId]
    };
    upsertCase(updated);
  };

  const handleRemoveUser = (caseId: string, userId: string) => {
    const c = cases.find(x => x.id === caseId);
    if (!c) return;
    const updated = {
      ...c,
      assignedUserIds: (c.assignedUserIds || []).filter(id => id !== userId)
    };
    upsertCase(updated);
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2Icon className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
      <p className="text-slate-500 font-medium font-serif italic">ApexMedLaw: Secure Cloud Initialize...</p>
    </div>
  );

  if (!currentUser) {
    // Check if URL has invitation token, signup param, or access request param
    const params = new URLSearchParams(window.location.search);
    const hasInvite = params.get('invite');
    const isSignup = params.get('signup') === 'true';
    const isAccessRequest = params.get('access') === 'request';
    
    return (
      <React.Suspense fallback={
        <div className="h-screen flex items-center justify-center bg-slate-50">
          <Loader2Icon className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      }>
        {hasInvite || isSignup ? (
          <SignUpPage onBackToLogin={() => window.location.href = '/'} />
        ) : (
          <LoginScreen onDemoLogin={handleDemoLogin} autoShowRequestAccess={isAccessRequest} />
        )}
      </React.Suspense>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <div className="flex flex-1 min-h-0">
        <Sidebar
          currentView={viewMode} setView={setViewMode}
          activeCase={activeCase} onSelectCase={(c) => { setActiveCase(c); setViewMode(ViewMode.CASE_VIEW); }}
          cases={cases} onCreateCase={handleCreateCase} onOpenSettings={() => { }}
          currentUser={currentUser} onReorderCases={() => { }} authorizedUsers={authorizedUsers}
          onInviteUser={handleInviteUser} onDeleteUser={handleDeleteUser}
          collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-[12px] md:text-sm font-bold text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                {viewMode === ViewMode.DASHBOARD && "Case Dashboard"}
                {viewMode === ViewMode.CASE_VIEW && activeCase?.title}
                {viewMode === ViewMode.DOC_VIEWER && activeDoc?.name}
                {viewMode === ViewMode.ANNOTATION_ROLLUP && "Clinical Workspace"}
                {viewMode === ViewMode.CLIENTS && "Client Directory"}
                {viewMode === ViewMode.ORIENTATION && "Orientation"}
                {viewMode === ViewMode.PROFILE && "My Profile"}
                {viewMode === ViewMode.TEAM_ADMIN && "Firm Administration"}
                {viewMode === ViewMode.ADMIN_INSIGHTS && "Admin Intelligence"}
                {viewMode === ViewMode.SETTINGS && "Platform Settings"}
              </h1>
              <div className={`flex items-center gap-2 px-2.5 py-1 rounded font-black text-[9px] uppercase tracking-widest ${isDemoUser ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 text-emerald-600'}`}>
                {isDemoUser ? "SANDBOX" : "Firebase Realtime"}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-600 transition-colors">
                <LogOutIcon className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Sign Out</span>
              </button>
            </div>
          </header>

          <div className={`flex-1 min-h-0 ${viewMode === ViewMode.ANNOTATION_ROLLUP ? 'flex flex-col overflow-hidden' : 'overflow-auto'}`}>
            <React.Suspense fallback={
              <div className="flex-1 flex items-center justify-center bg-slate-50">
                <Loader2Icon className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            }>
              {viewMode === ViewMode.DASHBOARD && (
                <CaseList
                  cases={cases}
                  onSelect={(c) => { setActiveCase(c); setViewMode(ViewMode.CASE_VIEW); }}
                  onCreate={handleCreateCase}
                  onEdit={handleEditCase}
                  currentUser={currentUser}
                  onDeleteCase={deleteCaseFromStore}
                  onUpdateCase={upsertCase}
                  authorizedUsers={authorizedUsers}
                />
              )}
              {viewMode === ViewMode.CASE_VIEW && activeCase && (
                <CaseDetails
                  currentUser={currentUser} caseItem={activeCase} docs={activeDocuments} allUsers={authorizedUsers}
                  onAssignUser={handleAssignUser} onRemoveUser={handleRemoveUser}
                  onOpenDoc={(d) => { setActiveDoc(d); setViewMode(ViewMode.DOC_VIEWER); }}
                  onUpload={handleFileUpload}
                  onUploadFolder={handleFolderUpload}
                  onUpdateCase={upsertCase}
                  onDeleteDoc={deleteDocumentFromStore}
                  onUpdateDocStatus={(did, status) => {
                    const d = activeDocuments.find(x => x.id === did);
                    if (d) upsertDocument({ ...d, reviewStatus: status });
                  }}
                  onUpdateDoc={upsertDocument}
                  onOpenAnalysis={() => setViewMode(ViewMode.ANNOTATION_ROLLUP)}
                />
              )}
              {viewMode === ViewMode.DOC_VIEWER && activeDoc && (
                <DocumentViewer
                  doc={activeDoc}
                  annotations={activeAnnotations}
                  onAddAnnotation={handleAddAnnotation}
                  onUpdateAnnotation={upsertAnnotation}
                  onDeleteAnnotation={deleteAnnotationFromStore}
                  onBack={() => setViewMode(ViewMode.CASE_VIEW)}
                  onOpenClinicalWorkspace={() => setViewMode(ViewMode.ANNOTATION_ROLLUP)}
                  googleAccessToken={null}
                  initialPage={viewerInitialPage}
                  focusedAnnotationId={focusedAnnotationId}
                  isEditingFocused={isEditingAnnotation}
                  onClearFocus={() => { setFocusedAnnotationId(null); setIsEditingAnnotation(false); }}
                  onSetFocus={(id) => setFocusedAnnotationId(id)}
                  allDocuments={activeDocuments}
                  onSwitchDocument={(newDoc) => {
                    setActiveDoc(newDoc);
                    setViewerInitialPage(1);
                  }}
                  currentUser={currentUser}
                />
              )}
              {viewMode === ViewMode.ANNOTATION_ROLLUP && activeCase && (
                <AnnotationRollup
                  caseItem={activeCase} docs={activeDocuments} annotations={activeAnnotations}
                  onBack={() => setViewMode(ViewMode.CASE_VIEW)} googleAccessToken={null} onUpdateCase={upsertCase}
                  onAddAnnotation={handleAddAnnotation}
                  onUpdateAnnotation={upsertAnnotation}
                  onDeleteAnnotation={deleteAnnotationFromStore}
                  onNavigateToSource={(did, pg) => {
                    const doc = activeDocuments.find(d => d.id === did);
                    if (doc) { setActiveDoc(doc); setViewerInitialPage(pg); setViewMode(ViewMode.DOC_VIEWER); }
                  }}
                  onNavigateToAnnotation={handleNavigateToAnnotation}
                  currentUser={currentUser}
                />
              )}
              {viewMode === ViewMode.CLIENTS && (
                <ClientDirectory cases={cases} currentUser={currentUser} onUpdateCase={upsertCase} />
              )}
              {viewMode === ViewMode.ORIENTATION && (
                <Orientation />
              )}
              {viewMode === ViewMode.PROFILE && currentUser && (
                <div className="p-8 max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl mt-12 shadow-sm">
                  <h2 className="text-3xl font-serif font-black text-slate-900 mb-6">Expert Profile</h2>
                  {isEditingProfile ? (
                    <ProfileEditForm
                      initialName={currentUser.name}
                      initialQualifications={currentUser.qualifications ?? ''}
                      initialBio={currentUser.bio ?? ''}
                      onSave={handleSaveProfile}
                      onCancel={() => setIsEditingProfile(false)}
                    />
                  ) : (
                    <>
                      <div className="flex items-center gap-6 mb-8">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white font-bold shadow-lg ${currentUser.avatarColor || 'bg-cyan-600'}`}>
                          {currentUser.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">{currentUser.name}</h3>
                          <p className="text-slate-500">{currentUser.email}</p>
                          <span className="inline-block mt-2 px-2 py-0.5 bg-cyan-50 text-cyan-700 text-[10px] font-bold rounded uppercase tracking-widest border border-cyan-100">{currentUser.role}</span>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Qualifications & Bio</p>
                          <p className="text-sm text-slate-600">
                            {currentUser.qualifications || currentUser.bio ? (
                              <>
                                {currentUser.qualifications && <span className="font-medium">{currentUser.qualifications}</span>}
                                {currentUser.qualifications && currentUser.bio && <br />}
                                {currentUser.bio || ''}
                              </>
                            ) : (
                              <span className="italic">"No bio updated. Qualifications provided here are used to auto-generate Physician Expert segments in legal reports."</span>
                            )}
                          </p>
                        </div>
                        <button onClick={() => setIsEditingProfile(true)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all">Edit Profile</button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {viewMode === ViewMode.TEAM_ADMIN && (
                <TeamAdmin
                  authorizedUsers={authorizedUsers}
                  onInviteUser={handleInviteUser}
                  onDeleteUser={handleDeleteUser}
                  currentUser={currentUser}
                />
              )}
              {viewMode === ViewMode.ADMIN_INSIGHTS && (
                <AdminInsights
                  cases={cases}
                  authorizedUsers={authorizedUsers}
                />
              )}
              {viewMode === ViewMode.SETTINGS && (
                <Settings currentUser={currentUser} />
              )}
            </React.Suspense>
          </div>
        </main>
      </div>

      <NewCaseModal
        isOpen={showNewCaseModal}
        onClose={() => setShowNewCaseModal(false)}
        onCreate={handleSaveNewCase}
        initialData={editingCase}
      />

      <UploadProgress
        progress={uploadProgress}
        fileName={uploadFileName}
        isUploading={isUploading}
        totalFiles={uploadTotalFiles}
        currentFileIndex={uploadCurrentFileIndex}
      />
    </div>
  );
};

export default App;
