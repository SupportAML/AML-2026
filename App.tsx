
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
  ensureAdminUser
} from './services/storageService';
import { Loader2Icon, CloudCheckIcon, LogOutIcon, ShieldIcon } from 'lucide-react';

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
    const unsubCases = subscribeToCases(setCases, currentUser.id, currentUser.role);
    const unsubUsers = subscribeToUsers(setAuthorizedUsers);
    return () => {
      unsubCases();
      unsubUsers();
    };
  }, [currentUser]);



  // Sync user role and profile from authorizedUsers
  useEffect(() => {
    if (!currentUser || authorizedUsers.length === 0) return;
    const profile = authorizedUsers.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
    if (profile && profile.role !== currentUser.role) {
      setCurrentUser(prev => prev ? { ...prev, role: profile.role } : null);
    }
  }, [authorizedUsers, currentUser?.email]);

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
    try {
      // In demo mode, uploadFile still tries to hit storage. 
      // We should mock this too if we want full offline, but fileService is separate.
      // For now, let's catch the error and fallback to a mock URL if offline.
      let fileData;
      try {
        fileData = await uploadFile(caseId, file);
      } catch (e) {
        if (isDemoUser) {
          console.warn("Demo upload simulation");
          fileData = {
            url: URL.createObjectURL(file), // Local blob URL for demo
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(2) + " MB"
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
      page, text, author: author || currentUser?.name || 'Expert User', category, x, y, width, height, imageUrl, eventDate, eventTime,
      timestamp: new Date().toLocaleString(),
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

  const handleDeleteUser = (id: string) => {
    if (window.confirm("Are you sure you want to remove this team member?")) {
      deleteUserFromStore(id);
    }
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
                />
              )}
              {viewMode === ViewMode.CASE_VIEW && activeCase && (
                <CaseDetails
                  currentUser={currentUser} caseItem={activeCase} docs={activeDocuments} allUsers={authorizedUsers}
                  onAssignUser={handleAssignUser} onRemoveUser={handleRemoveUser}
                  onOpenDoc={(d) => { setActiveDoc(d); setViewMode(ViewMode.DOC_VIEWER); }}
                  onUpload={handleFileUpload}
                  onUpdateCase={upsertCase}
                  onDeleteDoc={deleteDocumentFromStore}
                  onUpdateDocStatus={(did, status) => {
                    const d = activeDocuments.find(x => x.id === did);
                    if (d) upsertDocument({ ...d, reviewStatus: status });
                  }}
                  onOpenAnalysis={() => setViewMode(ViewMode.ANNOTATION_ROLLUP)}
                />
              )}
              {viewMode === ViewMode.DOC_VIEWER && activeDoc && (
                <DocumentViewer
                  doc={activeDoc}
                  annotations={activeAnnotations.filter(a => a.documentId === activeDoc.id)}
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
              {viewMode === ViewMode.PROFILE && (
                <div className="p-8 max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl mt-12 shadow-sm">
                  <h2 className="text-3xl font-serif font-black text-slate-900 mb-6">Expert Profile</h2>
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
                      <p className="text-sm text-slate-600 italic">"No bio updated. Qualifications provided here are used to auto-generate Physician Expert segments in legal reports."</p>
                    </div>
                    <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all">Edit Profile</button>
                  </div>
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
    </div>
  );
};

export default App;
