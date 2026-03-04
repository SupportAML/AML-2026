
import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import {
  XIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  FolderTreeIcon,
  FileTextIcon,
  VideoIcon,
  ImageIcon,
  FileIcon,
  ScanIcon,
  CheckIcon,
  ExternalLinkIcon,
  Loader2Icon
} from 'lucide-react';
import {
  Document as DocType,
  Annotation,
  Case,
  DocumentPriority,
  PRIORITY_CONFIG,
  UserProfile,
  ReviewSession
} from '../types';
import { getReviewSession, upsertReviewSession } from '../services/storageService';

const DocumentViewer = lazy(() => import('./DocumentViewer'));

// ---- Tree Helpers ----
interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  path: string;
  doc?: DocType;
  children: Record<string, TreeNode>;
}

const buildTree = (docs: DocType[], virtualFolders: string[]): Record<string, TreeNode> => {
  const root: Record<string, TreeNode> = {};
  docs.filter(d => d.type !== 'dicom').forEach(doc => {
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
      name: doc.name, type: 'file', path: doc.path ? `${doc.path}/${doc.name}` : doc.name, doc, children: {}
    };
  });
  (virtualFolders || []).forEach(folderPath => {
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

const flattenTree = (tree: Record<string, TreeNode>): DocType[] => {
  const docs: DocType[] = [];
  const walk = (nodes: Record<string, TreeNode>) => {
    const sorted = Object.keys(nodes).sort((a, b) => {
      const nA = nodes[a], nB = nodes[b];
      if (nA.type !== nB.type) return nA.type === 'folder' ? -1 : 1;
      return a.localeCompare(b);
    });
    for (const key of sorted) {
      const node = nodes[key];
      if (node.type === 'file' && node.doc) docs.push(node.doc);
      else if (node.type === 'folder') walk(node.children);
    }
  };
  walk(tree);
  return docs;
};

const collectDocsFromNode = (node: TreeNode): DocType[] => {
  const docs: DocType[] = [];
  if (node.type === 'file' && node.doc) docs.push(node.doc);
  for (const child of Object.values(node.children)) {
    docs.push(...collectDocsFromNode(child));
  }
  return docs;
};

const getFolderPriorityColors = (node: TreeNode): string[] => {
  const docs = collectDocsFromNode(node);
  if (docs.length === 0) return [PRIORITY_CONFIG.unreviewed.color];
  const priorities = docs.map(d => d.priority || 'unreviewed');
  const unique = [...new Set(priorities)];
  return unique.map(p => PRIORITY_CONFIG[p].color);
};

// ---- Sidebar Tree Item ----
const SidebarTreeItem: React.FC<{
  node: TreeNode;
  level: number;
  activeDocId?: string;
  annotationCounts: Record<string, number>;
  onSelectDoc: (doc: DocType) => void;
}> = ({ node, level, activeDocId, annotationCounts, onSelectDoc }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (node.type === 'file' && node.doc) {
    const priority = node.doc.priority || 'unreviewed';
    const isActive = node.doc.id === activeDocId;
    return (
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-xs ${isActive ? 'bg-indigo-100 text-indigo-800 font-bold' : 'hover:bg-slate-700/50 text-slate-300'}`}
        style={{ paddingLeft: `${level * 14 + 8}px`, borderLeft: `3px solid ${PRIORITY_CONFIG[priority].color}` }}
        onClick={() => onSelectDoc(node.doc!)}
      >
        <FileTextIcon className="w-3 h-3 shrink-0" />
        <span className="truncate flex-1">{node.name}</span>
        {(annotationCounts[node.doc.id] || 0) > 0 && (
          <span className="text-[9px] text-slate-500 bg-slate-800 px-1 py-0.5 rounded-full shrink-0">
            {annotationCounts[node.doc.id]}
          </span>
        )}
      </div>
    );
  }

  const folderColors = getFolderPriorityColors(node);
  const borderStyle: React.CSSProperties = folderColors.length === 1
    ? { borderLeft: `3px solid ${folderColors[0]}` }
    : { borderLeft: '3px solid transparent', borderImage: `linear-gradient(to bottom, ${folderColors.join(', ')}) 1` };
  const folderDocs = collectDocsFromNode(node);
  const folderAnnCount = folderDocs.reduce((sum, d) => sum + (annotationCounts[d.id] || 0), 0);

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-slate-700/50 text-slate-400 text-xs font-bold select-none"
        style={{ paddingLeft: `${level * 14 + 8}px`, ...borderStyle }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDownIcon className="w-3 h-3 shrink-0" /> : <ChevronRightIcon className="w-3 h-3 shrink-0" />}
        <FolderTreeIcon className="w-3 h-3 text-indigo-400 shrink-0" />
        <span className="truncate flex-1">{node.name}</span>
        {folderAnnCount > 0 && (
          <span className="text-[9px] text-slate-500 bg-slate-800 px-1 py-0.5 rounded-full shrink-0">{folderAnnCount}</span>
        )}
      </div>
      {isOpen && Object.keys(node.children).sort((a, b) => {
        const nA = node.children[a], nB = node.children[b];
        if (nA.type !== nB.type) return nA.type === 'folder' ? -1 : 1;
        return a.localeCompare(b);
      }).map(key => (
        <SidebarTreeItem
          key={node.children[key].path}
          node={node.children[key]}
          level={level + 1}
          activeDocId={activeDocId}
          annotationCounts={annotationCounts}
          onSelectDoc={onSelectDoc}
        />
      ))}
    </div>
  );
};

// ---- Main ReviewMode Component ----
interface ReviewModeProps {
  caseItem: Case;
  docs: DocType[];
  annotations: Annotation[];
  currentUser: UserProfile;
  googleAccessToken: string | null;
  onAddAnnotation: (page: number, text: string, category: string, x: number, y: number, type?: 'point' | 'highlight' | 'area' | 'voice', imageUrl?: string, width?: number, height?: number, author?: string, eventDate?: string, eventTime?: string, documentId?: string) => void;
  onUpdateAnnotation: (annotation: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onUpdateDoc: (doc: DocType) => void;
  onExit: () => void;
}

const ReviewMode: React.FC<ReviewModeProps> = ({
  caseItem, docs, annotations, currentUser, googleAccessToken,
  onAddAnnotation, onUpdateAnnotation, onDeleteAnnotation, onUpdateDoc, onExit
}) => {
  const [activeDoc, setActiveDoc] = useState<DocType | null>(null);
  const [viewerInitialPage, setViewerInitialPage] = useState<number>(1);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const activeDocRef = useRef<DocType | null>(null);
  const currentPageRef = useRef<number>(1);

  const treeData = useMemo(() => buildTree(docs, caseItem.virtualFolders || []), [docs, caseItem.virtualFolders]);
  const flatDocs = useMemo(() => flattenTree(treeData), [treeData]);

  const annotationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ann of annotations) {
      counts[ann.documentId] = (counts[ann.documentId] || 0) + 1;
    }
    return counts;
  }, [annotations]);

  // Compute review progress
  const totalDocs = flatDocs.length;
  const reviewedDocs = flatDocs.filter(d => d.priority && d.priority !== 'unreviewed').length;
  const progressPct = totalDocs > 0 ? Math.round((reviewedDocs / totalDocs) * 100) : 0;

  // Load saved session on mount
  useEffect(() => {
    let mounted = true;
    getReviewSession(caseItem.id, currentUser.id).then(session => {
      if (!mounted) return;
      if (session?.lastDocumentId) {
        const doc = flatDocs.find(d => d.id === session.lastDocumentId);
        if (doc) {
          setActiveDoc(doc);
          setViewerInitialPage(session.lastPage || 1);
          setSessionLoaded(true);
          return;
        }
      }
      // No saved session — find the first unreviewed document
      const firstUnreviewed = flatDocs.find(d => !d.priority || d.priority === 'unreviewed');
      setActiveDoc(firstUnreviewed || flatDocs[0] || null);
      setViewerInitialPage(1);
      setSessionLoaded(true);
    });
    return () => { mounted = false; };
  }, []);

  // Keep ref in sync
  useEffect(() => { activeDocRef.current = activeDoc; }, [activeDoc]);

  // Save session on document change or periodic
  const saveSession = useCallback(() => {
    if (activeDocRef.current) {
      upsertReviewSession(caseItem.id, currentUser.id, {
        lastDocumentId: activeDocRef.current.id,
        lastPage: currentPageRef.current
      });
    }
  }, [caseItem.id, currentUser.id]);

  useEffect(() => {
    saveSession();
  }, [activeDoc]);

  // Save session on unmount
  useEffect(() => {
    return () => { saveSession(); };
  }, [saveSession]);

  const handleSelectDoc = (doc: DocType) => {
    saveSession();
    setActiveDoc(doc);
    setViewerInitialPage(1);
  };

  const handleSetPriority = (priority: DocumentPriority) => {
    if (!activeDoc) return;
    onUpdateDoc({ ...activeDoc, priority });
  };

  const handleMarkReviewed = () => {
    if (!activeDoc) return;
    // If currently unreviewed, set to supplemental (the lightest reviewed state)
    // Otherwise keep current priority
    if (!activeDoc.priority || activeDoc.priority === 'unreviewed') {
      onUpdateDoc({ ...activeDoc, priority: 'supplemental' });
    }
    // Advance to next unreviewed
    const currentIdx = flatDocs.findIndex(d => d.id === activeDoc.id);
    for (let i = 1; i < flatDocs.length; i++) {
      const nextDoc = flatDocs[(currentIdx + i) % flatDocs.length];
      if (!nextDoc.priority || nextDoc.priority === 'unreviewed') {
        setActiveDoc(nextDoc);
        setViewerInitialPage(1);
        return;
      }
    }
    // All reviewed
  };

  const handleDetach = () => {
    if (activeDoc?.url) {
      window.open(activeDoc.url, '_blank');
    }
  };

  const activeAnnotations = annotations.filter(a => a.documentId === activeDoc?.id);
  const priorities: DocumentPriority[] = ['critical', 'notable', 'supplemental', 'unreviewed'];
  const activePriority = activeDoc?.priority || 'unreviewed';

  if (!sessionLoaded) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center">
        <Loader2Icon className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">Review Mode</span>
          <span className="text-xs text-slate-500">—</span>
          <span className="text-xs text-slate-400">{caseItem.title}</span>
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-700 hover:text-white transition-all"
        >
          <XIcon className="w-3.5 h-3.5" />
          Exit Review
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left panel — Tree */}
        <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
          {/* Progress bar */}
          <div className="p-3 border-b border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Review Progress</span>
              <span className="text-[10px] text-slate-500">{progressPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-1">
              {reviewedDocs} of {totalDocs} documents reviewed
            </p>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {Object.keys(treeData).sort((a, b) => {
              const nA = treeData[a], nB = treeData[b];
              if (nA.type !== nB.type) return nA.type === 'folder' ? -1 : 1;
              return a.localeCompare(b);
            }).map(key => (
              <SidebarTreeItem
                key={treeData[key].path}
                node={treeData[key]}
                level={0}
                activeDocId={activeDoc?.id}
                annotationCounts={annotationCounts}
                onSelectDoc={handleSelectDoc}
              />
            ))}
          </div>
        </div>

        {/* Center + Right panels */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          {activeDoc && (
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
              {/* Priority selector */}
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
                {priorities.map(p => {
                  const cfg = PRIORITY_CONFIG[p];
                  const isActive = p === activePriority;
                  return (
                    <button
                      key={p}
                      onClick={() => handleSetPriority(p)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${isActive ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                      title={cfg.label}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                      <span className="hidden sm:inline">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1" />

              {/* Mark Reviewed & advance */}
              <button
                onClick={handleMarkReviewed}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition-all"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                Mark Reviewed
              </button>

              {/* Detach */}
              <button
                onClick={handleDetach}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                title="Open in new tab"
              >
                <ExternalLinkIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Document Viewer */}
          <div className="flex-1 min-h-0">
            {activeDoc ? (
              <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2Icon className="w-8 h-8 text-indigo-400 animate-spin" /></div>}>
                <DocumentViewer
                  key={activeDoc.id}
                  doc={activeDoc}
                  annotations={activeAnnotations}
                  onAddAnnotation={(page, text, category, x, y, type, imageUrl, width, height, author, eventDate, eventTime) =>
                    onAddAnnotation(page, text, category, x, y, type, imageUrl, width, height, author, eventDate, eventTime, activeDoc.id)
                  }
                  onUpdateAnnotation={onUpdateAnnotation}
                  onDeleteAnnotation={onDeleteAnnotation}
                  onBack={onExit}
                  googleAccessToken={googleAccessToken}
                  initialPage={viewerInitialPage}
                  currentUser={currentUser}
                  allDocuments={flatDocs}
                  onSwitchDocument={(d) => handleSelectDoc(d)}
                />
              </Suspense>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <p className="text-sm">No documents to review</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewMode;
