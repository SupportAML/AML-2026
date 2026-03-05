
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import * as Diff from 'diff';
import { parse } from 'marked';
import * as pdfjsLib from 'pdfjs-dist';

// Normalize whitespace for fuzzy text matching (handles HTML whitespace drift)
const normalizeWs = (s: string) => s.replace(/\s+/g, ' ').trim();

// Convert number to Roman numeral
const toRoman = (num: number): string => {
   const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
   const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
   let result = '';
   for (let i = 0; i < vals.length; i++) {
      while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
   }
   return result;
};

// Find and replace original text in content, with fallback to whitespace-normalized matching
function findAndReplace(content: string, original: string, replacement: string): string | null {
   // 1. Exact match (fast path)
   if (content.includes(original)) {
      return content.replace(original, replacement);
   }
   // 2. Whitespace-normalized search
   const normOriginal = normalizeWs(original);
   // Build a sliding window over content to find the normalized match
   // We search through the content character by character to find a substring
   // whose normalized form matches the normalized original
   const contentLen = content.length;
   const origLen = original.length;
   // Search with a window size range around the original length (allow ±30% for whitespace differences)
   const minWindow = Math.max(1, Math.floor(origLen * 0.7));
   const maxWindow = Math.ceil(origLen * 1.3);
   for (let winSize = minWindow; winSize <= maxWindow; winSize++) {
      for (let i = 0; i <= contentLen - winSize; i++) {
         const slice = content.substring(i, i + winSize);
         if (normalizeWs(slice) === normOriginal) {
            return content.substring(0, i) + replacement + content.substring(i + winSize);
         }
      }
   }
   return null;
}

// Format date from YYYY-MM-DD to "MM/DD/YYYY"
const formatDisplayDate = (dateStr?: string): string | null => {
   if (!dateStr) return null;
   try {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!year || !month || !day) return dateStr;
      return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
   } catch {
      return dateStr;
   }
};
import {
   ArrowLeftIcon,
   FileTextIcon,
   SparklesIcon,
   MessageSquareIcon,
   BrainCircuitIcon,
   MicIcon,
   SendIcon,
   SearchIcon,
   CalendarIcon,
   CheckIcon,
   MessageCircleIcon,
   Loader2Icon,
   GavelIcon,
   ShieldIcon,
   Trash2Icon,
   ArchiveIcon,
   StopCircleIcon,
   ArrowRightIcon,
   ClipboardListIcon,
   StickyNoteIcon,
   LinkIcon,
   XIcon,
   SwordsIcon,
   UserIcon,
   PenToolIcon,
   QuoteIcon,
   ShieldAlertIcon,
   TargetIcon,
   RepeatIcon,
   BookOpenIcon,
   CopyIcon,
   LibraryIcon,
   EyeIcon,
   Edit3Icon,
   PencilIcon,
   ColumnsIcon,
   AlertCircleIcon,
   MapPinIcon,
   GlobeIcon,
   ExternalLinkIcon,
   StethoscopeIcon,
   TerminalIcon,
   ChevronDownIcon,
   ChevronRightIcon,
   LayoutIcon,
   FileCheckIcon,
   UnlockIcon,
   LockIcon,
   ClockIcon,
   MoreHorizontalIcon,
   BoldIcon,
   ItalicIcon,
   UnderlineIcon,
   StrikethroughIcon,
   AlignLeftIcon,
   AlignCenterIcon,
   AlignRightIcon,
   AlignJustifyIcon,
   ListIcon,
   ListOrderedIcon,
   IndentIcon,
   OutdentIcon,
   Undo2Icon,
   Redo2Icon,
   SlidersHorizontalIcon,
   TableIcon,
   GitMergeIcon,
   ImageIcon,
   DownloadIcon,
   PaperclipIcon,
   PlusIcon,
   GripVerticalIcon,
   TypeIcon
} from 'lucide-react';
import { Case, Document, Annotation, UserProfile, ChatMessage, ReportComment, Suggestion, StrategyAnalysis, StructuredChronology, DepoFeedback, ChronologyEvent, ResearchArticle, ResearchGap } from '../types';
import { DepositionSimulation } from './DepositionSimulation';
import { ClinicalDocumentPreview } from './ClinicalDocumentPreview';
import PreviewPanel from './PreviewPanel';
import WriterCommentSidebar from './WriterCommentSidebar';
import { SkeletonLoader } from './SkeletonLoader';
import { VoiceInputButton } from './VoiceInputButton';
import {
   runFullCaseStrategy,
   chatWithDepositionCoach,
   cleanupChronology,
   extractFactsFromNotes,
   rewordClinicalNotes,
   extractHandwrittenNotesFromImage
} from '../services/openaiService';
import {
   chatWithClaude,
   generateReport,
   suggestEdit,
   buildCaseContext,
   searchMedicalResearch,
   insertSmartCitation,
   analyzeReportForResearchGaps,
   LegalChatMessage,
   SuggestionItem
} from '../services/claudeService';
import { extractPdfTextForAnnotations, extractPdfTextFromUrl } from '../services/pdfTextService';

// Template definitions for the sidebar workflow
const SIDEBAR_TEMPLATES = [
   {
      id: 'ime',
      title: 'IME Report',
      desc: 'Independent Medical Examination',
      icon: 'clipboard-list',
      sections: [
         'HEADER', 'QUESTION PRESENTED / SCOPE', 'DOCUMENTS REVIEWED',
         'HISTORY & RECORDS REVIEW', 'EXAMINATION SUMMARY (IF PROVIDED)',
         'DIAGNOSTIC STUDIES', 'ANALYSIS', 'OPINIONS',
         'EXPERT DISCLOSURES (IF PROVIDED)', 'LIMITATIONS', 'CERTIFICATION'
      ]
   },
   {
      id: 'causation',
      title: 'Causation Analysis',
      desc: 'Medical causation & expert opinion',
      icon: 'search',
      sections: [
         'HEADER', 'QUESTION PRESENTED', 'DOCUMENTS REVIEWED',
         'MEDICAL HISTORY & TIMELINE', 'MEDICAL ANALYSIS',
         'CAUSATION OPINION(S)', 'ALTERNATIVE CAUSES',
         'EXPERT DISCLOSURES (IF PROVIDED)', 'LIMITATIONS', 'CERTIFICATION'
      ]
   },
   {
      id: 'rebuttal',
      title: 'Rebuttal Report',
      desc: 'Counter opposing expert opinions',
      icon: 'shield',
      sections: [
         'HEADER', 'SUMMARY OF OPPOSING OPINIONS', 'DOCUMENTS REVIEWED',
         'REBUTTAL ANALYSIS', 'SUPPORTING FACTS/DATA',
         'CONCLUSIONS / OPINIONS', 'EXPERT DISCLOSURES (IF PROVIDED)',
         'LIMITATIONS', 'CERTIFICATION'
      ]
   },
   {
      id: 'chronology',
      title: 'Chronology Summary',
      desc: 'Timeline-focused clinical events',
      icon: 'calendar',
      sections: [
         'HEADER', 'DOCUMENTS REVIEWED', 'CLINICAL TIMELINE',
         'KEY CLINICAL FINDINGS', 'ANALYTICAL NOTES',
         'LIMITATIONS', 'CERTIFICATION'
      ]
   },
   {
      id: 'deposition',
      title: 'Deposition Prep Memo',
      desc: 'Strategic memo with key questions',
      icon: 'file-text',
      sections: [
         'HEADER', 'PURPOSE & SCOPE', 'KEY FACTS',
         'KEY MEDICAL ISSUES', 'LIKELY LINES OF QUESTIONING',
         'EXHIBIT LIST', 'RISK AREAS / WEAKNESSES',
         'LIMITATIONS', 'CERTIFICATION'
      ]
   }
];

interface TemplateSection {
   id: string;
   name: string;
   enabled: boolean;
}

interface SidebarAttachment {
   file: File;
   name: string;
   type: string;
   preview?: string;
   extractedText?: string;
}

interface AnnotationRollupProps {
   caseItem: Case;
   docs: Document[];
   annotations: Annotation[];
   onBack: () => void;
   googleAccessToken: string | null;
   onUpdateCase: (c: Case) => Promise<void> | void;
   onNavigateToSource: (docId: string, page: number) => void;
   onAddAnnotation: (
      page: number,
      text: string,
      category: string,
      x: number,
      y: number,
      type?: any,
      imageUrl?: string,
      width?: number,
      height?: number,
      author?: string,
      eventDate?: string,
      eventTime?: string,
      documentId?: string
   ) => void;
   onUpdateAnnotation: (ann: Annotation) => void;
   onDeleteAnnotation: (id: string) => void;
   onNavigateToAnnotation: (id: string, edit?: boolean) => void;
   currentUser: UserProfile;
}



export const AnnotationRollup: React.FC<AnnotationRollupProps> = ({
   caseItem,
   docs,
   annotations,
   onBack,
   onUpdateCase,
   onNavigateToSource,
   onAddAnnotation,
   onUpdateAnnotation,
   onDeleteAnnotation,
   onNavigateToAnnotation,
   currentUser
}) => {
   // --- Navigation State ---
   const [activeTab, setActiveTab] = useState<'CHRONOLOGY' | 'FACTS' | 'RESEARCH' | 'WRITER' | 'STRATEGY'>('CHRONOLOGY');

   // --- Data State ---
   const [reportContent, setReportContent] = useState<string>(
      caseItem.reportContent ||
      (caseItem.reportSections ? caseItem.reportSections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n') : '')
   );

   // Undo/Redo functionality
   const [undoStack, setUndoStack] = useState<string[]>([]);
   const [redoStack, setRedoStack] = useState<string[]>([]);
   const lastContentRef = useRef<string>(reportContent);
   const reportContentRef = useRef<string>(reportContent);
   reportContentRef.current = reportContent;
   const isUserTypingRef = useRef(false);
   const historyTimerRef = useRef<NodeJS.Timeout | null>(null);
   const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
   const [isSaving, setIsSaving] = useState(false);
   const [strategyData, setStrategyData] = useState<StrategyAnalysis | null>(caseItem.strategyData || null);
   const [chronologyData, setChronologyData] = useState<StructuredChronology | null>(caseItem.chronologyData || null);

   const DEFAULT_TEMPLATE = `1. HEADER: Case name, date, and expert identification.\n2. INTRODUCTION: Brief case overview and purpose of the report.\n3. DOCUMENTS REVIEWED: Detailed list of all materials examined.\n4. PATIENT HISTORY & TIMELINE: Chronological clinical summary.\n5. MEDICAL ANALYSIS: Clinical findings, standard of care, and causation.\n6. PROFESSIONAL OPINION: Final conclusions and recommendations.`;

   const [reportTemplate, setReportTemplate] = useState<string>(caseItem.reportTemplate || DEFAULT_TEMPLATE);
   const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
   const [writerViewMode, setWriterViewMode] = useState<'EDIT' | 'FINAL'>('EDIT');
   const [writerContentKey, setWriterContentKey] = useState(0);
   const [showExportModal, setShowExportModal] = useState(false);
   const [showVersionHistory, setShowVersionHistory] = useState(false);

   // --- UI State ---
   const [isGenerating, setIsGenerating] = useState(false);
   const [showHeaderMenu, setShowHeaderMenu] = useState(false);
   const [additionalContext, setAdditionalContext] = useState(caseItem.additionalContext || '');
   const [freehandNotes, setFreehandNotes] = useState(caseItem.freehandNotes || '');
   const [notesSplit, setNotesSplit] = useState(55);
   const isResizingNotesRef = useRef(false);
   const moreButtonRef = useRef<HTMLButtonElement | null>(null);
   const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);

   // Writer State
   const [writerSidebarMode, setWriterSidebarMode] = useState<'COMMENTS' | 'AI'>(!reportContent ? 'AI' : 'COMMENTS');
   const [selectedTextForComment, setSelectedTextForComment] = useState('');
   const [commentInput, setCommentInput] = useState('');
   const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string } | null>(null);

   // Claude AI Sidebar State
   const [sidebarMessages, setSidebarMessages] = useState<LegalChatMessage[]>([]);
   const [sidebarInput, setSidebarInput] = useState('');
   const [sidebarStreaming, setSidebarStreaming] = useState(false);
   const [sidebarStreamText, setSidebarStreamText] = useState('');
   const [sidebarSuggestions, setSidebarSuggestions] = useState<(SuggestionItem & { id: string; diff: Diff.Change[] })[]>([]);
   const [selectedEditorText, setSelectedEditorText] = useState('');
   const [sidebarPdfContext, setSidebarPdfContext] = useState('');
   const sidebarScrollRef = useRef<HTMLDivElement>(null);

   // Sidebar template workflow state
   const [sidebarTemplateStep, setSidebarTemplateStep] = useState<'select' | 'customize' | 'chat'>(!reportContent ? 'select' : 'chat');
   const [sidebarSelectedTemplate, setSidebarSelectedTemplate] = useState<string | null>(null);
   const [sidebarTemplateSections, setSidebarTemplateSections] = useState<TemplateSection[]>([]);
   const [sidebarCaseDescription, setSidebarCaseDescription] = useState('');
   const [sidebarAttachments, setSidebarAttachments] = useState<SidebarAttachment[]>([]);
   const sidebarFileInputRef = useRef<HTMLInputElement>(null);

   // Preview Panel State
   const [previewSource, setPreviewSource] = useState<{ documentId: string, page: number, annotationId?: string } | null>(null);

   // Voice Input State
   const [isVoiceActiveFactsNotes, setIsVoiceActiveFactsNotes] = useState(false);
   const [isVoiceActiveWriter, setIsVoiceActiveWriter] = useState(false);

   // Store baseline content when voice starts to preserve AI-generated text
   const voiceBaselineContentRef = useRef<string>('');
   // Track cursor position for voice input insertion
   const cursorPositionRef = useRef<number>(0);

   const textareaRef = useRef<HTMLTextAreaElement>(null);
   const editableDivRef = useRef<HTMLDivElement>(null);
   const caseItemRef = useRef(caseItem);
   caseItemRef.current = caseItem;
   const researchScrollRef = useRef<HTMLDivElement>(null);

   // Save on page refresh/close (beforeunload)
   useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
         flushSave();
         e.preventDefault();
         e.returnValue = '';
         return '';
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
   }, []);

   // Keyboard shortcut: Ctrl+Shift+E to open export modal
   useEffect(() => {
      const handler = (e: KeyboardEvent) => {
         const isCtrl = e.ctrlKey || e.metaKey;
         if (isCtrl && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
            e.preventDefault();
            setShowExportModal(true);
            setShowHeaderMenu(false);
         }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
   }, []);

   // Global keyboard handler for textarea undo/redo (captures when textarea focused)
   useEffect(() => {
      const handleGlobalUndoRedo = (e: KeyboardEvent) => {
         // Only handle when our textarea is focused
         if (!textareaRef.current || document.activeElement !== textareaRef.current) return;
         const key = e.key?.toLowerCase();
         const isCtrl = e.ctrlKey || e.metaKey;
         if (!isCtrl) return;

         if (key === 'z' && !e.shiftKey) {
            e.preventDefault();
            handleUndo();
         } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
            e.preventDefault();
            handleRedo();
         }
      };

      document.addEventListener('keydown', handleGlobalUndoRedo);
      return () => document.removeEventListener('keydown', handleGlobalUndoRedo);
   }, [undoStack, redoStack, reportContent]);

   // Update menu position when menu opens or window resizes
   useEffect(() => {
      const updatePos = () => {
         const btn = moreButtonRef.current;
         if (!btn) return setMenuPosition(null);
         const rect = btn.getBoundingClientRect();
         setMenuPosition({ left: rect.left, top: rect.bottom + 8 });
      };
      if (showHeaderMenu) updatePos();
      window.addEventListener('resize', updatePos);
      window.addEventListener('scroll', updatePos, true);
      return () => {
         window.removeEventListener('resize', updatePos);
         window.removeEventListener('scroll', updatePos, true);
      };
   }, [showHeaderMenu]);
   const researchSearchRef = useRef<HTMLDivElement>(null);

   const handleQuickEdit = (prompt: string) => {
      setSidebarInput(prompt);
   };

   // Track text selection from the editor for highlight-based rewriting
   const trackEditorSelection = useCallback(() => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed && editableDivRef.current?.contains(sel.anchorNode)) {
         setSelectedEditorText(sel.toString().trim());
      } else if (sel && sel.anchorNode && editableDivRef.current?.contains(sel.anchorNode)) {
         // Only clear when the collapsed selection is inside the editor (user clicked within editor)
         // Don't clear when focus moves to sidebar input
         setSelectedEditorText('');
      }
   }, []);

   useEffect(() => {
      document.addEventListener('selectionchange', trackEditorSelection);
      return () => document.removeEventListener('selectionchange', trackEditorSelection);
   }, [trackEditorSelection]);

   // Auto-scroll sidebar to bottom
   useEffect(() => {
      if (sidebarScrollRef.current) {
         sidebarScrollRef.current.scrollTop = sidebarScrollRef.current.scrollHeight;
      }
   }, [sidebarMessages, sidebarStreamText, sidebarSuggestions]);

   // Load sidebar PDF context once
   useEffect(() => {
      if (!sidebarPdfContext && annotations.length > 0) {
         extractPdfTextForAnnotations(docs, annotations, {
            perPageCharLimit: 1500,
            totalCharLimit: 12000
         }).then(ctx => setSidebarPdfContext(ctx)).catch(() => {});
      }
   }, [annotations.length]);

   // Research State
   const [researchQuery, setResearchQuery] = useState('');
   // Research State - Initialize from case data if available
   const [researchResults, setResearchResults] = useState<ResearchArticle[]>(caseItem.researchResults || []);
   const [researchGaps, setResearchGaps] = useState<{ topic: string; reason: string }[]>(caseItem.researchGaps || []);
   const [activeCitationProposal, setActiveCitationProposal] = useState<{ id: string; original: string; proposed: string; explanation: string; diff: Diff.Change[] } | null>(null);
   const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
   const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>('');
   const [pdfPreviewDoc, setPdfPreviewDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
   const [pdfPreviewPage, setPdfPreviewPage] = useState(1);
   const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
   const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);
   const pdfPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
   const pdfPreviewContainerRef = useRef<HTMLDivElement>(null);

   // PDF Preview: load document when URL changes
   useEffect(() => {
      if (!pdfPreviewUrl) {
         setPdfPreviewDoc(null);
         setPdfPreviewPage(1);
         setPdfPreviewError(null);
         return;
      }
      let cancelled = false;
      const loadPdf = async () => {
         setPdfPreviewLoading(true);
         setPdfPreviewError(null);
         setPdfPreviewDoc(null);
         setPdfPreviewPage(1);
         try {
            const proxyUrl = `/api/proxy-pdf?url=${encodeURIComponent(pdfPreviewUrl)}`;
            const resp = await fetch(proxyUrl);
            if (!resp.ok) throw new Error(`Failed to fetch PDF (${resp.status})`);
            const buffer = await resp.arrayBuffer();
            if (cancelled) return;
            const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
            if (cancelled) return;
            setPdfPreviewDoc(doc);
         } catch (err: any) {
            if (!cancelled) setPdfPreviewError(err.message || 'Failed to load PDF');
         } finally {
            if (!cancelled) setPdfPreviewLoading(false);
         }
      };
      loadPdf();
      return () => { cancelled = true; };
   }, [pdfPreviewUrl]);

   // PDF Preview: render current page to canvas
   useEffect(() => {
      if (!pdfPreviewDoc || !pdfPreviewCanvasRef.current) return;
      let active = true;
      let renderTask: any = null;

      const renderPage = async () => {
         try {
            const page = await pdfPreviewDoc.getPage(pdfPreviewPage);
            if (!active) return;
            const container = pdfPreviewContainerRef.current;
            const canvas = pdfPreviewCanvasRef.current;
            if (!canvas || !container) return;

            // Scale to fit container width
            const baseViewport = page.getViewport({ scale: 1.0 });
            const scale = Math.min((container.clientWidth - 48) / baseViewport.width, 2.5);
            const viewport = page.getViewport({ scale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');
            if (!context || !active) return;

            if (renderTask) renderTask.cancel();
            renderTask = page.render({ canvasContext: context, viewport });
            await renderTask.promise;
         } catch (err: any) {
            if (err?.name === 'RenderingCancelledException') return;
            if (active) console.error('PDF render error:', err);
         }
      };
      renderPage();
      return () => { active = false; if (renderTask) renderTask.cancel(); };
   }, [pdfPreviewDoc, pdfPreviewPage]);

   // Manual Source Link State
   const [linkingEventId, setLinkingEventId] = useState<string | null>(null);
   const [linkSourceFileId, setLinkSourceFileId] = useState<string>('');
   const [linkSourcePage, setLinkSourcePage] = useState<number>(1);
   const [showFactsLinkModal, setShowFactsLinkModal] = useState(false);

   // Strategy/Depo State - Multiple chat histories per scenario
   const [depoStage, setDepoStage] = useState<'ANALYSIS' | 'SIMULATION'>(caseItem.depoStage || 'ANALYSIS');

   // Migrate old single depoChat to new multi-chat structure
   const initializeDepoChats = () => {
      if (caseItem.depoChats && Object.keys(caseItem.depoChats).length > 0) {
         return caseItem.depoChats;
      }
      // Migration: If old depoChat exists and depoActiveScenario is set, migrate it
      if ((caseItem as any).depoChat && caseItem.depoActiveScenario) {
         return { [caseItem.depoActiveScenario]: (caseItem as any).depoChat };
      }
      return {};
   };

   const [depoChats, setDepoChats] = useState<{ [scenarioId: string]: ChatMessage[] }>(initializeDepoChats());
   const [activeScenarioId, setActiveScenarioId] = useState<string | undefined>(caseItem.depoActiveScenario);
   const chatHistory = activeScenarioId ? (depoChats[activeScenarioId] || []) : [];
   const [chatInput, setChatInput] = useState('');
   const [isChatting, setIsChatting] = useState(false);
   const [isListening, setIsListening] = useState(false);
   const [currentFeedback, setCurrentFeedback] = useState<DepoFeedback | null>(null);
   const chatScrollRef = useRef<HTMLDivElement>(null);

   // Restore depo coaching feedback on mount/tab switch
   useEffect(() => {
      if (depoStage === 'SIMULATION' && activeScenarioId && depoChats[activeScenarioId]) {
         const chat = depoChats[activeScenarioId];
         const lastCoaching = [...chat].reverse().find(m => m.role === 'user' && m.coaching)?.coaching;
         if (lastCoaching && !currentFeedback) {
            setCurrentFeedback(lastCoaching);
         }
      }
   }, [depoStage, activeScenarioId]);

   const [annotationSearchQuery, setAnnotationSearchQuery] = useState('');

   // Chronology UI State
   const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
   const [editingEventId, setEditingEventId] = useState<string | null>(null);
   const editDateRef = useRef<string>('');
   const editTextRef = useRef<string>('');
   const [timelineSubView, setTimelineSubView] = useState<'TIMELINE' | 'MATRIX'>('TIMELINE');
   // Fact Matrix filter state
   const [matrixSearch, setMatrixSearch] = useState('');
   const [matrixCategoryFilter, setMatrixCategoryFilter] = useState('');
   const [matrixSourceFilter, setMatrixSourceFilter] = useState('');
   const [matrixDateFrom, setMatrixDateFrom] = useState('');
   const [matrixDateTo, setMatrixDateTo] = useState('');
   // Merge events state
   const [mergeMode, setMergeMode] = useState(false);
   const [mergeSelectedIds, setMergeSelectedIds] = useState<Set<string>>(new Set());
   // Report Builder state
   const [showTemplateSelector, setShowTemplateSelector] = useState(false);
   const [selectedTemplate, setSelectedTemplate] = useState<string>('');
   // Force re-render trigger
   const [renderKey, setRenderKey] = useState(0);

   // Synchronize reportContent to contentEditable div ONLY when content changes externally
   // (e.g., from AI generation, version restore), NOT from user typing.
   useEffect(() => {
      if (isUserTypingRef.current) {
         // Content changed because user typed — do NOT touch innerHTML (would reset cursor)
         isUserTypingRef.current = false;
         return;
      }
      if (editableDivRef.current && reportContent !== undefined) {
         const currentHTML = editableDivRef.current.innerHTML;
         if (currentHTML !== reportContent) {
            editableDivRef.current.innerHTML = reportContent;
         }
      }
   }, [reportContent, writerContentKey]);

   // Sync reportContent from caseItem when case changes (NOT on every update while editing)
   // Save current content immediately (synchronous helper using refs)
   const flushSave = () => {
      const currentContent = editableDivRef.current?.innerHTML || reportContentRef.current;
      if (currentContent && currentContent !== lastContentRef.current) {
         lastContentRef.current = currentContent;
         onUpdateCase({ ...caseItemRef.current, reportContent: currentContent });
      }
   };

   // When case changes: save OLD case content first, then load new case
   const prevCaseIdRef = useRef(caseItem.id);
   useEffect(() => {
      if (prevCaseIdRef.current !== caseItem.id) {
         // Save content of the previous case before switching
         flushSave();
         // Now load new case content
         const newContent = caseItem.reportContent || '';
         setReportContent(newContent);
         lastContentRef.current = newContent;
         setAdditionalContext(caseItem.additionalContext || '');
         setFreehandNotes(caseItem.freehandNotes || '');
         prevCaseIdRef.current = caseItem.id;
      }
   }, [caseItem.id]);

   // Save on tab switch, restore content when returning to WRITER tab
   const prevTabRef = useRef(activeTab);
   useEffect(() => {
      if (prevTabRef.current === 'WRITER' && activeTab !== 'WRITER') {
         // Leaving WRITER tab — save content
         flushSave();
      }
      if (prevTabRef.current !== 'WRITER' && activeTab === 'WRITER') {
         // Returning to WRITER tab — restore content into the freshly mounted div
         requestAnimationFrame(() => {
            if (editableDivRef.current && reportContentRef.current) {
               editableDivRef.current.innerHTML = reportContentRef.current;
            }
         });
      }
      prevTabRef.current = activeTab;
      return () => { flushSave(); };
   }, [activeTab]);

   // --- Derived State: Live Chronology & Facts ---
   const liveChronology = useMemo(() => {
      const base: StructuredChronology = chronologyData ? JSON.parse(JSON.stringify(chronologyData)) : { years: [], irrelevantFacts: [] };
      const existingIds = new Set<string>();

      // Index existing
      base.years.forEach(y => y.months.forEach(m => m.events.forEach(e => existingIds.add(e.id))));
      base.irrelevantFacts.forEach(f => existingIds.add(f.id));

      // Add new annotations dynamically
      annotations.forEach(ann => {
         if (existingIds.has(ann.id)) return;

         // Undated annotations go to irrelevantFacts (Undated Events)
         if (!ann.eventDate) {
            base.irrelevantFacts.push({
               id: ann.id,
               date: '',
               formattedText: ann.text
            });
            return;
         }

         const date = new Date(ann.eventDate);
         if (isNaN(date.getTime())) {
            base.irrelevantFacts.push({
               id: ann.id,
               date: ann.eventDate,
               formattedText: ann.text
            });
            return;
         }

         const yearStr = date.getFullYear().toString();
         const monthStr = date.toLocaleString('en-US', { month: 'long' });

         let yearGroup = base.years.find(y => y.year === yearStr);
         if (!yearGroup) {
            yearGroup = { year: yearStr, months: [] };
            base.years.push(yearGroup);
            base.years.sort((a, b) => parseInt(a.year) - parseInt(b.year));
         }

         let monthGroup = yearGroup.months.find(m => m.month === monthStr);
         if (!monthGroup) {
            monthGroup = { month: monthStr, events: [] };
            yearGroup.months.push(monthGroup);
            const monthsOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            yearGroup.months.sort((a, b) => monthsOrder.indexOf(a.month) - monthsOrder.indexOf(b.month));
         }

         monthGroup.events.push({
            id: ann.id,
            date: ann.eventDate,
            formattedText: ann.text
         });
         monthGroup.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      });

      return base;
   }, [chronologyData, annotations, renderKey]);

   // --- Flat list of ALL events for Fact Matrix table ---
   const allMatrixEvents = useMemo(() => {
      if (!liveChronology) return [];

      const events: { id: string; date: string; text: string; category: string; source: string; sourceId: string; page: number; isDated: boolean }[] = [];

      // Dated events from timeline
      liveChronology.years.forEach(yr => {
         yr.months.forEach(m => {
            m.events.forEach(ev => {
               const ann = annotations.find(a => a.id === ev.id);
               const src = (() => {
                  if (ann) {
                     if (ann.documentId === 'manual-notes') return { name: 'Manual Notes', id: 'manual-notes', page: 1 };
                     const doc = docs.find(d => d.id === ann.documentId);
                     return doc ? { name: doc.name, id: doc.id, page: ann.page } : null;
                  }
                  // Check if chronology event has manual link
                  if ((ev as any).sourceDocumentId) {
                     const doc = docs.find(d => d.id === (ev as any).sourceDocumentId);
                     return doc ? { name: doc.name, id: doc.id, page: (ev as any).sourcePage || 1 } : null;
                  }
                  return null;
               })();

               events.push({
                  id: ev.id,
                  date: ev.date,
                  text: ev.formattedText,
                  category: ann?.category || 'Review',
                  source: src?.name || 'No Source',
                  sourceId: src?.id || '',
                  page: src?.page || 1,
                  isDated: true
               });
            });
         });
      });

      // Undated events
      liveChronology.irrelevantFacts.forEach(fact => {
         const ann = annotations.find(a => a.id === fact.id);
         const src = (() => {
            if (ann) {
               if (ann.documentId === 'manual-notes') return { name: 'Manual Notes', id: 'manual-notes', page: 1 };
               const doc = docs.find(d => d.id === ann.documentId);
               return doc ? { name: doc.name, id: doc.id, page: ann.page } : null;
            }
            // Check if chronology fact has manual link
            if ((fact as any).sourceDocumentId) {
               const doc = docs.find(d => d.id === (fact as any).sourceDocumentId);
               return doc ? { name: doc.name, id: doc.id, page: (fact as any).sourcePage || 1 } : null;
            }
            return null;
         })();

         events.push({
            id: fact.id,
            date: fact.date || '',
            text: fact.formattedText,
            category: ann?.category || 'Review',
            source: src?.name || 'No Source',
            sourceId: src?.id || '',
            page: src?.page || 1,
            isDated: false
         });
      });

      return events;
   }, [liveChronology, annotations, docs]);

   // --- Filtered matrix events ---
   const filteredMatrixEvents = useMemo(() => {
      return allMatrixEvents.filter(ev => {
         if (matrixSearch) {
            const q = matrixSearch.toLowerCase();
            if (!ev.text.toLowerCase().includes(q) && !ev.source.toLowerCase().includes(q) && !ev.category.toLowerCase().includes(q) && !ev.date.includes(q)) return false;
         }
         if (matrixCategoryFilter && ev.category !== matrixCategoryFilter) return false;
         if (matrixSourceFilter && ev.sourceId !== matrixSourceFilter) return false;
         if (matrixDateFrom && ev.date && ev.date < matrixDateFrom) return false;
         if (matrixDateTo && ev.date && ev.date > matrixDateTo) return false;
         return true;
      });
   }, [allMatrixEvents, matrixSearch, matrixCategoryFilter, matrixSourceFilter, matrixDateFrom, matrixDateTo]);

   // --- Track previous values to detect real changes ---
   const prevDepoChatsRef = useRef<string>(JSON.stringify(caseItem.depoChats || {}));
   const prevDepoStageRef = useRef<string>(caseItem.depoStage || 'ANALYSIS');
   const prevScenarioIdRef = useRef<string | undefined>(caseItem.depoActiveScenario);

   // Migration logic removed to prevent infinite loops


   // --- Sync State from Case Data (when case changes externally, e.g. from Firestore) ---
   // MUST run before persistence effects to avoid write-loop: sync incoming data and update refs
   const isExternalUpdateRef = useRef(false);
   useEffect(() => {
      isExternalUpdateRef.current = true;
      if (caseItem.researchResults && JSON.stringify(caseItem.researchResults) !== JSON.stringify(researchResults)) {
         setResearchResults(caseItem.researchResults);
      }
      if (caseItem.researchGaps && JSON.stringify(caseItem.researchGaps) !== JSON.stringify(researchGaps)) {
         setResearchGaps(caseItem.researchGaps);
      }
      const newChatsStr = JSON.stringify(caseItem.depoChats || {});
      if (newChatsStr !== prevDepoChatsRef.current) {
         setDepoChats(caseItem.depoChats || {});
         prevDepoChatsRef.current = newChatsStr;
      }
      if (caseItem.depoStage !== depoStage) {
         setDepoStage(caseItem.depoStage || 'ANALYSIS');
         prevDepoStageRef.current = caseItem.depoStage || 'ANALYSIS';
      }
      if (caseItem.depoActiveScenario !== activeScenarioId) {
         setActiveScenarioId(caseItem.depoActiveScenario);
         prevScenarioIdRef.current = caseItem.depoActiveScenario;
      }
      // Reset flag after sync so next persistence can run if user actually changed something
      const t = setTimeout(() => { isExternalUpdateRef.current = false; }, 100);
      return () => clearTimeout(t);
   }, [caseItem.id, caseItem.depoChats, caseItem.depoStage, caseItem.depoActiveScenario]);

   // --- Immediate Persistence for Chat History (no debounce) ---
   // Only run when depoChats/depoStage/activeScenarioId change (user action), NOT when caseItem changes (Firestore)
   // Removing caseItem from deps prevents re-running on every Firestore emit (write-loop)
   const caseItemForDepoRef = useRef(caseItem);
   caseItemForDepoRef.current = caseItem;
   useEffect(() => {
      if (isExternalUpdateRef.current) return;
      const currentChatsStr = JSON.stringify(depoChats);
      if (currentChatsStr !== prevDepoChatsRef.current ||
         depoStage !== prevDepoStageRef.current ||
         activeScenarioId !== prevScenarioIdRef.current) {
         prevDepoChatsRef.current = currentChatsStr;
         prevDepoStageRef.current = depoStage;
         prevScenarioIdRef.current = activeScenarioId;
         onUpdateCase({
            ...caseItemForDepoRef.current,
            depoChats,
            depoStage,
            depoActiveScenario: activeScenarioId
         });
      }
   }, [depoChats, depoStage, activeScenarioId, onUpdateCase]);

   // --- Enhanced Persistence with All Tab States (debounced) ---
   useEffect(() => {
      const timer = setTimeout(async () => {
         const c = caseItemRef.current;
         const currentReportContent = editableDivRef.current?.innerHTML || reportContent;

         const hasChanges =
            currentReportContent !== (c.reportContent ?? '') ||
            additionalContext !== (c.additionalContext ?? '') ||
            freehandNotes !== (c.freehandNotes ?? '') ||
            JSON.stringify(strategyData ?? null) !== JSON.stringify(c.strategyData ?? null) ||
            JSON.stringify(chronologyData ?? null) !== JSON.stringify(c.chronologyData ?? null) ||
            JSON.stringify(researchResults ?? null) !== JSON.stringify(c.researchResults ?? null) ||
            JSON.stringify(researchGaps ?? null) !== JSON.stringify(c.researchGaps ?? null) ||
            reportTemplate !== (c.reportTemplate ?? '');

         if (hasChanges) {
            setIsSaving(true);
            try {
               await onUpdateCase({
                  ...c,
                  reportContent: currentReportContent,
                  strategyData: strategyData || undefined,
                  chronologyData: chronologyData || undefined,
                  additionalContext,
                  freehandNotes,
                  researchResults,
                  researchGaps,
                  reportTemplate,
                  reportComments: c.reportComments || []
               });
               lastContentRef.current = currentReportContent;
            } catch (err) {
               console.error('Persistence save failed:', err);
            } finally {
               setIsSaving(false);
            }
         }
      }, 1500);
      return () => clearTimeout(timer);
   }, [reportContent, strategyData, chronologyData, additionalContext, freehandNotes, researchResults, researchGaps, reportTemplate]);

   // --- Handlers: Source Navigation & Linking ---
   const handleJumpToSource = (annotationId: string) => {
      const ann = annotations.find(a => a.id === annotationId);
      if (ann) {
         if (ann.documentId === 'manual-notes') return;
         // Only open preview if the actual doc exists
         const doc = docs.find(d => d.id === ann.documentId);
         if (!doc) {
            handleOpenLinkModal(annotationId); // Prompt user to attach a document
            return;
         }
         setPreviewSource({ documentId: ann.documentId, page: ann.page, annotationId: ann.id });
         return;
      }
      // Check chronology events
      if (chronologyData) {
         let foundEvent: any = null;
         for (const y of chronologyData.years) {
            for (const m of y.months) {
               const ev = m.events.find(e => e.id === annotationId);
               if (ev) foundEvent = ev;
            }
         }
         if (!foundEvent) foundEvent = chronologyData.irrelevantFacts.find(f => f.id === annotationId);
         if (foundEvent && foundEvent.sourceDocumentId) {
            const linkedDoc = docs.find(d => d.id === foundEvent.sourceDocumentId);
            if (!linkedDoc) {
               handleOpenLinkModal(annotationId);
               return;
            }
            setPreviewSource({ documentId: foundEvent.sourceDocumentId, page: foundEvent.sourcePage || 1, annotationId });
            return;
         }
      }
      // No source - open link modal instead of alerting
      handleOpenLinkModal(annotationId);
   };

   const hasSource = (id: string) => {
      const annExists = annotations.some(a => a.id === id);
      if (annExists) return true;
      if (chronologyData) {
         let foundEvent = null;
         chronologyData.years.forEach(y => y.months.forEach(m => {
            const ev = m.events.find(e => e.id === id);
            if (ev) foundEvent = ev;
         }));
         if (!foundEvent) foundEvent = chronologyData.irrelevantFacts.find(f => f.id === id);
         if (foundEvent && (foundEvent as any).sourceDocumentId) return true;
      }
      return false;
   };

   const handleOpenLinkModal = (eventId: string) => {
      setLinkingEventId(eventId);
      if (docs.length > 0) setLinkSourceFileId(docs[0].id);
      setLinkSourcePage(1);
   };

   const handleSaveManualLink = () => {
      if (!linkingEventId) return;
      const selectedDoc = docs.find(d => d.id === linkSourceFileId);

      // 1. Check if the event is a live annotation - update the annotation directly
      const ann = annotations.find(a => a.id === linkingEventId);
      if (ann) {
         onUpdateAnnotation({ ...ann, documentId: linkSourceFileId, page: linkSourcePage });
         setRenderKey(prev => prev + 1);
         setTimeout(() => setLinkingEventId(null), 100);
         return;
      }

      // 2. Otherwise update the chronologyData event
      if (!chronologyData) return;
      const updateEvent = (ev: any) => {
         if (ev.id === linkingEventId) {
            return {
               ...ev,
               sourceDocumentId: linkSourceFileId,
               sourceDocumentName: selectedDoc?.name,
               sourcePage: linkSourcePage
            };
         }
         return ev;
      };
      const newChronology = {
         ...chronologyData,
         years: chronologyData.years.map(y => ({
            ...y,
            months: y.months.map(m => ({ ...m, events: m.events.map(updateEvent) }))
         })),
         irrelevantFacts: chronologyData.irrelevantFacts.map(updateEvent)
      };
      setChronologyData(newChronology);
      onUpdateCase({ ...caseItemRef.current, chronologyData: newChronology });
      setRenderKey(prev => prev + 1);
      setTimeout(() => setLinkingEventId(null), 100);
   };

   // Edit a timeline event's date and/or text
   const handleSaveEventEdit = (eventId: string, newDate: string, newText: string) => {
      // 1. If it's a live annotation, update the annotation directly
      const ann = annotations.find(a => a.id === eventId);
      if (ann) {
         onUpdateAnnotation({ ...ann, eventDate: newDate, text: newText });
         // Proceed to update chronologyData to keep views in sync (remove early return)
      }
      // 2. If it's a chronology event, update in chronologyData
      if (chronologyData) {
         // Remove from old position
         const newChron = JSON.parse(JSON.stringify(chronologyData)) as StructuredChronology;
         let found = false;

         for (const y of newChron.years) {
            for (const m of y.months) {
               const idx = m.events.findIndex(e => e.id === eventId);
               if (idx >= 0) {
                  m.events.splice(idx, 1);
                  found = true;
                  break;
               }
            }
            if (found) break;
         }
         if (!found) {
            const idx = newChron.irrelevantFacts.findIndex(f => f.id === eventId);
            if (idx >= 0) {
               newChron.irrelevantFacts.splice(idx, 1);
               found = true;
            }
         }

         // Re-insert at new date position or back to undated
         const date = new Date(newDate);
         if (newDate && !isNaN(date.getTime())) {
            const yearStr = date.getFullYear().toString();
            const monthStr = date.toLocaleString('en-US', { month: 'long' });
            let yearGroup = newChron.years.find(y => y.year === yearStr);
            if (!yearGroup) {
               yearGroup = { year: yearStr, months: [] };
               newChron.years.push(yearGroup);
               newChron.years.sort((a, b) => parseInt(a.year) - parseInt(b.year));
            }
            let monthGroup = yearGroup.months.find(m => m.month === monthStr);
            if (!monthGroup) {
               monthGroup = { month: monthStr, events: [] };
               yearGroup.months.push(monthGroup);
               const monthsOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
               yearGroup.months.sort((a, b) => monthsOrder.indexOf(a.month) - monthsOrder.indexOf(b.month));
            }
            monthGroup.events.push({ id: eventId, date: newDate, formattedText: newText });
            monthGroup.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
         } else {
            // No valid date - put back in undated
            newChron.irrelevantFacts.push({ id: eventId, date: '', formattedText: newText });
         }

         // Cleanup empty months/years
         newChron.years = newChron.years.map(y => ({
            ...y,
            months: y.months.filter(m => m.events.length > 0)
         })).filter(y => y.months.length > 0);

         setChronologyData(newChron);
         // CRITICAL: Persist to parent case
         onUpdateCase({ ...caseItem, chronologyData: newChron });
      }
      setEditingEventId(null);
      editDateRef.current = '';
      editTextRef.current = '';
   };

   const handleDeleteEvent = (eventId: string) => {
      if (!confirm('Delete this event from timeline? This cannot be undone.')) return;

      // Check if it's an annotation
      const ann = annotations.find(a => a.id === eventId);
      if (ann) {
         onDeleteAnnotation(eventId);
         return;
      }

      // Otherwise delete from chronology
      if (chronologyData) {
         const newChron = JSON.parse(JSON.stringify(chronologyData)) as StructuredChronology;

         // Remove from years/months
         for (const y of newChron.years) {
            for (const m of y.months) {
               const idx = m.events.findIndex(e => e.id === eventId);
               if (idx >= 0) {
                  m.events.splice(idx, 1);
                  break;
               }
            }
         }

         // Remove from undated
         newChron.irrelevantFacts = newChron.irrelevantFacts.filter(f => f.id !== eventId);

         // Cleanup empty months/years
         newChron.years = newChron.years.map(y => ({
            ...y,
            months: y.months.filter(m => m.events.length > 0)
         })).filter(y => y.months.length > 0);

         setChronologyData(newChron);
         onUpdateCase({ ...caseItem, chronologyData: newChron });
      }
   };

   const handleToggleMergeSelect = (eventId: string) => {
      setMergeSelectedIds(prev => {
         const next = new Set(prev);
         if (next.has(eventId)) next.delete(eventId);
         else next.add(eventId);
         return next;
      });
   };

   const handleMergeEvents = () => {
      if (mergeSelectedIds.size < 2) return;
      const ids = Array.from(mergeSelectedIds);

      // Gather all selected events' data (from annotations + chronology)
      const eventData: { id: string; date: string; text: string; isAnnotation: boolean }[] = [];
      for (const id of ids) {
         const ann = annotations.find(a => a.id === id);
         if (ann) {
            eventData.push({ id, date: ann.eventDate || '', text: ann.text, isAnnotation: true });
         } else if (chronologyData) {
            for (const y of chronologyData.years) {
               for (const m of y.months) {
                  const ev = m.events.find(e => e.id === id);
                  if (ev) eventData.push({ id, date: ev.date, text: ev.formattedText, isAnnotation: false });
               }
            }
            const fact = chronologyData.irrelevantFacts.find(f => f.id === id);
            if (fact) eventData.push({ id, date: fact.date || '', text: fact.formattedText, isAnnotation: false });
         }
      }

      if (eventData.length < 2) return;

      // Use earliest valid date as the merged date
      const datesValid = eventData.filter(e => e.date && !isNaN(new Date(e.date).getTime())).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const mergedDate = datesValid.length > 0 ? datesValid[0].date : '';

      // Combine text from all events
      const mergedText = eventData.map(e => e.text).join(' | ');

      // Keep the first event as the primary, delete the rest
      const primary = eventData[0];
      const toRemove = eventData.slice(1);

      // Update primary
      if (primary.isAnnotation) {
         const ann = annotations.find(a => a.id === primary.id);
         if (ann) onUpdateAnnotation({ ...ann, eventDate: mergedDate, text: mergedText });
      } else if (chronologyData) {
         // Update in chronology
         const newChron = JSON.parse(JSON.stringify(chronologyData)) as StructuredChronology;
         // Remove primary from old position
         let primaryEvent: ChronologyEvent | null = null;
         for (const y of newChron.years) {
            for (const m of y.months) {
               const idx = m.events.findIndex(e => e.id === primary.id);
               if (idx >= 0) { primaryEvent = m.events.splice(idx, 1)[0]; break; }
            }
         }
         if (!primaryEvent) {
            const idx = newChron.irrelevantFacts.findIndex(f => f.id === primary.id);
            if (idx >= 0) primaryEvent = newChron.irrelevantFacts.splice(idx, 1)[0];
         }
         if (primaryEvent) {
            primaryEvent.date = mergedDate;
            primaryEvent.formattedText = mergedText;
            // Re-insert at correct date position
            const date = new Date(mergedDate);
            if (!isNaN(date.getTime())) {
               const yearStr = date.getFullYear().toString();
               const monthStr = date.toLocaleString('en-US', { month: 'long' });
               let yearGroup = newChron.years.find(y => y.year === yearStr);
               if (!yearGroup) { yearGroup = { year: yearStr, months: [] }; newChron.years.push(yearGroup); newChron.years.sort((a, b) => parseInt(a.year) - parseInt(b.year)); }
               let monthGroup = yearGroup.months.find(m => m.month === monthStr);
               if (!monthGroup) { monthGroup = { month: monthStr, events: [] }; yearGroup.months.push(monthGroup); }
               monthGroup.events.push(primaryEvent);
               monthGroup.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            } else {
               newChron.irrelevantFacts.push(primaryEvent);
            }
         }
         setChronologyData(newChron);
      }

      // Remove secondary events
      for (const rm of toRemove) {
         if (rm.isAnnotation) {
            const ann = annotations.find(a => a.id === rm.id);
            if (ann) onDeleteAnnotation(rm.id);
         } else if (chronologyData) {
            setChronologyData(prev => {
               if (!prev) return prev;
               const c = JSON.parse(JSON.stringify(prev)) as StructuredChronology;
               for (const y of c.years) {
                  for (const m of y.months) {
                     const idx = m.events.findIndex(e => e.id === rm.id);
                     if (idx >= 0) m.events.splice(idx, 1);
                  }
               }
               c.irrelevantFacts = c.irrelevantFacts.filter(f => f.id !== rm.id);
               c.years = c.years.map(y => ({ ...y, months: y.months.filter(m => m.events.length > 0) })).filter(y => y.months.length > 0);
               return c;
            });
         }
      }

      setMergeMode(false);
      setMergeSelectedIds(new Set());
   };

   const getEventSourceInfo = (eventId: string) => {
      // 1. Check annotations - only return if the doc actually exists
      const ann = annotations.find(a => a.id === eventId);
      if (ann) {
         if (ann.documentId === 'manual-notes') return null; // Manual notes have no PDF source
         const doc = docs.find(d => d.id === ann.documentId);
         if (!doc) return null; // Doc doesn't exist - don't show "Unknown Document"
         return { name: doc.name, page: ann.page, id: ann.documentId };
      }
      // 2. Check manually linked chronology events
      if (chronologyData) {
         let found: any = null;
         chronologyData.years.forEach(y => y.months.forEach(m => {
            const ev = m.events.find(e => e.id === eventId);
            if (ev) found = ev;
         }));
         if (!found) found = chronologyData.irrelevantFacts.find(f => f.id === eventId);
         if (found && found.sourceDocumentId) {
            const linkedDoc = docs.find(d => d.id === found.sourceDocumentId);
            if (!linkedDoc) return null; // Linked doc no longer exists
            return { name: linkedDoc.name, page: found.sourcePage || 1, id: found.sourceDocumentId };
         }
      }
      return null;
   };

   const handleCleanupChronology = async () => {
      setIsGenerating(true);

      try {
         let addedCount = 0;

         // Step 1: If there are notes in additionalContext, extract facts from them
         if (additionalContext.trim()) {
            const extractedFacts = await extractFactsFromNotes(additionalContext);

            if (extractedFacts && extractedFacts.length > 0) {
               extractedFacts.forEach(fact => {
                  const normalizedFactText = (fact.text || '').toLowerCase().trim();
                  const exists = annotations.some(a => {
                     const normalizedAnnText = (a.text || '').toLowerCase().trim();
                     if (normalizedAnnText === normalizedFactText) return true;
                     if (fact.eventDate && a.eventDate && fact.eventDate === a.eventDate &&
                        (normalizedAnnText.includes(normalizedFactText) || normalizedFactText.includes(normalizedAnnText))) return true;
                     return false;
                  });

                  if (!exists) {
                     onAddAnnotation(
                        1,
                        fact.text || '',
                        fact.category || 'Observation',
                        0, 0,
                        'point',
                        undefined, undefined, undefined,
                        currentUser.name,
                        fact.eventDate || undefined,
                        undefined,
                        'manual-notes'
                     );
                     addedCount++;
                  }
               });
            }
         }

         // Step 2: Persist any dynamic annotations into chronologyData
         // This commits annotations that are only shown via liveChronology into the stored structure
         const base: StructuredChronology = chronologyData
            ? JSON.parse(JSON.stringify(chronologyData))
            : { years: [], irrelevantFacts: [] };
         const existingIds = new Set<string>();
         base.years.forEach(y => y.months.forEach(m => m.events.forEach(e => existingIds.add(e.id))));
         base.irrelevantFacts.forEach(f => existingIds.add(f.id));

         let committedCount = 0;
         annotations.forEach(ann => {
            if (existingIds.has(ann.id)) return;

            const newEvent: ChronologyEvent = {
               id: ann.id,
               date: ann.eventDate || '',
               formattedText: ann.text,
               sourceDocumentId: ann.documentId !== 'manual-notes' ? ann.documentId : undefined,
               sourceDocumentName: ann.documentId !== 'manual-notes' ? docs.find(d => d.id === ann.documentId)?.name : undefined,
               sourcePage: ann.documentId !== 'manual-notes' ? ann.page : undefined
            };

            if (ann.eventDate) {
               const date = new Date(ann.eventDate);
               if (!isNaN(date.getTime())) {
                  const yearStr = date.getFullYear().toString();
                  const monthStr = date.toLocaleString('en-US', { month: 'long' });
                  let yearGroup = base.years.find(y => y.year === yearStr);
                  if (!yearGroup) {
                     yearGroup = { year: yearStr, months: [] };
                     base.years.push(yearGroup);
                     base.years.sort((a, b) => parseInt(a.year) - parseInt(b.year));
                  }
                  let monthGroup = yearGroup.months.find(m => m.month === monthStr);
                  if (!monthGroup) {
                     monthGroup = { month: monthStr, events: [] };
                     yearGroup.months.push(monthGroup);
                     const monthsOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                     yearGroup.months.sort((a, b) => monthsOrder.indexOf(a.month) - monthsOrder.indexOf(b.month));
                  }
                  monthGroup.events.push(newEvent);
                  monthGroup.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
               } else {
                  base.irrelevantFacts.push(newEvent);
               }
            } else {
               base.irrelevantFacts.push(newEvent);
            }
            committedCount++;
         });

         if (committedCount > 0) {
            setChronologyData(base);
            onUpdateCase({ ...caseItemRef.current, chronologyData: base });
         }

         if (addedCount > 0 || committedCount > 0) {
            console.log(`Organized: ${addedCount} new facts extracted, ${committedCount} annotations committed to timeline.`);
         } else {
            console.log('Timeline is already up to date.');
         }

         // DO NOT clear additionalContext - preserve the original notes with dates intact
         setActiveTab('CHRONOLOGY');
         setRenderKey(prev => prev + 1);
      } catch (error) {
         console.error("Failed to organize timeline:", error);
         alert("Failed to organize timeline. Please try again.");
      } finally {
         setIsGenerating(false);
      }
   };

   const handleRewordNotes = async () => {
      if (!additionalContext.trim()) return;
      setIsGenerating(true);
      try {
         const reformatted = await rewordClinicalNotes(additionalContext, caseItem.title);
         setAdditionalContext(reformatted);
      } catch (error) {
         console.error("Failed to reword notes:", error);
         alert("Failed to reword notes. Please try again.");
      } finally {
         setIsGenerating(false);
      }
   };

   const insertTimestamp = () => {
      const now = new Date().toLocaleString('en-US', {
         year: 'numeric', month: 'numeric', day: 'numeric',
         hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true
      });
      const stamp = `(${now})\n`;
      setAdditionalContext(prev => prev + (prev.endsWith('\n') ? '' : '\n') + stamp);
   };

   const insertHeader = (title: string) => {
      const header = `\n## ${title}\n`;
      setAdditionalContext(prev => prev + (prev.endsWith('\n') ? '' : '\n') + header);
   };

   const insertSourceRef = (docName: string, page: number = 1) => {
      const ref = `\n(["${docName}", p. ${page}])\n`;
      setAdditionalContext(prev => prev + (prev.endsWith('\n') ? '' : '\n') + ref);
   };

   // --- Handlers: Voice Input ---
   const handleVoiceTranscriptionFactsNotes = (text: string) => {
      // In 'append' mode, VoiceInputButton only sends finalized phrases
      // We just need to append them to the existing content with proper spacing
      setAdditionalContext(prev => {
         if (!prev) return text;
         const separator = prev.endsWith('\n') || prev.endsWith(' ') ? '' : ' ';
         return prev + separator + text;
      });
   };

   const handwrittenImageInputRef = useRef<HTMLInputElement>(null);
   const factsNotesTextareaRef = useRef<HTMLTextAreaElement>(null);

   const resizeImageForExtraction = (file: File): Promise<{ base64: string; mediaType: 'image/jpeg' }> => {
      return new Promise((resolve, reject) => {
         const img = new Image();
         const url = URL.createObjectURL(file);
         img.onload = () => {
            URL.revokeObjectURL(url);
            const MAX_DIM = 1200;
            let w = img.width, h = img.height;
            if (w > MAX_DIM || h > MAX_DIM) {
               if (w > h) { h = (h * MAX_DIM) / w; w = MAX_DIM; }
               else { w = (w * MAX_DIM) / h; h = MAX_DIM; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w);
            canvas.height = Math.round(h);
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas failed')); return; }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const b64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
            resolve({ base64: b64 || '', mediaType: 'image/jpeg' });
         };
         img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
         img.src = url;
      });
   };

   const handleConvertHandwrittenNotes = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
         alert('Please upload a JPEG, PNG, GIF, or WebP image.');
         return;
      }
      if (file.size > 10 * 1024 * 1024) {
         alert('Image must be under 10MB.');
         return;
      }
      setIsGenerating(true);
      try {
         const { base64, mediaType } = await resizeImageForExtraction(file);
         const points = await extractHandwrittenNotesFromImage(base64, mediaType);
         if (points === '(No readable text found)') {
            alert('Could not extract text from this image. Please try a clearer photo.');
            return;
         }
         const prefix = freehandNotes.trim() ? '\n\n' : '';
         const appended = `--- From handwritten notes ---\n${points}\n`;
         setFreehandNotes(prev => prev + prefix + appended);
         setTimeout(() => {
            if (factsNotesTextareaRef.current) {
               factsNotesTextareaRef.current.focus();
               factsNotesTextareaRef.current.scrollTop = factsNotesTextareaRef.current.scrollHeight;
            }
         }, 100);
      } catch (err) {
         console.error('Handwritten notes extraction error:', err);
         alert('Failed to extract text. Please try again.');
      } finally {
         setIsGenerating(false);
      }
   };

   const handleVoiceTranscriptionWriter = (text: string) => {
      // For contentEditable: insert at current cursor using execCommand
      if (editableDivRef.current) {
         editableDivRef.current.focus();
         document.execCommand('insertText', false, text);
         // Sync state
         const html = editableDivRef.current.innerHTML;
         setReportContent(html);
         pushToUndoStack(html);
         return;
      }
      // Fallback for textarea
      setReportContent(prev => {
         if (!prev) return text;
         const cursorPos = cursorPositionRef.current;
         const before = prev.substring(0, cursorPos);
         const after = prev.substring(cursorPos);
         const needsSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
         const needsSpaceAfter = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n');
         const separator = needsSpaceBefore ? ' ' : '';
         const separatorAfter = needsSpaceAfter ? ' ' : '';
         const newContent = before + separator + text + separatorAfter + after;
         const newCursorPos = before.length + separator.length + text.length + separatorAfter.length;
         cursorPositionRef.current = newCursorPos;
         setTimeout(() => {
            if (textareaRef.current) {
               textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
               textareaRef.current.focus();
            }
         }, 0);
         return newContent;
      });
   };

   // --- Undo/Redo Handlers ---
   const handleUndo = () => {
      if (undoStack.length === 0) return;

      const previousState = undoStack[undoStack.length - 1];
      const newUndoStack = undoStack.slice(0, -1);

      // Push current state to redo stack
      setRedoStack(prev => [...prev, reportContent]);
      setUndoStack(newUndoStack);
      setReportContent(previousState);
      lastContentRef.current = previousState;
   };

   const handleRedo = () => {
      if (redoStack.length === 0) return;

      const nextState = redoStack[redoStack.length - 1];
      const newRedoStack = redoStack.slice(0, -1);

      // Push current state to undo stack
      setUndoStack(prev => [...prev, reportContent]);
      setRedoStack(newRedoStack);
      setReportContent(nextState);
      lastContentRef.current = nextState;
   };

   // Debounced history update - only save to undo stack after 500ms of no changes
   const pushToUndoStack = (content: string) => {
      if (historyTimerRef.current) {
         clearTimeout(historyTimerRef.current);
      }

      historyTimerRef.current = setTimeout(() => {
         if (content !== lastContentRef.current && lastContentRef.current) {
            setUndoStack(prev => {
               const newStack = [...prev, lastContentRef.current];
               // Limit history to 50 states to prevent memory issues
               return newStack.length > 50 ? newStack.slice(-50) : newStack;
            });
            // Clear redo stack when new changes are made
            setRedoStack([]);
         }
         lastContentRef.current = content;
      }, 500);
   };

   // --- Handlers: Research (Updated Flow) ---
   const handleAnalyzeGaps = async () => {
      setIsGenerating(true);
      const gaps = await analyzeReportForResearchGaps(reportContent);
      setResearchGaps(gaps);
      setIsGenerating(false);
   };

   const handleResearchTopic = async (topic: string) => {
      setResearchQuery(topic);

      // Auto-scroll to search bar
      if (researchSearchRef.current) {
         researchSearchRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      setIsGenerating(true);
      const results = await searchMedicalResearch(topic);
      setResearchResults(results);
      setIsGenerating(false);
   };

   const handleSmartCite = async (article: ResearchArticle) => {
      setIsGenerating(true);
      try {
         const result = await insertSmartCitation(reportContent, article);

         // Post-processing: protect header area (first 10 lines)
         const originalLines = reportContent.split('\n');
         const proposedLines = result.newContent.split('\n');
         const PROTECTED_LINES = 10;

         let protectedContent = result.newContent;
         const headerChanged = originalLines.slice(0, PROTECTED_LINES).some(
            (line, i) => proposedLines[i] !== line
         );
         if (headerChanged && proposedLines.length >= PROTECTED_LINES) {
            const originalHeader = originalLines.slice(0, PROTECTED_LINES).join('\n');
            const proposedBody = proposedLines.slice(PROTECTED_LINES).join('\n');
            protectedContent = originalHeader + '\n' + proposedBody;
         }

         const diff = Diff.diffWords(reportContent, protectedContent);
         setActiveCitationProposal({
            id: Date.now().toString(),
            original: reportContent,
            proposed: protectedContent,
            explanation: result.explanation,
            diff
         });
      } catch (error) {
         console.error("Smart cite failed:", error);
         alert("Failed to insert citation. Please try again.");
      } finally {
         setIsGenerating(false);
      }
   };

   const handleAcceptCitation = () => {
      if (activeCitationProposal) {
         // Push current state to undo stack before accepting citation
         setUndoStack(prev => [...prev, reportContent].slice(-50));
         setRedoStack([]);
         setReportContent(activeCitationProposal.proposed);
         lastContentRef.current = activeCitationProposal.proposed;
         setActiveCitationProposal(null);
         alert("Citation inserted and bibliography updated.");
      }
   };

   const handleResearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!researchQuery.trim()) return;
      setIsGenerating(true);
      const results = await searchMedicalResearch(researchQuery);
      setResearchResults(results);
      setIsGenerating(false);
   };

   const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Citation copied to clipboard");
   };

   // --- Handlers: Writer (Claude AI Sidebar) ---
   const handleSidebarSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const userText = sidebarInput.trim();
      if (!userText || sidebarStreaming) return;

      // If text is selected in editor, route to structured suggestions
      if (selectedEditorText) {
         setSidebarInput('');
         setSidebarStreaming(true);
         const userMsg: LegalChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: `[Selection: "${selectedEditorText.slice(0, 80)}${selectedEditorText.length > 80 ? '...' : ''}"]\n${userText}`,
            timestamp: Date.now(),
         };
         setSidebarMessages(prev => [...prev, userMsg]);

         try {
            const result = await suggestEdit(selectedEditorText, userText, true);
            const suggestions = (result.suggestions || [])
               .filter(s => s.original && s.suggested)
               .slice(0, 6)
               .map((s, idx) => ({
                  ...s,
                  id: `${Date.now()}_${idx}`,
                  diff: Diff.diffWords(s.original, s.suggested),
               }));
            setSidebarSuggestions(suggestions);

            const assistantMsg: LegalChatMessage = {
               id: (Date.now() + 1).toString(),
               role: 'assistant',
               content: suggestions.length > 0
                  ? `Found ${suggestions.length} suggested edit${suggestions.length > 1 ? 's' : ''} for your selection.`
                  : 'No edits suggested for this selection.',
               timestamp: Date.now(),
            };
            setSidebarMessages(prev => [...prev, assistantMsg]);
         } catch (err: any) {
            const errMsg: LegalChatMessage = {
               id: (Date.now() + 1).toString(),
               role: 'assistant',
               content: `Error: ${err.message || 'Failed to get suggestions.'}`,
               timestamp: Date.now(),
            };
            setSidebarMessages(prev => [...prev, errMsg]);
         } finally {
            setSidebarStreaming(false);
         }
         return;
      }

      // No selection — route to full-document suggestions if it looks like an edit instruction
      const isEditRequest = /\b(make|rewrite|rephrase|improve|fix|change|revise|edit|authoritative|concise|critique|summarize|shorten|expand)\b/i.test(userText);

      if (isEditRequest && reportContent.trim()) {
         setSidebarInput('');
         setSidebarStreaming(true);
         const userMsg: LegalChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: userText,
            timestamp: Date.now(),
         };
         setSidebarMessages(prev => [...prev, userMsg]);

         try {
            const result = await suggestEdit(reportContent, userText, false);
            const suggestions = (result.suggestions || [])
               .filter(s => s.original && s.suggested)
               .slice(0, 8)
               .map((s, idx) => ({
                  ...s,
                  id: `${Date.now()}_${idx}`,
                  diff: Diff.diffWords(s.original, s.suggested),
               }));
            setSidebarSuggestions(suggestions);

            const assistantMsg: LegalChatMessage = {
               id: (Date.now() + 1).toString(),
               role: 'assistant',
               content: suggestions.length > 0
                  ? `Found ${suggestions.length} suggested edit${suggestions.length > 1 ? 's' : ''} across the document.`
                  : 'No edits suggested for this request.',
               timestamp: Date.now(),
            };
            setSidebarMessages(prev => [...prev, assistantMsg]);
         } catch (err: any) {
            const errMsg: LegalChatMessage = {
               id: (Date.now() + 1).toString(),
               role: 'assistant',
               content: `Error: ${err.message || 'Failed to get suggestions.'}`,
               timestamp: Date.now(),
            };
            setSidebarMessages(prev => [...prev, errMsg]);
         } finally {
            setSidebarStreaming(false);
         }
         return;
      }

      // General chat — conversation with Claude (streaming)
      setSidebarInput('');
      setSidebarStreaming(true);
      setSidebarStreamText('');
      const userMsg: LegalChatMessage = {
         id: Date.now().toString(),
         role: 'user',
         content: userText,
         timestamp: Date.now(),
      };
      const updatedMessages = [...sidebarMessages, userMsg];
      setSidebarMessages(updatedMessages);

      try {
         // Include attachment context in PDF text
         let enrichedPdfContext = sidebarPdfContext;
         if (sidebarAttachments.length > 0) {
            const attachmentTexts = sidebarAttachments
               .filter(a => a.extractedText)
               .map(a => `[Attached: ${a.name}]\n${a.extractedText}`)
               .join('\n\n');
            if (attachmentTexts) {
               enrichedPdfContext = (enrichedPdfContext ? enrichedPdfContext + '\n\n' : '') + attachmentTexts;
            }
         }

         const caseContext = buildCaseContext(
            caseItem,
            docs,
            annotations,
            enrichedPdfContext,
            currentUser,
            reportContentRef.current
         );

         const fullResponse = await chatWithClaude(
            updatedMessages,
            caseContext,
            (accumulated) => setSidebarStreamText(accumulated)
         );

         const assistantMsg: LegalChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: fullResponse,
            timestamp: Date.now(),
         };
         const finalMessages = [...updatedMessages, assistantMsg];
         setSidebarMessages(finalMessages);
         setSidebarStreamText('');

         // Persist to case
         onUpdateCase({
            ...caseItemRef.current,
            legalChatHistory: finalMessages.slice(-50),
         });
      } catch (err: any) {
         const errMsg: LegalChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Error: ${err.message || 'Failed to get response from Claude.'}`,
            timestamp: Date.now(),
         };
         setSidebarMessages(prev => [...prev, errMsg]);
      } finally {
         setSidebarStreaming(false);
      }
   };

   const handleAcceptSuggestion = (suggestion: SuggestionItem & { id: string }) => {
      const currentContent = reportContentRef.current || reportContent;
      const updated = findAndReplace(currentContent, suggestion.original, suggestion.suggested);
      if (updated === null) {
         alert("Could not locate the original excerpt in the document. The section may have been modified since this suggestion was generated.");
         return;
      }
      setUndoStack(prev => [...prev, currentContent].slice(-50));
      setRedoStack([]);
      setReportContent(updated);
      lastContentRef.current = updated;
      setWriterContentKey(prev => prev + 1);
      setSidebarSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
   };

   const handleRejectSuggestion = (id: string) => {
      setSidebarSuggestions(prev => prev.filter(s => s.id !== id));
   };

   const handleAcceptAllSuggestions = () => {
      if (sidebarSuggestions.length === 0) return;
      let updated = reportContentRef.current || reportContent;
      setUndoStack(prev => [...prev, updated].slice(-50));
      setRedoStack([]);
      for (const s of sidebarSuggestions) {
         const result = findAndReplace(updated, s.original, s.suggested);
         if (result !== null) {
            updated = result;
         }
      }
      setReportContent(updated);
      lastContentRef.current = updated;
      setWriterContentKey(prev => prev + 1);
      setSidebarSuggestions([]);
   };

   const handleInsertFromChat = (markdownContent: string) => {
      const html = parse(markdownContent) as string;
      const currentContent = reportContentRef.current || reportContent;
      setUndoStack(prev => [...prev, currentContent].slice(-50));
      setRedoStack([]);
      const updatedHtml = currentContent + html;
      setReportContent(updatedHtml);
      lastContentRef.current = updatedHtml;
      setWriterContentKey(prev => prev + 1);
      onUpdateCase({ ...caseItemRef.current, reportContent: updatedHtml });
   };

   const handleClearSidebar = () => {
      if (!confirm('Clear all chat history?')) return;
      setSidebarMessages([]);
      setSidebarSuggestions([]);
      setSidebarStreamText('');
      onUpdateCase({ ...caseItemRef.current, legalChatHistory: [] });
   };

   // --- Handlers: Writer (Comments) ---
   const handleTextSelect = () => {
      // Use Selection API for contentEditable
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
         const range = selection.getRangeAt(0);
         const rect = range.getBoundingClientRect();
         setSelectionPopup({
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
            text: selection.toString()
         });
      } else if (textareaRef.current) {
         // Fallback for legacy textarea
         const start = textareaRef.current.selectionStart;
         const end = textareaRef.current.selectionEnd;
         if (start !== end) {
            const selected = reportContent.substring(start, end);
            setSelectionPopup({
               x: window.innerWidth / 2,
               y: 100,
               text: selected
            });
         }
      } else {
         setSelectionPopup(null);
      }
   };

   const handleCreateComment = () => {
      if (selectionPopup) {
         setSelectedTextForComment(selectionPopup.text);
         setWriterSidebarMode('COMMENTS');
         setSelectionPopup(null);
      }
   };

   const handleEditWithAI = () => {
      if (selectionPopup) {
         setSelectedEditorText(selectionPopup.text);
         setWriterSidebarMode('AI');
         setSelectionPopup(null);
      }
   };

   const handleAddComment = () => {
      if (!commentInput.trim()) return;

      const newComment: ReportComment = {
         id: Date.now().toString(),
         sectionId: 'main',
         author: currentUser.name,
         text: commentInput,
         context: selectedTextForComment,
         timestamp: Date.now(),
         resolved: false,
         replies: []
      };

      onUpdateCase({
         ...caseItem,
         reportComments: [...(caseItem.reportComments || []), newComment]
      });

      setCommentInput('');
      setSelectedTextForComment('');
   };

   const handleLocateComment = (context: string) => {
      if (!context) return;
      // Use contentEditable Selection API
      if (editableDivRef.current) {
         const walker = document.createTreeWalker(editableDivRef.current, NodeFilter.SHOW_TEXT);
         let fullText = '';
         const textNodes: { node: Text; start: number }[] = [];
         while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            textNodes.push({ node, start: fullText.length });
            fullText += node.textContent || '';
         }
         const index = fullText.indexOf(context);
         if (index === -1) { alert("Text not found in current document version."); return; }
         let startNode: Text | null = null, startOffset = 0;
         let endNode: Text | null = null, endOffset = 0;
         for (const { node, start } of textNodes) {
            const nodeEnd = start + (node.textContent?.length || 0);
            if (!startNode && index < nodeEnd) { startNode = node; startOffset = index - start; }
            if (index + context.length <= nodeEnd) { endNode = node; endOffset = index + context.length - start; break; }
         }
         if (startNode && endNode) {
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            // Scroll the found text into view
            const rect = range.getBoundingClientRect();
            const container = editableDivRef.current.closest('.overflow-y-auto');
            if (container) {
               const containerRect = container.getBoundingClientRect();
               container.scrollTop += rect.top - containerRect.top - 100;
            }
            // Temporary highlight
            try {
               const mark = document.createElement('mark');
               mark.className = 'bg-yellow-200 transition-all duration-1000';
               range.surroundContents(mark);
               setTimeout(() => {
                  const parent = mark.parentNode;
                  if (parent) { parent.replaceChild(document.createTextNode(mark.textContent || ''), mark); parent.normalize(); }
               }, 2000);
            } catch { /* surroundContents can fail on partial node selections */ }
         }
      } else if (textareaRef.current) {
         // Fallback for textarea
         const index = reportContent.indexOf(context);
         if (index !== -1) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(index, index + context.length);
            const lineHeight = 24;
            const lines = reportContent.substring(0, index).split('\n').length;
            textareaRef.current.scrollTop = lines * lineHeight - 100;
         } else {
            alert("Text not found in current document version.");
         }
      }
   };

   const handleResolveComment = (id: string) => {
      const updated = (caseItem.reportComments || []).map(c =>
         c.id === id ? { ...c, resolved: !c.resolved } : c
      );
      onUpdateCase({ ...caseItem, reportComments: updated });
   };

   const handleDeleteComment = (id: string) => {
      const updated = (caseItem.reportComments || []).filter(c => c.id !== id);
      onUpdateCase({ ...caseItem, reportComments: updated });
   };

   const handleSaveDraft = async () => {
      // Read current content from contentEditable div (HTML) or fallback to state
      const currentContent = editableDivRef.current?.innerHTML || reportContentRef.current;
      if (!currentContent.trim()) {
         alert("No content to save.");
         return;
      }

      try {
         setIsSaving(true);
         // Create version snapshot
         const newVersion = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            content: currentContent,
            status: 'draft' as const,
            author: currentUser.name,
            label: 'Saved Version'
         };

         await onUpdateCase({
            ...caseItemRef.current,
            reportContent: currentContent,
            draftVersions: [...(caseItemRef.current.draftVersions || []), newVersion].slice(-20)
         });

         setReportContent(currentContent);
         lastContentRef.current = currentContent;
         alert("Version saved successfully! Your draft is now persisted.");
      } catch (error) {
         console.error("Failed to save version:", error);
         alert("Failed to save version. Please try again.");
      } finally {
         setIsSaving(false);
      }
   };

   const handleFinalizeReport = () => {
      // Read current content from contentEditable div (HTML) or fallback to state
      const currentContent = editableDivRef.current?.innerHTML || reportContentRef.current;
      if (!currentContent.trim()) return;

      // Create version snapshot (no AI call - just snapshot and export)
      const newVersion = {
         id: Date.now().toString(),
         date: new Date().toISOString(),
         content: currentContent,
         status: 'finalized' as const,
         author: currentUser.name,
         label: 'Finalized Draft'
      };

      onUpdateCase({
         ...caseItemRef.current,
         reportContent: currentContent,
         draftVersions: [...(caseItemRef.current.draftVersions || []), newVersion].slice(-20)
      });

      setReportContent(currentContent);
      lastContentRef.current = currentContent;
      setShowExportModal(true);
   };

   // --- Export Functions ---
   const trackExport = (format: 'pdf' | 'word' | 'text' | 'clipboard', fileName?: string) => {
      const exportRecord = {
         id: Date.now().toString(),
         date: new Date().toISOString(),
         format,
         user: currentUser.name,
         fileName
      };

      onUpdateCase({
         ...caseItem,
         exportHistory: [...(caseItem.exportHistory || []), exportRecord]
      });
   };

   const exportAsPDF = () => {
      try {
         const fileName = `${caseItem.title.replace(/[^a-z0-9]/gi, '_')}_Report.pdf`;
         trackExport('pdf', fileName);

         // Create a printable HTML version
         const printWindow = window.open('', '_blank');
         if (!printWindow) {
            alert('Please allow popups to export PDF');
            return;
         }

         const htmlContent = `
<!DOCTYPE html>
<html>
<head>
   <meta charset="UTF-8">
   <title>${caseItem.title} - Medical-Legal Report</title>
   <style>
      @page {
         size: letter;
         margin: 1in 1in 1.2in 1in;
         @bottom-right {
            content: counter(page);
            font-family: 'Times New Roman', serif;
            font-size: 10pt;
            color: #333;
         }
      }

      body {
         font-family: 'Times New Roman', 'Liberation Serif', Times, serif;
         font-size: 12pt;
         line-height: 2.0;
         color: #000;
         margin: 0;
         padding: 0;
         background: white;
         counter-reset: page;
      }

      /* Heading styles - bold, minimal spacing */
      h1, h2, h3, h4, h5, h6 {
         font-family: 'Times New Roman', 'Liberation Serif', Times, serif;
         font-weight: bold;
         margin-top: 12pt;
         margin-bottom: 6pt;
         page-break-after: avoid;
         line-height: 1.2;
      }
      h1 { font-size: 14pt; text-align: center; }
      h2 { font-size: 13pt; }
      h3 { font-size: 12pt; }

      p {
         margin: 0;
         text-align: justify;
         orphans: 3;
         widows: 3;
      }

      pre {
         white-space: pre-wrap;
         font-family: 'Times New Roman', 'Liberation Serif', Times, serif;
         font-size: 12pt;
         line-height: 2.0;
         margin: 0;
      }

      ul, ol {
         margin: 6pt 0;
      }

      li {
         margin: 3pt 0;
      }

      /* Fallback page number footer for browsers without @page @bottom-right */
      .page-footer {
         position: fixed;
         bottom: 0.3in;
         right: 0.5in;
         font-family: 'Times New Roman', serif;
         font-size: 10pt;
         color: #333;
      }
   </style>
</head>
<body>
   <div class="page-footer" id="pageFooter"></div>
   <pre>${reportContent}</pre>
   <script>
      window.onload = () => {
         window.print();
         setTimeout(() => window.close(), 100);
      };
   </script>
</body>
</html>`;

         printWindow.document.write(htmlContent);
         printWindow.document.close();
      } catch (error) {
         console.error('PDF export error:', error);
         alert('Failed to export PDF. Please try again.');
      }
   };

   const exportAsWord = () => {
      try {
         const fileName = `${caseItem.title.replace(/[^a-z0-9]/gi, '_')}_Report.doc`;
         trackExport('word', fileName);

         // Create HTML content for Word with page numbering
         const htmlContent = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
   <meta charset="UTF-8">
   <title>${caseItem.title} - Medical-Legal Report</title>
   <!--[if gte mso 9]>
   <xml>
      <w:WordDocument>
         <w:View>Print</w:View>
         <w:Zoom>100</w:Zoom>
         <w:DoNotOptimizeForBrowser/>
      </w:WordDocument>
   </xml>
   <style>
   @page Section1 {
      mso-header-margin:0in;
      mso-footer-margin:.5in;
      mso-page-numbers-position:bottom-right;
   }
   div.Section1 { page:Section1; }
   </style>
   <![endif]-->
   <style>
      @page { margin: 1in; }
      body {
         font-family: 'Times New Roman', Times, serif;
         font-size: 12pt;
         line-height: 1.8;
         margin: 1in;
      }
      h1, h2, h3 { font-weight: bold; }
      p { margin: 12px 0; text-align: justify; }
      pre { white-space: pre-wrap; font-family: inherit; }
   </style>
</head>
<body>
<div class="Section1">
   <pre>${reportContent}</pre>
   <!--[if gte mso 9]>
   <div style="mso-element:footer" id="f1">
      <p style="text-align:right;font-size:10pt;font-family:'Times New Roman',serif;">
         <span style="mso-field-code:'PAGE'"></span>
      </p>
   </div>
   <![endif]-->
</div>
</body>
</html>`;

         // Create blob and download
         const blob = new Blob([htmlContent], { type: 'application/msword' });
         const url = URL.createObjectURL(blob);
         const link = document.createElement('a');
         link.href = url;
         link.download = `${caseItem.title.replace(/[^a-z0-9]/gi, '_')}_Report.doc`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         URL.revokeObjectURL(url);
      } catch (error) {
         console.error('Word export error:', error);
         alert('Failed to export Word document. Please try again.');
      }
   };

   const exportAsText = () => {
      try {
         const fileName = `${caseItem.title.replace(/[^a-z0-9]/gi, '_')}_Report.txt`;
         trackExport('text', fileName);

         const blob = new Blob([reportContent], { type: 'text/plain' });
         const url = URL.createObjectURL(blob);
         const link = document.createElement('a');
         link.href = url;
         link.download = fileName;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         URL.revokeObjectURL(url);
      } catch (error) {
         console.error('Text export error:', error);
         alert('Failed to export text file. Please try again.');
      }
   };

   const copyReportToClipboard = async () => {
      try {
         trackExport('clipboard');
         await navigator.clipboard.writeText(reportContent);
         alert('Report copied to clipboard!');
      } catch (error) {
         console.error('Copy error:', error);
         alert('Failed to copy to clipboard. Please try again.');
      }
   };

   const exportChronologyAsPDF = () => {
      try {
         if (!liveChronology || (liveChronology.years.length === 0 && liveChronology.irrelevantFacts.length === 0)) {
            alert('No chronology data to export.');
            return;
         }

         const fileName = `${caseItem.title.replace(/[^a-z0-9]/gi, '_')}_Chronology.pdf`;
         trackExport('pdf', fileName);

         // Build chronology HTML content organized by year/month
         let bodyHtml = '';

         // Title block
         bodyHtml += `<h1>${caseItem.title}</h1>`;
         bodyHtml += `<h2 style="text-align:center; font-size:13pt; margin-bottom:6pt;">Medical Chronology</h2>`;
         bodyHtml += `<p style="text-align:center; font-size:10pt; color:#666; margin-bottom:24pt;">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>`;
         bodyHtml += `<hr style="border:none; border-top:2px solid #000; margin-bottom:24pt;" />`;

         // Summary counts
         let totalDated = 0;
         liveChronology.years.forEach(yr => yr.months.forEach(m => { totalDated += m.events.length; }));
         const totalUndated = liveChronology.irrelevantFacts.length;
         bodyHtml += `<p style="font-size:11pt; margin-bottom:18pt;"><strong>Total Events:</strong> ${totalDated + totalUndated} (${totalDated} dated, ${totalUndated} undated)</p>`;

         // Dated events by year/month
         liveChronology.years.forEach(yr => {
            bodyHtml += `<h2 style="font-size:14pt; margin-top:24pt; margin-bottom:12pt; border-bottom:1px solid #ccc; padding-bottom:4pt;">${yr.year}</h2>`;

            yr.months.forEach(m => {
               bodyHtml += `<h3 style="font-size:12pt; margin-top:16pt; margin-bottom:8pt; color:#333;">${m.month} ${yr.year}</h3>`;

               m.events.forEach(ev => {
                  const ann = annotations.find(a => a.id === ev.id);
                  const src = getEventSourceInfo(ev.id);
                  const category = ann?.category || '';
                  const displayDate = formatDisplayDate(ev.date) || ev.date;

                  bodyHtml += `<div style="margin-bottom:12pt; padding-left:16pt; border-left:3px solid #4f46e5;">`;
                  bodyHtml += `<p style="margin:0; line-height:1.6;"><strong>${displayDate}</strong>`;
                  if (category) {
                     bodyHtml += ` <span style="font-size:9pt; padding:1pt 6pt; border:1px solid #999; border-radius:3pt; margin-left:6pt;">${category}</span>`;
                  }
                  bodyHtml += `</p>`;
                  bodyHtml += `<p style="margin:2pt 0 0 0; line-height:1.6;">${ev.formattedText}</p>`;
                  if (src) {
                     bodyHtml += `<p style="margin:2pt 0 0 0; font-size:9pt; color:#666;">Source: ${src.name} — Page ${src.page}</p>`;
                  }
                  bodyHtml += `</div>`;
               });
            });
         });

         // Undated events section
         if (liveChronology.irrelevantFacts.length > 0) {
            bodyHtml += `<h2 style="font-size:14pt; margin-top:30pt; margin-bottom:12pt; border-bottom:1px solid #ccc; padding-bottom:4pt;">Undated Events</h2>`;

            liveChronology.irrelevantFacts.forEach(fact => {
               const ann = annotations.find(a => a.id === fact.id);
               const src = getEventSourceInfo(fact.id);
               const category = ann?.category || '';

               bodyHtml += `<div style="margin-bottom:12pt; padding-left:16pt; border-left:3px solid #d97706;">`;
               if (category) {
                  bodyHtml += `<p style="margin:0; line-height:1.6;"><span style="font-size:9pt; padding:1pt 6pt; border:1px solid #999; border-radius:3pt;">${category}</span></p>`;
               }
               bodyHtml += `<p style="margin:2pt 0 0 0; line-height:1.6;">${fact.formattedText}</p>`;
               if (src) {
                  bodyHtml += `<p style="margin:2pt 0 0 0; font-size:9pt; color:#666;">Source: ${src.name} — Page ${src.page}</p>`;
               }
               bodyHtml += `</div>`;
            });
         }

         const printWindow = window.open('', '_blank');
         if (!printWindow) {
            alert('Please allow popups to export PDF');
            return;
         }

         const htmlContent = `
<!DOCTYPE html>
<html>
<head>
   <meta charset="UTF-8">
   <title>${caseItem.title} - Medical Chronology</title>
   <style>
      @page {
         size: letter;
         margin: 0;
      }
      body {
         font-family: 'Times New Roman', 'Liberation Serif', Times, serif;
         font-size: 12pt;
         line-height: 1.6;
         color: #000;
         margin: 1in;
         padding: 0;
         background: white;
      }
      h1, h2, h3 {
         font-family: 'Times New Roman', 'Liberation Serif', Times, serif;
         font-weight: bold;
         page-break-after: avoid;
      }
      h1 { font-size: 16pt; text-align: center; margin-bottom: 4pt; }
      h2 { font-size: 13pt; }
      h3 { font-size: 12pt; }
      p {
         margin: 0;
         orphans: 3;
         widows: 3;
      }
      div { page-break-inside: avoid; }
   </style>
</head>
<body>
   ${bodyHtml}
   <script>
      window.onload = () => {
         window.print();
         setTimeout(() => window.close(), 100);
      };
   </script>
</body>
</html>`;

         printWindow.document.write(htmlContent);
         printWindow.document.close();
      } catch (error) {
         console.error('Chronology PDF export error:', error);
         alert('Failed to export chronology PDF. Please try again.');
      }
   };

   const handleRestoreVersion = async (version: any) => {
      if (window.confirm(`Restore this version from ${new Date(version.date).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}?`)) {
         try {
            setIsSaving(true);
            // Only save current content if it's different from the version being restored
            const currentContent = editableDivRef.current?.innerHTML || reportContent;
            const isDifferent = currentContent.trim() && currentContent !== version.content;

            if (isDifferent) {
               // Save current as a version before restoring
               const currentVersion = {
                  id: Date.now().toString(),
                  date: new Date().toISOString(),
                  content: currentContent,
                  status: 'draft' as const,
                  author: currentUser.name,
                  label: 'Auto-saved before restore'
               };

               await onUpdateCase({
                  ...caseItem,
                  reportContent: version.content,
                  draftVersions: [...(caseItem.draftVersions || []), currentVersion].slice(-20)
               });
            } else {
               // Just restore without saving duplicate
               await onUpdateCase({
                  ...caseItem,
                  reportContent: version.content
               });
            }

            setReportContent(version.content);
            lastContentRef.current = version.content;
            setWriterContentKey(prev => prev + 1);
            setShowVersionHistory(false);
         } catch (error) {
            console.error("Failed to restore version:", error);
            alert("Failed to restore version. Please try again.");
         } finally {
            setIsSaving(false);
         }
      }
   };

   // --- Handlers: Annotation Feed Edit/Delete ---
   const handleUpdateAnnotation = (ann: Annotation) => {
      onNavigateToAnnotation(ann.id, true);
   };

   const handleDeleteAnnotation = (id: string) => {
      if (confirm('Delete this clinical record from history?')) {
         onDeleteAnnotation(id);
      }
   };

   // --- Handlers: Deposition ---
   const handleRunStrategy = async () => {
      setIsGenerating(true);
      try {
         const s = await runFullCaseStrategy(reportContent || caseItem.description);
         if (s) setStrategyData(s);
      } finally {
         setIsGenerating(false);
      }
   };

   const handleStartDepo = (scenario: any) => {
      const scenarioId = scenario.title;
      const existingChat = depoChats[scenarioId];

      console.log('🎯 Starting deposition for:', scenarioId);
      console.log('   Existing chat messages:', existingChat?.length || 0);
      console.log('   All chats:', Object.keys(depoChats));

      setActiveScenarioId(scenarioId);
      setDepoStage('SIMULATION');

      // Restore last coaching feedback if resuming existing chat
      if (existingChat && existingChat.length > 0) {
         const lastCoaching = [...existingChat].reverse().find(m => m.role === 'user' && m.coaching)?.coaching;
         setCurrentFeedback(lastCoaching || null);
      } else {
         setCurrentFeedback(null);
      }

      // If no chat exists for this scenario, create initial message
      if (!existingChat || existingChat.length === 0) {
         console.log('   ✨ Creating new chat for', scenarioId);
         const initialMessage = {
            id: 'init-' + Date.now(),
            role: 'model' as const,
            text: scenario.firstQuestion,
            timestamp: Date.now()
         };
         setDepoChats(prev => {
            const updated = { ...prev, [scenarioId]: [initialMessage] };
            console.log('   New depoChats state:', Object.keys(updated));
            return updated;
         });
      } else {
         console.log('   ♻️ Resuming existing chat with', existingChat.length, 'messages');
      }
   };

   const handleClearChatHistory = () => {
      if (activeScenarioId) {
         // Clear only the current scenario's chat
         if (window.confirm(`Clear chat history for this scenario? This cannot be undone.`)) {
            console.log('🗑️ Clearing chat for scenario:', activeScenarioId);

            const { [activeScenarioId]: _, ...remainingChats } = depoChats;

            setDepoChats(remainingChats);
            setDepoStage('ANALYSIS');
            setActiveScenarioId(undefined);
            setCurrentFeedback(null);

            console.log('   Remaining chats:', Object.keys(remainingChats));
         }
      } else {
         // If no active scenario, clear all chats
         if (window.confirm('Clear all deposition chat history? This cannot be undone.')) {
            console.log('🗑️ Clearing ALL deposition chats');

            setDepoChats({});
            setDepoStage('ANALYSIS');
            setCurrentFeedback(null);
         }
      }
   };

   const handleMicClick = () => {
      if (!('webkitSpeechRecognition' in window)) {
         alert("Browser does not support speech recognition.");
         return;
      }
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
         setChatInput(event.results[0][0].transcript);
      };
      recognition.start();
   };

   const handleDepoSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || !activeScenarioId) return;

      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput, timestamp: Date.now() };
      const currentChat = depoChats[activeScenarioId] || [];
      const updatedChat = [...currentChat, userMsg];

      console.log('💬 Adding user message to', activeScenarioId);
      console.log('   Previous count:', currentChat.length, '→ New count:', updatedChat.length);

      setDepoChats(prev => {
         const updated = { ...prev, [activeScenarioId]: updatedChat };
         console.log('   Updated depoChats keys:', Object.keys(updated));
         return updated;
      });
      setChatInput('');
      setIsChatting(true);
      setCurrentFeedback(null);

      try {
         const result = await chatWithDepositionCoach(updatedChat, userMsg.text, reportContent || caseItem.description);

         if (result && result.coaching) {
            const chatWithFeedback = updatedChat.map(msg =>
               msg.id === userMsg.id ? { ...msg, coaching: result.coaching } : msg
            );
            setDepoChats(prev => ({ ...prev, [activeScenarioId]: chatWithFeedback }));
            setCurrentFeedback(result.coaching);
         }
      } catch (error) {
         console.error("Error in handleDepoSubmit:", error);
      } finally {
         setIsChatting(false);
      }
   };

   const handleProceedToNextQuestion = async () => {
      if (!activeScenarioId) return;

      setIsChatting(true);
      setCurrentFeedback(null);
      try {
         const currentChat = depoChats[activeScenarioId] || [];
         const result = await chatWithDepositionCoach(currentChat, "Proceed", reportContent || "");
         const newMessage = {
            id: Date.now().toString(),
            role: 'model' as const,
            text: result.nextQuestion,
            timestamp: Date.now()
         };
         setDepoChats(prev => ({ ...prev, [activeScenarioId]: [...currentChat, newMessage] }));
      } catch (error) {
         console.error("Error:", error);
      } finally {
         setIsChatting(false);
      }
   };

   const handleRetryAnswer = () => {
      if (!activeScenarioId) return;
      const currentChat = depoChats[activeScenarioId] || [];
      setDepoChats(prev => ({ ...prev, [activeScenarioId]: currentChat.slice(0, -1) }));
      setCurrentFeedback(null);
      setChatInput(currentChat[currentChat.length - 1]?.text || "");
   };

   // --- Render ---
   return (
      <div className="flex flex-col h-full bg-slate-100">
         {/* Modal for Linking Files */}
         {linkingEventId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
               <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="font-serif font-black text-slate-800">Link Source Document</h3>
                     <button onClick={() => setLinkingEventId(null)}><XIcon className="w-5 h-5 text-slate-400" /></button>
                  </div>
                  <div className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select File</label>
                        <select
                           className="w-full p-2 border rounded-lg text-sm bg-slate-50"
                           value={linkSourceFileId}
                           onChange={(e) => setLinkSourceFileId(e.target.value)}
                        >
                           {docs.length === 0 && <option value="">No files available</option>}
                           {docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Page Number</label>
                        <input
                           type="number"
                           min="1"
                           className="w-full p-2 border rounded-lg text-sm bg-slate-50"
                           value={linkSourcePage}
                           onChange={(e) => setLinkSourcePage(parseInt(e.target.value) || 1)}
                        />
                     </div>
                     <button
                        onClick={handleSaveManualLink}
                        disabled={!linkSourceFileId}
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                     >
                        Save Link
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* Modal for Report Templates */}
         {isTemplateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
               <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-6">
                     <div>
                        <h3 className="text-2xl font-serif font-black text-slate-800">Report Template</h3>
                        <p className="text-sm text-slate-500">Define the structure the AI should follow for your legal report.</p>
                     </div>
                     <button onClick={() => setIsTemplateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <XIcon className="w-6 h-6 text-slate-400" />
                     </button>
                  </div>

                  <div className="space-y-6">
                     <div>
                        <div className="flex justify-between items-center mb-2">
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Example Templates</label>
                           <button
                              onClick={() => setReportTemplate(DEFAULT_TEMPLATE)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase"
                           >
                              Reset to Default
                           </button>
                        </div>
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                           <button
                              onClick={() => setReportTemplate(DEFAULT_TEMPLATE)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${reportTemplate === DEFAULT_TEMPLATE ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'}`}
                           >
                              Standard Legal Report
                           </button>
                           {/* Potentially more examples here */}
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Custom Structure / Paste Template</label>
                        <textarea
                           className="w-full h-64 p-4 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-serif leading-relaxed"
                           placeholder="Paste your report template here..."
                           value={reportTemplate}
                           onChange={(e) => setReportTemplate(e.target.value)}
                        />
                     </div>

                     <div className="flex gap-3">
                        <button
                           onClick={() => setIsTemplateModalOpen(false)}
                           className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                        >
                           Apply & Close
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}
         <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
            <div className="flex items-center gap-4">
               <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><ArrowLeftIcon className="w-5 h-5" /></button>
               <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button onClick={() => setActiveTab('CHRONOLOGY')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'CHRONOLOGY' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                     <CalendarIcon className="w-4 h-4" /> Timeline
                  </button>
                  <button onClick={() => setActiveTab('FACTS')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'FACTS' ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500'}`}>
                     <ClipboardListIcon className="w-4 h-4" /> Facts & Notes
                  </button>
                  <button onClick={() => setActiveTab('RESEARCH')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'RESEARCH' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>
                     <LibraryIcon className="w-4 h-4" /> Research
                  </button>
                  <button onClick={() => setActiveTab('WRITER')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'WRITER' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>
                     <FileTextIcon className="w-4 h-4" /> Legal Writer
                  </button>
                  <button onClick={() => setActiveTab('STRATEGY')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'STRATEGY' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500'}`}>
                     <GavelIcon className="w-4 h-4" /> Deposition Prep
                  </button>
               </div>
            </div>
         </div>

         <div className="flex-1 overflow-hidden relative">
            {/* Global AI Progress Indicator (Loading Bar) */}
            {(isGenerating || isChatting) && (
               <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
                  <div className="h-1 w-full bg-slate-100 overflow-hidden">
                     <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-[loading_2s_infinite] w-[40%] shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  </div>
                  {/* Subtle Glassmorphism Overlay (Optional, but adds to the 'something is happening' feel) */}
                  <div className="absolute top-1 left-0 right-0 h-[11in] bg-white/5 backdrop-blur-[1px] transition-all duration-500" />
               </div>
            )}
            <style dangerouslySetInnerHTML={{
               __html: `
               @keyframes loading {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(300%); }
               }
               
               /* Print styles with page numbering */
               @media print {
                  @page {
                     size: letter;
                     margin: 1in 1in 1.2in 1in;
                     @bottom-right {
                        content: counter(page);
                        font-family: 'Times New Roman', serif;
                        font-size: 10pt;
                        color: #333;
                     }
                  }

                  body {
                     font-family: 'Times New Roman', 'Liberation Serif', 'Nimbus Roman', Times, serif;
                     font-size: 12pt;
                     line-height: 2;
                     color: #000;
                     margin: 0;
                  }

                  /* Hide UI elements */
                  .no-print, button, nav, aside {
                     display: none !important;
                  }

                  /* Ensure proper page breaks */
                  h1, h2, h3, h4, h5, h6 {
                     page-break-after: avoid;
                     page-break-inside: avoid;
                     font-family: 'Times New Roman', 'Liberation Serif', 'Nimbus Roman', Times, serif;
                     font-weight: bold;
                     margin-top: 12pt;
                     margin-bottom: 6pt;
                  }

                  p {
                     orphans: 3;
                     widows: 3;
                     margin: 0;
                     text-align: justify;
                  }

                  /* Remove shadows and borders for print */
                  * {
                     box-shadow: none !important;
                     border: none !important;
                  }
               }
            `}} />

            {activeTab === 'CHRONOLOGY' && (
               <div className="h-full flex overflow-hidden bg-slate-50">
                  {/* Timeline View */}
                  <div className={`${previewSource ? 'w-1/2' : 'flex-1'} flex flex-col p-8 overflow-y-auto no-scrollbar transition-all duration-300`}>
                     <div className="max-w-5xl mx-auto w-full">
                        {/* Header with sub-view toggle */}
                        <div className="flex justify-between items-center mb-6">
                           <div>
                              <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-slate-900 leading-tight">Medical Chronology</h2>
                              <p className="text-slate-500 text-sm mt-1">AI-structured timeline and fact analysis.</p>
                           </div>
                           <div className="flex items-center gap-3">
                              <div className="flex bg-slate-100 p-1 rounded-xl">
                                 <button onClick={() => setTimelineSubView('TIMELINE')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${timelineSubView === 'TIMELINE' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <CalendarIcon className="w-3.5 h-3.5" /> Timeline
                                 </button>
                                 <button onClick={() => setTimelineSubView('MATRIX')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${timelineSubView === 'MATRIX' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <TableIcon className="w-3.5 h-3.5" /> Fact Matrix
                                 </button>
                              </div>
                              {timelineSubView === 'TIMELINE' && (
                                 <button
                                    onClick={() => { setMergeMode(!mergeMode); setMergeSelectedIds(new Set()); }}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${mergeMode ? 'bg-amber-500 text-white shadow-lg shadow-amber-100 hover:bg-amber-600' : 'bg-white text-slate-600 border border-slate-200 hover:border-amber-300 hover:text-amber-600'}`}
                                 >
                                    <GitMergeIcon className="w-3.5 h-3.5" />
                                    {mergeMode ? 'Cancel Merge' : 'Merge'}
                                 </button>
                              )}
                              <button
                                 onClick={exportChronologyAsPDF}
                                 className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                                 title="Export chronology as PDF"
                              >
                                 <DownloadIcon className="w-3.5 h-3.5" />
                                 Export PDF
                              </button>
                           </div>
                        </div>

                        {/* Merge Action Bar */}
                        {mergeMode && mergeSelectedIds.size > 0 && (
                           <div className="sticky top-0 z-10 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-center justify-between shadow-lg shadow-amber-100/50 animate-in slide-in-from-top duration-200">
                              <div className="flex items-center gap-3">
                                 <div className="p-2 bg-amber-500 rounded-lg">
                                    <GitMergeIcon className="w-4 h-4 text-white" />
                                 </div>
                                 <div>
                                    <p className="text-sm font-bold text-amber-900">{mergeSelectedIds.size} events selected</p>
                                    <p className="text-[10px] text-amber-700/70">Select at least 2 events to merge them into one.</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-2">
                                 <button
                                    onClick={() => setMergeSelectedIds(new Set())}
                                    className="px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                                 >Clear</button>
                                 <button
                                    onClick={handleMergeEvents}
                                    disabled={mergeSelectedIds.size < 2}
                                    className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                 >
                                    <GitMergeIcon className="w-3.5 h-3.5" />
                                    Merge {mergeSelectedIds.size} Events
                                 </button>
                              </div>
                           </div>
                        )}

                        {/* ===== FACT MATRIX TABLE VIEW ===== */}
                        {timelineSubView === 'MATRIX' && (
                           <div className="flex-1 overflow-hidden flex flex-col pb-8">
                              {/* Filters Bar */}
                              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
                                 <div className="flex items-center gap-3 flex-wrap">
                                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                       <SearchIcon className="w-4 h-4 text-slate-400 shrink-0" />
                                       <input
                                          type="text"
                                          placeholder="Search events, sources, categories..."
                                          className="w-full text-sm border-none bg-transparent focus:outline-none placeholder:text-slate-400"
                                          value={matrixSearch}
                                          onChange={e => setMatrixSearch(e.target.value)}
                                       />
                                    </div>
                                    <div className="h-6 w-px bg-slate-200" />
                                    <select
                                       className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                       value={matrixCategoryFilter}
                                       onChange={e => setMatrixCategoryFilter(e.target.value)}
                                    >
                                       <option value="">All Categories</option>
                                       <option value="Medical">Medical</option>
                                       <option value="Legal">Legal</option>
                                       <option value="Review">Review</option>
                                       <option value="Urgent">Urgent</option>
                                    </select>
                                    <select
                                       className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[180px]"
                                       value={matrixSourceFilter}
                                       onChange={e => setMatrixSourceFilter(e.target.value)}
                                    >
                                       <option value="">All Sources</option>
                                       {docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                       <option value="manual-notes">Manual Notes</option>
                                    </select>
                                    <div className="flex items-center gap-1.5">
                                       <label className="text-[9px] font-bold text-slate-400 uppercase">From</label>
                                       <input type="date" className="text-xs border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none" value={matrixDateFrom} onChange={e => setMatrixDateFrom(e.target.value)} />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                       <label className="text-[9px] font-bold text-slate-400 uppercase">To</label>
                                       <input type="date" className="text-xs border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none" value={matrixDateTo} onChange={e => setMatrixDateTo(e.target.value)} />
                                    </div>
                                    {(matrixSearch || matrixCategoryFilter || matrixSourceFilter || matrixDateFrom || matrixDateTo) && (
                                       <button
                                          onClick={() => { setMatrixSearch(''); setMatrixCategoryFilter(''); setMatrixSourceFilter(''); setMatrixDateFrom(''); setMatrixDateTo(''); }}
                                          className="text-[10px] font-bold text-red-500 hover:text-red-600 bg-red-50 px-2 py-1.5 rounded-lg border border-red-100"
                                       >Clear All</button>
                                    )}
                                 </div>
                                 <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                       {filteredMatrixEvents.length} of {allMatrixEvents.length} events
                                    </p>
                                 </div>
                              </div>

                              {/* Table */}
                              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                                 <div className="overflow-auto flex-1">
                                    <table className="w-full text-left">
                                       <thead className="sticky top-0 z-10">
                                          <tr className="bg-slate-50 border-b border-slate-200">
                                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider w-[100px]">Date</th>
                                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Event Summary</th>
                                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider w-[100px]">Category</th>
                                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider w-[180px]">Source File</th>
                                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider w-[80px] text-center">Action</th>
                                          </tr>
                                       </thead>
                                       <tbody>
                                          {filteredMatrixEvents.length === 0 ? (
                                             <tr>
                                                <td colSpan={5} className="px-4 py-12 text-center">
                                                   <TableIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                                   <p className="text-sm text-slate-400 font-bold">No events match your filters</p>
                                                   <p className="text-xs text-slate-300 mt-1">Try adjusting your search or filters</p>
                                                </td>
                                             </tr>
                                          ) : (
                                             filteredMatrixEvents.map((ev, idx) => {
                                                const hasValidSource = ev.sourceId && ev.sourceId !== '' && ev.sourceId !== 'manual-notes' && docs.find(d => d.id === ev.sourceId);
                                                return (
                                                   <tr
                                                      key={ev.id}
                                                      className={`border-b border-slate-100 hover:bg-indigo-50/30 transition-colors cursor-pointer group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                                                      onClick={() => { if (editingEventId !== ev.id && hasValidSource) handleJumpToSource(ev.id); }}
                                                   >
                                                      <td className="px-4 py-3">
                                                         {editingEventId === ev.id ? (
                                                            <input
                                                               type="date"
                                                               className="w-full text-xs border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                               defaultValue={ev.date || ''}
                                                               onChange={(e) => { editDateRef.current = e.target.value; }}
                                                            />
                                                         ) : ev.date ? (
                                                            <span className="text-xs font-bold text-indigo-600">{formatDisplayDate(ev.date)}</span>
                                                         ) : (
                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">UNDATED</span>
                                                         )}
                                                      </td>
                                                      <td className="px-4 py-3">
                                                         {editingEventId === ev.id ? (
                                                            <textarea
                                                               className="w-full text-xs border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-20"
                                                               defaultValue={ev.text}
                                                               onChange={(e) => { editTextRef.current = e.target.value; }}
                                                            />
                                                         ) : (
                                                            <p className="text-xs text-slate-700 leading-relaxed">{ev.text}</p>
                                                         )}
                                                      </td>
                                                      <td className="px-4 py-3">
                                                         <span className={`text-[9px] font-bold px-2 py-0.5 rounded text-white ${ev.category === 'Medical' ? 'bg-red-500' : ev.category === 'Legal' ? 'bg-blue-500' : ev.category === 'Urgent' ? 'bg-rose-500' : 'bg-amber-500'}`}>
                                                            {ev.category}
                                                         </span>
                                                      </td>
                                                      <td className="px-4 py-3">
                                                         {ev.source !== 'No Source' ? (
                                                            <div className="flex items-center gap-1.5">
                                                               <FileTextIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                                               <span className="text-xs text-slate-600 font-medium truncate">{ev.source}</span>
                                                               {ev.page > 0 && <span className="text-[9px] text-slate-400">p.{ev.page}</span>}
                                                            </div>
                                                         ) : (
                                                            <button
                                                               onClick={(e) => { e.stopPropagation(); handleOpenLinkModal(ev.id); }}
                                                               className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded border border-amber-200"
                                                            >
                                                               <LinkIcon className="w-3 h-3" /> Attach
                                                            </button>
                                                         )}
                                                      </td>
                                                      <td className="px-4 py-3 text-center">
                                                         {editingEventId === ev.id ? (
                                                            <div className="flex items-center justify-center gap-2">
                                                               <button
                                                                  onClick={(e) => { e.stopPropagation(); setEditingEventId(null); }}
                                                                  className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
                                                               >
                                                                  Cancel
                                                               </button>
                                                               <button
                                                                  onClick={(e) => {
                                                                     e.stopPropagation();
                                                                     handleSaveEventEdit(ev.id, editDateRef.current || ev.date, editTextRef.current || ev.text);
                                                                  }}
                                                                  className="px-2 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                                                               >
                                                                  Save
                                                               </button>
                                                            </div>
                                                         ) : (
                                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                               <button
                                                                  onClick={(e) => { e.stopPropagation(); editDateRef.current = ''; editTextRef.current = ''; setEditingEventId(editingEventId === ev.id ? null : ev.id); }}
                                                                  className="text-[10px] font-bold text-slate-500 hover:text-indigo-700 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200"
                                                               >
                                                                  <PencilIcon className="w-3 h-3 inline mr-1" />Edit
                                                               </button>
                                                               {hasValidSource ? (
                                                                  <button
                                                                     onClick={(e) => { e.stopPropagation(); handleJumpToSource(ev.id); }}
                                                                     className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100"
                                                                  >
                                                                     <EyeIcon className="w-3 h-3 inline mr-1" />Preview
                                                                  </button>
                                                               ) : (
                                                                  <span className="text-[9px] text-slate-300">-</span>
                                                               )}
                                                            </div>
                                                         )}
                                                      </td>
                                                   </tr>
                                                );
                                             })
                                          )}
                                       </tbody>
                                    </table>
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* ===== TIMELINE VIEW ===== */}
                        {timelineSubView === 'TIMELINE' && (
                           <div className="flex-1 overflow-y-auto space-y-12 pb-20 no-scrollbar">
                              {isGenerating && (!liveChronology || (liveChronology.years.length === 0 && liveChronology.irrelevantFacts.length === 0)) ? (
                                 <div className="py-8">
                                    <SkeletonLoader type="timeline" />
                                 </div>
                              ) : (!liveChronology || (liveChronology.years.length === 0 && liveChronology.irrelevantFacts.length === 0)) ? (
                                 <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
                                    <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                    <p className="text-slate-400 font-bold mb-1">Timeline is empty.</p>
                                 <p className="text-xs text-slate-400">Add dated annotations to documents.</p>
                                 </div>
                              ) : (
                                 <>
                                    {/* Undated Events Section */}
                                    {liveChronology.irrelevantFacts.length > 0 && (
                                       <div className="mb-12">
                                          <div className="flex items-center gap-3 mb-6 p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                                             <div className="p-2 bg-white rounded-lg shadow-sm">
                                                <AlertCircleIcon className="w-5 h-5 text-amber-600" />
                                             </div>
                                             <div>
                                                <h3 className="font-bold text-amber-900 text-base">Undated Events</h3>
                                                <p className="text-xs text-amber-700/70 font-medium">{liveChronology.irrelevantFacts.length} events without dates. Assign dates to move them into the timeline.</p>
                                             </div>
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             {liveChronology.irrelevantFacts.map((fact, idx) => {
                                                const factSrc = getEventSourceInfo(fact.id);
                                                return (
                                                   <div
                                                      key={idx}
                                                      onClick={mergeMode ? () => handleToggleMergeSelect(fact.id) : undefined}
                                                      className={`bg-white p-4 pb-5 rounded-xl border shadow-sm transition-all group relative ${mergeMode ? 'cursor-pointer' : ''} ${mergeMode && mergeSelectedIds.has(fact.id) ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-200' : 'border-slate-200 hover:border-indigo-200'}`}
                                                   >
                                                      {mergeMode && (
                                                         <div
                                                            className={`absolute top-3 left-3 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all z-10 ${mergeSelectedIds.has(fact.id) ? 'bg-amber-500 border-amber-500' : 'border-slate-300 bg-white'}`}
                                                         >
                                                            {mergeSelectedIds.has(fact.id) && <CheckIcon className="w-3 h-3 text-white" />}
                                                         </div>
                                                      )}
                                                      <p className={`text-sm text-slate-700 leading-relaxed font-medium pr-24 min-h-[3rem] ${mergeMode ? 'pl-8' : ''}`}>{fact.formattedText}</p>
                                                      {factSrc && (
                                                         <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                                                               <FileTextIcon className="w-3 h-3 text-indigo-600" />
                                                               <span className="text-xs font-bold text-indigo-700">{factSrc.name}</span>
                                                               <span className="text-[10px] text-indigo-500">• Page {factSrc.page}</span>
                                                            </div>
                                                         </div>
                                                      )}
                                                      {!mergeMode && (
                                                         <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-lg shadow-sm p-1">
                                                            <button onClick={(e) => { e.stopPropagation(); editDateRef.current = ''; editTextRef.current = ''; setEditingEventId(editingEventId === fact.id ? null : fact.id); }} className="text-slate-400 hover:text-indigo-600 p-1 hover:bg-indigo-50 rounded" title="Edit / Assign Date"><PencilIcon className="w-3.5 h-3.5" /></button>
                                                            {!factSrc && <button onClick={(e) => { e.stopPropagation(); handleOpenLinkModal(fact.id); }} className="text-slate-400 hover:text-amber-600 p-1 hover:bg-amber-50 rounded" title="Attach Document"><LinkIcon className="w-3.5 h-3.5" /></button>}
                                                            {factSrc && <button onClick={(e) => { e.stopPropagation(); handleJumpToSource(fact.id); }} className="text-slate-400 hover:text-indigo-600 p-1 hover:bg-indigo-50 rounded" title="View Source"><EyeIcon className="w-3.5 h-3.5" /></button>}
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(fact.id); }} className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded" title="Delete Event"><Trash2Icon className="w-3.5 h-3.5" /></button>
                                                         </div>
                                                      )}
                                                      {editingEventId === fact.id && (
                                                         <div className="mt-3 pt-3 border-t border-slate-100 space-y-2" onClick={(e) => e.stopPropagation()}>
                                                            <div>
                                                               <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Assign Date</label>
                                                               <input type="date" className="w-full text-xs border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none" onChange={(e) => { editDateRef.current = e.target.value; }} />
                                                            </div>
                                                            <div>
                                                               <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Summary</label>
                                                               <textarea className="w-full text-xs border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-16" defaultValue={fact.formattedText} onChange={(e) => { editTextRef.current = e.target.value; }} />
                                                            </div>
                                                            <div className="flex gap-2 justify-end">
                                                               <button onClick={() => setEditingEventId(null)} className="px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                                                               <button onClick={() => handleSaveEventEdit(fact.id, editDateRef.current || '', editTextRef.current || fact.formattedText)} className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Save</button>
                                                            </div>
                                                         </div>
                                                      )}
                                                   </div>
                                                );
                                             })}
                                          </div>
                                       </div>
                                    )}

                                    {/* Timeline Stream */}
                                    <div className="space-y-16">
                                       {liveChronology.years.map(yr => (
                                          <div key={yr.year}>
                                             {/* Year Header */}
                                             <h2 className="text-5xl font-bold text-indigo-600 mb-8">{yr.year}</h2>

                                             {/* Months */}
                                             <div className="space-y-6">
                                                {yr.months.map(m => {
                                                   const monthKey = `${yr.year}-${m.month}`;
                                                   const isExpanded = !collapsedMonths.has(monthKey);

                                                   return (
                                                      <div key={m.month} className="border-l-2 border-slate-200 pl-8">
                                                         {/* Month Toggle */}
                                                         <button
                                                            onClick={() => {
                                                               const newSet = new Set(collapsedMonths);
                                                               isExpanded ? newSet.add(monthKey) : newSet.delete(monthKey);
                                                               setCollapsedMonths(newSet);
                                                            }}
                                                            className="flex items-center gap-3 mb-4 text-slate-600 hover:text-indigo-600 transition-colors group"
                                                         >
                                                            {isExpanded ? (
                                                               <ChevronDownIcon className="w-5 h-5 text-indigo-500" />
                                                            ) : (
                                                               <ChevronRightIcon className="w-5 h-5" />
                                                            )}
                                                            <span className="font-bold text-sm uppercase tracking-wide">
                                                               {m.month}
                                                            </span>
                                                            <span className="text-xs text-slate-400">({m.events.length})</span>
                                                         </button>

                                                         {/* Events */}
                                                         {isExpanded && (
                                                            <div className="space-y-4 ml-2">
                                                               {m.events.map((ev, i) => {
                                                                  const src = getEventSourceInfo(ev.id);
                                                                  return (
                                                                     <div
                                                                        key={i}
                                                                        onClick={() => mergeMode ? handleToggleMergeSelect(ev.id) : handleJumpToSource(ev.id)}
                                                                        className={`bg-white border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group ${mergeMode && mergeSelectedIds.has(ev.id) ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-200' : 'border-slate-200 hover:border-indigo-200'}`}
                                                                     >
                                                                        <div className="flex justify-between items-start mb-2">
                                                                           <div className="flex items-center gap-2">
                                                                              {mergeMode && (
                                                                                 <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${mergeSelectedIds.has(ev.id) ? 'bg-amber-500 border-amber-500' : 'border-slate-300 bg-white'}`}>
                                                                                    {mergeSelectedIds.has(ev.id) && <CheckIcon className="w-3 h-3 text-white" />}
                                                                                 </div>
                                                                              )}
                                                                              <p className="text-sm font-bold text-indigo-600">
                                                                                 {formatDisplayDate(ev.date) || ev.date}
                                                                              </p>
                                                                              {(() => {
                                                                                 const ann = annotations.find(a => a.id === ev.id);
                                                                                 if (ann) return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${ann.category === 'Medical' ? 'bg-red-500' : ann.category === 'Legal' ? 'bg-blue-500' : ann.category === 'Urgent' ? 'bg-rose-500' : 'bg-amber-500'}`}>{ann.category}</span>;
                                                                                 return null;
                                                                              })()}
                                                                           </div>
                                                                           <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                                              <button
                                                                                 onClick={(e) => { e.stopPropagation(); setEditingEventId(editingEventId === ev.id ? null : ev.id); }}
                                                                                 className="text-xs font-semibold text-slate-400 hover:text-indigo-600 flex items-center gap-1"
                                                                                 title="Edit event"
                                                                              >
                                                                                 <PencilIcon className="w-3.5 h-3.5" />
                                                                              </button>
                                                                              {src ? (
                                                                                 <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleJumpToSource(ev.id); }}
                                                                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                                                                 >
                                                                                    <EyeIcon className="w-3 h-3" />
                                                                                    View Source
                                                                                 </button>
                                                                              ) : (
                                                                                 <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleOpenLinkModal(ev.id); }}
                                                                                    className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200"
                                                                                 >
                                                                                    <LinkIcon className="w-3 h-3" />
                                                                                    Attach Document
                                                                                 </button>
                                                                              )}
                                                                              <button
                                                                                 onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                                                                                 className="text-xs font-semibold text-slate-400 hover:text-red-600 flex items-center gap-1"
                                                                                 title="Delete event"
                                                                              >
                                                                                 <Trash2Icon className="w-3 h-3" />
                                                                              </button>
                                                                           </div>
                                                                        </div>

                                                                        {/* Inline Editing */}
                                                                        {editingEventId === ev.id ? (
                                                                           <div className="space-y-3 mt-2" onClick={(e) => e.stopPropagation()}>
                                                                              <div className="flex gap-2">
                                                                                 <div className="flex-1">
                                                                                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Event Date</label>
                                                                                    <input
                                                                                       type="date"
                                                                                       className="w-full text-xs border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                                       defaultValue={ev.date}
                                                                                       onChange={(e) => { editDateRef.current = e.target.value; }}
                                                                                    />
                                                                                 </div>
                                                                              </div>
                                                                              <div>
                                                                                 <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Event Summary</label>
                                                                                 <textarea
                                                                                    className="w-full text-xs border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-20"
                                                                                    defaultValue={ev.formattedText}
                                                                                    onChange={(e) => { editTextRef.current = e.target.value; }}
                                                                                 />
                                                                              </div>
                                                                              <div className="flex gap-2 justify-end">
                                                                                 <button
                                                                                    onClick={() => setEditingEventId(null)}
                                                                                    className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
                                                                                 >Cancel</button>
                                                                                 <button
                                                                                    onClick={() => handleSaveEventEdit(ev.id, editDateRef.current || ev.date, editTextRef.current || ev.formattedText)}
                                                                                    className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                                                                                 >Save Changes</button>
                                                                              </div>
                                                                           </div>
                                                                        ) : (
                                                                           <p className="text-sm text-slate-700 leading-relaxed">
                                                                              {ev.formattedText}
                                                                           </p>
                                                                        )}

                                                                        {src && (
                                                                           <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                                                                              <FileTextIcon className="w-3 h-3 text-slate-400" />
                                                                              <p className="text-xs text-slate-400 font-medium">
                                                                                 {src.name} • Page {src.page}
                                                                              </p>
                                                                           </div>
                                                                        )}
                                                                        {!src && (
                                                                           <div className="mt-3 pt-3 border-t border-amber-100 flex items-center gap-2">
                                                                              <AlertCircleIcon className="w-3 h-3 text-amber-400" />
                                                                              <p className="text-xs text-amber-500 font-medium italic">
                                                                                 No source document attached
                                                                              </p>
                                                                           </div>
                                                                        )}
                                                                     </div>
                                                                  );
                                                               })}
                                                            </div>
                                                         )}
                                                      </div>
                                                   );
                                                })}
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 </>
                              )}
                           </div>
                        )}

                     </div>
                  </div>

                  {/* Preview Panel */}
                  {previewSource && (() => {
                     const previewDoc = docs.find(d => d.id === previewSource.documentId);
                     if (!previewDoc) return null;
                     return (
                        <PreviewPanel
                           doc={previewDoc}
                           page={previewSource.page}
                           annotations={annotations.filter(a => a.documentId === previewSource.documentId)}
                           highlightAnnotationId={previewSource.annotationId}
                           onClose={() => setPreviewSource(null)}
                           onOpenFullView={() => {
                              if (previewSource.annotationId) {
                                 onNavigateToAnnotation(previewSource.annotationId);
                              } else {
                                 onNavigateToSource(previewSource.documentId, previewSource.page);
                              }
                              setPreviewSource(null);
                           }}
                        />
                     );
                  })()}

                  {/* Timeline Feed - Right Side Column */}
                  {!previewSource && (
                     <div className="w-[380px] border-l border-slate-200 p-6 overflow-y-auto bg-slate-50 flex flex-col">
                        <div className="flex items-center justify-between mb-5">
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-600 rounded-lg shadow-md">
                                 <MessageSquareIcon className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                 <h2 className="text-lg font-extrabold tracking-[-0.02em] text-slate-900">Timeline Feed</h2>
                                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Live Feed from Case Files</p>
                              </div>
                           </div>
                           <div className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-[10px] text-slate-400 font-bold">{annotations.filter(a => a.documentId !== 'manual-notes').length}</div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative mb-4">
                           <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                              <SearchIcon className="h-3.5 w-3.5 text-slate-400" />
                           </div>
                           <input
                              type="text"
                              className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                              placeholder="Filter annotations..."
                              value={annotationSearchQuery}
                              onChange={(e) => setAnnotationSearchQuery(e.target.value)}
                           />
                        </div>

                        {annotations.filter(a => a.documentId !== 'manual-notes').length === 0 ? (
                           <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                              <StickyNoteIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                              <p className="text-slate-400 font-medium text-sm">No annotations yet.</p>
                              <p className="text-xs text-slate-300 mt-1">Annotate files to populate the feed.</p>
                           </div>
                        ) : (
                           <div className="space-y-3 flex-1">
                              {(() => {
                                 let lastDocId = '';
                                 return annotations
                                    .filter(ann => ann.documentId !== 'manual-notes')
                                    .filter(ann => {
                                       if (!annotationSearchQuery) return true;
                                       const query = annotationSearchQuery.toLowerCase();
                                       return ann.text.toLowerCase().includes(query) ||
                                          ann.category.toLowerCase().includes(query) ||
                                          (ann.eventDate && ann.eventDate.toLowerCase().includes(query)) ||
                                          ann.author.toLowerCase().includes(query);
                                    })
                                    .sort((a, b) => {
                                       const docNameA = docs.find(d => d.id === a.documentId)?.name || '';
                                       const docNameB = docs.find(d => d.id === b.documentId)?.name || '';
                                       const nameCompare = docNameA.localeCompare(docNameB);
                                       if (nameCompare !== 0) return nameCompare;
                                       return a.page - b.page;
                                    })
                                    .map((ann) => {
                                       const showDocHeader = ann.documentId !== lastDocId;
                                       lastDocId = ann.documentId;
                                       return (
                                          <React.Fragment key={ann.id}>
                                             {showDocHeader && (
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3 mb-1 flex items-center gap-2">
                                                   <FileTextIcon className="w-3 h-3" />
                                                   {docs.find(d => d.id === ann.documentId)?.name || 'Unknown Document'}
                                                </div>
                                             )}
                                             <div
                                                onClick={() => handleJumpToSource(ann.id)}
                                                className="group p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all relative cursor-pointer"
                                             >
                                                <div className="flex justify-between items-start mb-1.5">
                                                   <div className="flex items-center gap-1.5">
                                                      {ann.eventDate ? (
                                                         <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                            {formatDisplayDate(ann.eventDate)}
                                                            {ann.eventTime && <span className="opacity-75 border-l border-indigo-200 pl-1 ml-0.5">{ann.eventTime}</span>}
                                                         </span>
                                                      ) : (
                                                         <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">UNDATED</span>
                                                      )}
                                                      <span className="text-[9px] font-bold text-slate-500 uppercase">{ann.category}</span>
                                                   </div>
                                                   <div className="flex items-center gap-1">
                                                      <button
                                                         title="Jump to Document"
                                                         onClick={(e) => { e.stopPropagation(); handleJumpToSource(ann.id); }}
                                                         className="text-slate-300 hover:text-indigo-600 transition-colors"
                                                      >
                                                         <ArrowRightIcon className="w-3.5 h-3.5" />
                                                      </button>
                                                   </div>
                                                </div>
                                                <p className="text-xs text-slate-700 leading-relaxed font-medium">"{ann.text}"</p>
                                                <div className="mt-1.5 pt-1.5 border-t border-slate-50 flex items-center justify-between text-[9px] text-slate-400">
                                                   <span className="font-semibold text-indigo-600/70 truncate max-w-[140px]">
                                                      Page {ann.page}
                                                   </span>
                                                   <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                      <button
                                                         onClick={(e) => { e.stopPropagation(); handleUpdateAnnotation(ann); }}
                                                         className="p-1 px-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded font-bold text-[9px]"
                                                      >
                                                         Edit
                                                      </button>
                                                      <button
                                                         onClick={(e) => { e.stopPropagation(); handleDeleteAnnotation(ann.id); }}
                                                         className="p-1 px-1 text-red-600 bg-red-50 hover:bg-red-100 rounded font-bold flex items-center"
                                                         title="Delete"
                                                      >
                                                         <Trash2Icon className="w-2.5 h-2.5" />
                                                      </button>
                                                   </span>
                                                </div>
                                             </div>
                                          </React.Fragment>
                                       );
                                    });
                              })()}
                           </div>
                        )}
                     </div>
                  )}
               </div>
            )}

            {/* === TAB: FACTS & NOTES === */}
            {activeTab === 'FACTS' && (
               <div className="h-full flex overflow-hidden bg-slate-100/50">
                  {/* User Notes Input */}
                  <div className="flex-1 p-8 border-r border-slate-200 overflow-y-auto flex flex-col">
                     <div className="flex justify-between items-center mb-6">
                        <div>
                           <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-slate-900">Case Notes</h2>
                           <p className="text-slate-500 text-sm">Enter clinical observations and manual events here.</p>
                        </div>
                        <div className="flex gap-2">
                           <button
                              onClick={() => handwrittenImageInputRef.current?.click()}
                              disabled={isGenerating}
                              className="px-3 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 flex items-center gap-2 shadow-md shadow-amber-100 transition-all disabled:opacity-50"
                           >
                              {isGenerating ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                              Convert Handwritten
                           </button>
                           <button
                              onClick={handleRewordNotes}
                              disabled={isGenerating || !additionalContext.trim()}
                              className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-md shadow-indigo-100 transition-all disabled:opacity-50"
                           >
                              {isGenerating ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <SparklesIcon className="w-3 h-3" />}
                              Reword with AI
                           </button>
                           <button
                              onClick={handleCleanupChronology}
                              disabled={isGenerating || !additionalContext.trim()}
                              className="px-3 py-2 bg-white text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold hover:bg-indigo-50 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                           >
                              {isGenerating ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <CalendarIcon className="w-3 h-3" />}
                              Extract to Timeline
                           </button>
                           <button
                              onClick={() => {
                                 if (confirm('Clear all notes? This cannot be undone.')) {
                                    setAdditionalContext('');
                                 }
                              }}
                              disabled={!additionalContext.trim()}
                              className="px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                           >
                              <Trash2Icon className="w-3 h-3" />
                              Clear Notes
                           </button>
                        </div>
                     </div>

                     {/* Notes Toolbar */}
                     <div className="bg-white rounded-t-2xl border border-slate-200 border-b-0 p-2 flex items-center gap-1">
                        <button
                           onClick={() => setAdditionalContext(prev => prev + (prev.endsWith('\n') ? '' : '\n') + '# Annotations\n')}
                           className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-indigo-600"
                           title="Add Main Header"
                        >
                           <FileTextIcon className="w-4 h-4" />
                        </button>
                        <button
                           onClick={insertTimestamp}
                           className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-indigo-600"
                           title="Insert Timestamp (Dated Notes)"
                        >
                           <CalendarIcon className="w-4 h-4" />
                        </button>
                        <button
                           onClick={() => handwrittenImageInputRef.current?.click()}
                           disabled={isGenerating}
                           className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-indigo-600 disabled:opacity-50"
                           title="Convert handwritten notes to text points"
                        >
                           {isGenerating ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                        </button>
                        <input
                           ref={handwrittenImageInputRef}
                           type="file"
                           accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                           onChange={handleConvertHandwrittenNotes}
                           className="hidden"
                        />

                        {/* Voice Input Button */}
                        <VoiceInputButton
                           isActive={isVoiceActiveFactsNotes}
                           onToggle={() => setIsVoiceActiveFactsNotes(!isVoiceActiveFactsNotes)}
                           onTranscription={handleVoiceTranscriptionFactsNotes}
                           size="sm"
                           className="ml-1"
                           mode="append"
                        />

                        {isVoiceActiveFactsNotes && (
                           <div className="flex items-center gap-2 px-2 py-1 bg-red-50 text-red-600 rounded-lg border border-red-100 animate-in fade-in slide-in-from-left-2 duration-300">
                              <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                              <span className="text-[9px] font-black uppercase tracking-widest">Recording</span>
                           </div>
                        )}

                        <div className="w-px h-4 bg-slate-200 mx-1" />
                        <div className="flex-1" />
                     </div>

                     <div
                        className="flex-1 bg-white rounded-b-2xl border border-slate-200 shadow-sm relative overflow-hidden"
                        onMouseMove={(e) => {
                           if (!isResizingNotesRef.current) return;
                           const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                           const x = e.clientX - rect.left;
                           const next = Math.min(80, Math.max(20, Math.round((x / rect.width) * 100)));
                           setNotesSplit(next);
                        }}
                        onMouseUp={() => { isResizingNotesRef.current = false; }}
                        onMouseLeave={() => { isResizingNotesRef.current = false; }}
                     >
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-slate-100/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="h-full flex">
                           <div className="h-full p-6" style={{ width: `${notesSplit}%` }}>
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dated Notes</div>
                              <textarea
                                 ref={factsNotesTextareaRef}
                                 className="w-full h-[calc(100%-1.5rem)] bg-transparent border-none outline-none resize-none text-slate-800 leading-loose text-base font-medium placeholder:text-slate-300 font-serif"
                                 placeholder={isVoiceActiveFactsNotes ? "🎤 Listening... Speak your clinical notes" : `# Annotations\n(1/24/2026, 1:30:00 PM)\n\n## Clinic Records\n* Patient observations go here...\n* Use (["Source", p. 1]) for references.`}
                                 value={additionalContext}
                                 onChange={e => setAdditionalContext(e.target.value)}
                                 onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey && isVoiceActiveFactsNotes) {
                                       e.preventDefault();
                                       handleRewordNotes();
                                    }
                                 }}
                              />
                           </div>
                           <div
                              className="w-2 bg-slate-100 hover:bg-indigo-200 cursor-col-resize flex items-center justify-center"
                              onMouseDown={(e) => { e.preventDefault(); isResizingNotesRef.current = true; }}
                              title="Drag to resize"
                           >
                              <div className="w-0.5 h-8 bg-slate-300 rounded" />
                           </div>
                           <div className="h-full p-6" style={{ width: `${100 - notesSplit}%` }}>
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Freehand Notes</div>
                              <textarea
                                 className="w-full h-[calc(100%-1.5rem)] bg-transparent border-none outline-none resize-none text-slate-800 leading-loose text-base font-medium placeholder:text-slate-300 font-serif"
                                 placeholder="Freehand notes (not auto-extracted). Use this space for rough notes or non-dated observations."
                                 value={freehandNotes}
                                 onChange={e => setFreehandNotes(e.target.value)}
                              />
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Right: Live Evidence Feed OR Preview Panel */}
                  {previewSource && (() => {
                     const previewDoc = docs.find(d => d.id === previewSource.documentId);
                     if (!previewDoc) return null;
                     return (
                        <PreviewPanel
                           doc={previewDoc}
                           page={previewSource.page}
                           annotations={annotations.filter(a => a.documentId === previewSource.documentId)}
                           highlightAnnotationId={previewSource.annotationId}
                           onClose={() => setPreviewSource(null)}
                           onOpenFullView={() => {
                              if (previewSource.annotationId) {
                                 onNavigateToAnnotation(previewSource.annotationId);
                              } else {
                                 onNavigateToSource(previewSource.documentId, previewSource.page);
                              }
                              setPreviewSource(null);
                           }}
                        />
                     );
                  })()}
               </div>
            )}

            {/* === TAB: RESEARCH (UPDATED) === */}
            {activeTab === 'RESEARCH' && (
               <div className="h-full flex flex-col overflow-hidden">
                  {/* Citation Proposal Modal */}
                  {activeCitationProposal && (
                     <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full h-[80vh] flex flex-col animate-in zoom-in-95">
                           <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                              <div>
                                 <h3 className="font-serif font-black text-slate-800 text-lg">Review Citation Insertion</h3>
                                 <p className="text-xs text-indigo-600">{activeCitationProposal.explanation}</p>
                              </div>
                              <button onClick={() => setActiveCitationProposal(null)} className="text-slate-400 hover:text-slate-600"><XIcon className="w-5 h-5" /></button>
                           </div>
                           <div className="flex-1 overflow-auto p-6 bg-slate-50 font-serif text-sm leading-loose">
                              {activeCitationProposal.diff.map((part, i) => (
                                 <span
                                    key={i}
                                    className={part.added ? 'bg-green-200 text-green-900' : part.removed ? 'bg-red-100 text-red-800 line-through' : ''}
                                 >
                                    {part.value}
                                 </span>
                              ))}
                           </div>
                           <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
                              <button onClick={() => setActiveCitationProposal(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                              <button onClick={handleAcceptCitation} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                                 <CheckIcon className="w-4 h-4" /> Apply Changes
                              </button>
                           </div>
                        </div>
                     </div>
                  )}

                  <div ref={researchScrollRef} className="flex-1 overflow-auto p-10 w-full">
                     <div className="max-w-7xl mx-auto w-full">
                        <div className="flex justify-between items-start mb-12">
                           <div>
                              <h2 className="text-4xl font-extrabold tracking-[-0.02em] text-slate-900 leading-tight">Medical Research Assistant</h2>
                              <p className="text-slate-500 text-base mt-2 font-medium">Analyze your report for gaps or search manually.</p>
                           </div>
                           <button
                              onClick={handleAnalyzeGaps}
                              disabled={isGenerating}
                              className="flex items-center gap-2.5 px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all disabled:opacity-50"
                           >
                              {isGenerating ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                              Scan Report for Gaps
                           </button>
                        </div>

                        {/* Gap Analysis Results (Matching Image) */}
                        {researchGaps.length > 0 && (
                           <div className="mb-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {researchGaps.map((gap, i) => (
                                 <div key={i} className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100/50 hover:shadow-xl hover:shadow-amber-100/20 transition-all group flex flex-col h-full">
                                    <div className="flex items-start gap-3 mb-4">
                                       <div className="p-2 bg-white rounded-xl shadow-sm">
                                          <AlertCircleIcon className="w-5 h-5 text-amber-500 shrink-0" />
                                       </div>
                                       <h3 className="font-serif font-black text-amber-950 text-base leading-tight pt-1">{gap.topic}</h3>
                                    </div>
                                    <p className="text-sm text-amber-900/70 mb-8 font-medium leading-relaxed flex-1">{gap.reason}</p>
                                    <button
                                       onClick={() => handleResearchTopic(gap.topic)}
                                       className="w-full py-3 bg-white border border-amber-200 text-amber-900 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-amber-100 flex items-center justify-center gap-2 transition-colors shadow-sm"
                                    >
                                       <SearchIcon className="w-4 h-4" /> Find Sources
                                    </button>
                                 </div>
                              ))}
                           </div>
                        )}

                        {/* Search Bar (Matching Image Placement) */}
                        <div ref={researchSearchRef} className="relative mb-12 mx-auto w-full max-w-7xl">
                           <div className="relative flex items-center bg-white border border-slate-200 rounded-[1.5rem] shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all p-1.5 pr-2">
                              <SearchIcon className="ml-4 w-5 h-5 text-slate-400" />
                              <input
                                 className="flex-1 pl-3 pr-4 py-4 text-base focus:outline-none bg-transparent"
                                 placeholder="Search by condition, keyword, DOI, or journal name..."
                                 value={researchQuery}
                                 onChange={e => setResearchQuery(e.target.value)}
                                 onKeyDown={e => e.key === 'Enter' && handleResearch(e)}
                              />
                              <button
                                 onClick={handleResearch}
                                 disabled={isGenerating}
                                 className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl font-bold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all disabled:opacity-50"
                              >
                                 {isGenerating ? <Loader2Icon className="w-4 h-4 animate-spin" /> : 'Search'}
                              </button>
                           </div>
                        </div>

                        {/* PDF Preview Modal — rendered via pdf.js canvas (PMC blocks iframes) */}
                        {pdfPreviewUrl && (
                           <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => { setPdfPreviewUrl(null); setPdfPreviewTitle(''); }}>
                              <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[85vh] flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                 {/* Header */}
                                 <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50 rounded-t-2xl shrink-0">
                                    <div className="flex-1 min-w-0">
                                       <h3 className="font-serif font-black text-slate-800 text-lg truncate">{pdfPreviewTitle}</h3>
                                       <p className="text-xs text-emerald-600 font-medium">Full-text PDF from PubMed Central</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                       <button onClick={() => window.open(pdfPreviewUrl, '_blank')} className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 flex items-center gap-1.5">
                                          <ExternalLinkIcon className="w-3 h-3" /> Open in New Tab
                                       </button>
                                       <button onClick={() => { setPdfPreviewUrl(null); setPdfPreviewTitle(''); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                          <XIcon className="w-5 h-5" />
                                       </button>
                                    </div>
                                 </div>

                                 {/* Page navigation bar */}
                                 {pdfPreviewDoc && (
                                    <div className="flex items-center justify-center gap-4 py-2 px-4 border-b border-slate-100 bg-white shrink-0">
                                       <button
                                          onClick={() => setPdfPreviewPage(p => Math.max(1, p - 1))}
                                          disabled={pdfPreviewPage <= 1}
                                          className="px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-30"
                                       >
                                          Previous
                                       </button>
                                       <span className="text-sm font-bold text-slate-700">
                                          Page {pdfPreviewPage} of {pdfPreviewDoc.numPages}
                                       </span>
                                       <button
                                          onClick={() => setPdfPreviewPage(p => Math.min(pdfPreviewDoc!.numPages, p + 1))}
                                          disabled={pdfPreviewPage >= pdfPreviewDoc.numPages}
                                          className="px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-30"
                                       >
                                          Next
                                       </button>
                                    </div>
                                 )}

                                 {/* PDF canvas area */}
                                 <div ref={pdfPreviewContainerRef} className="flex-1 overflow-auto bg-slate-100 flex justify-center p-6">
                                    {pdfPreviewLoading && (
                                       <div className="flex flex-col items-center justify-center gap-3 py-20">
                                          <Loader2Icon className="w-8 h-8 text-emerald-500 animate-spin" />
                                          <p className="text-sm font-bold text-slate-500">Loading PDF from PubMed Central...</p>
                                       </div>
                                    )}
                                    {pdfPreviewError && (
                                       <div className="flex flex-col items-center justify-center gap-3 py-20 max-w-md text-center">
                                          <AlertCircleIcon className="w-8 h-8 text-red-400" />
                                          <p className="text-sm font-bold text-red-600">Could not load PDF preview</p>
                                          <p className="text-xs text-slate-500">{pdfPreviewError}</p>
                                          <p className="text-xs text-slate-400">Some PMC articles only provide HTML full text. You can view the article directly on PubMed Central.</p>
                                          <button onClick={() => window.open(pdfPreviewUrl, '_blank')} className="mt-2 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200">
                                             Open on PubMed Central
                                          </button>
                                       </div>
                                    )}
                                    {!pdfPreviewLoading && !pdfPreviewError && pdfPreviewDoc && (
                                       <canvas ref={pdfPreviewCanvasRef} className="shadow-lg rounded-lg max-w-full" />
                                    )}
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* Results List */}
                        <div className="space-y-6">
                           {researchResults.map((article, i) => (
                              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                 <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                       <div className="flex items-center gap-2 mb-1">
                                          {article.pdfUrl && (
                                             <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">PDF Available</span>
                                          )}
                                          {article.pmcId && (
                                             <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{article.pmcId}</span>
                                          )}
                                       </div>
                                       <h3 className="text-lg font-bold text-emerald-800 hover:underline cursor-pointer" onClick={() => window.open(article.url, '_blank')}>
                                          {article.title} <ExternalLinkIcon className="w-3 h-3 inline ml-1 text-slate-400" />
                                       </h3>
                                       <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-wider mt-1 inline-block">{article.source}</span>
                                    </div>
                                    <div className="flex flex-col gap-2 ml-4">
                                       {article.pdfUrl && (
                                          <button
                                             onClick={() => { setPdfPreviewUrl(article.pdfUrl!); setPdfPreviewTitle(article.title); }}
                                             className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 flex items-center gap-2 whitespace-nowrap"
                                          >
                                             <EyeIcon className="w-4 h-4" /> View PDF
                                          </button>
                                       )}
                                       <button
                                          onClick={() => handleSmartCite(article)}
                                          disabled={isGenerating}
                                          className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 flex items-center gap-2 whitespace-nowrap"
                                       >
                                          <PenToolIcon className="w-4 h-4" /> Smart Cite
                                       </button>
                                    </div>
                                 </div>
                                 <p className="text-sm text-slate-600 leading-relaxed mb-4">{article.summary}</p>
                                 <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <code className="text-xs text-slate-500 font-mono flex-1 mr-4 truncate">{article.citation}</code>
                                    <button onClick={() => copyToClipboard(article.citation)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700">
                                       <CopyIcon className="w-3.5 h-3.5" /> Copy
                                    </button>
                                 </div>
                              </div>
                           ))}
                           {isGenerating && researchResults.length === 0 && (
                              <div className="py-6">
                                 <SkeletonLoader type="research" />
                              </div>
                           )}
                           {researchResults.length === 0 && !isGenerating && !researchGaps.length && (
                              <div className="text-center py-20 opacity-50">
                                 <BookOpenIcon className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                                 <p className="text-slate-500">Search PubMed Central for verified, open-access articles with full PDFs.</p>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* === TAB: WRITER (Google Docs Workflow) === */}
            {activeTab === 'WRITER' && (
               <div className="h-full flex overflow-hidden bg-slate-50">
                  {/* Left: Document Workspace */}
                  <div className="flex-1 flex flex-col">
                     {/* Floating Action Bar (Top of Workspace) */}
                     <div className="w-full flex justify-between items-center bg-white/95 backdrop-blur-sm px-6 py-3 border-b border-slate-200 shadow-sm shrink-0 sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
                              <FileTextIcon className="w-4 h-4" />
                           </div>
                           <div>
                              <h3 className="text-sm font-extrabold tracking-[-0.02em] text-slate-900">Confidential Medical-Legal Report</h3>
                              <div className="flex items-center gap-2">
                                 <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Single-Page Workspace</p>
                                 {isSaving && (
                                    <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                                       <Loader2Icon className="w-3 h-3 animate-spin" />
                                       Saving...
                                    </span>
                                 )}
                                 {!isSaving && reportContent && !isGenerating && (
                                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                       <CheckIcon className="w-3 h-3" />
                                       Saved
                                    </span>
                                 )}
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="relative">
                              <button
                                 ref={moreButtonRef}
                                 onClick={() => setShowHeaderMenu(s => !s)}
                                 className="p-2 rounded-lg text-slate-500 hover:bg-slate-50"
                                 title="More"
                              >
                                 <MoreHorizontalIcon className="w-4 h-4" />
                              </button>
                              {showHeaderMenu && menuPosition && ReactDOM.createPortal(
                                 <div
                                    style={{
                                       position: 'fixed',
                                       left: `${menuPosition.left}px`,
                                       top: `${menuPosition.top}px`,
                                       width: 220
                                    }}
                                    className="bg-white border border-slate-200 rounded-md shadow-lg z-50"
                                 >
                                    <button
                                       onClick={() => { setIsTemplateModalOpen(true); setShowHeaderMenu(false); }}
                                       className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                                    >
                                       Templates
                                    </button>
                                    <button
                                       onClick={() => { setShowVersionHistory(true); setShowHeaderMenu(false); }}
                                       className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                                    >
                                       History ({(caseItem.draftVersions || []).length})
                                    </button>

                                    <button
                                       onClick={() => { setShowExportModal(true); setShowHeaderMenu(false); }}
                                       className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                                    >
                                       Export...
                                    </button>
                                 </div>,
                                 document.body
                              )}
                           </div>



                           {/* Save Version Button - Explicitly saves current version to history */}
                           <button
                              onClick={handleSaveDraft}
                              disabled={isGenerating || isSaving || !reportContent}
                              className="bg-emerald-700 text-white px-4 py-1.5 rounded-xl shadow-md shadow-emerald-100 hover:bg-emerald-800 font-bold flex items-center gap-2 text-xs transition-all disabled:opacity-50 ring-1 ring-emerald-500/20"
                           >
                              {isSaving ? (
                                 <>
                                    <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                                    Saving...
                                 </>
                              ) : (
                                 <>
                                    <ArchiveIcon className="w-3.5 h-3.5" />
                                    Save Version
                                 </>
                              )}
                           </button>

                           <button
                              onClick={handleFinalizeReport}
                              disabled={isGenerating || !reportContent}
                              className="bg-emerald-600 text-white px-4 py-1.5 rounded-xl shadow-md shadow-emerald-100 hover:bg-emerald-700 font-bold flex items-center gap-2 text-xs transition-all disabled:opacity-50"
                           >
                              <FileCheckIcon className="w-3.5 h-3.5" />
                              Finalize & Export
                           </button>

                           <div className="h-4 w-px bg-slate-200 mx-1" />

                           {/* Voice Input Button */}
                           <VoiceInputButton
                              isActive={isVoiceActiveWriter}
                              onToggle={() => {
                                 setIsVoiceActiveWriter(!isVoiceActiveWriter);
                              }}
                              onTranscription={handleVoiceTranscriptionWriter}
                              size="md"
                              mode="append"
                           />

                           {isVoiceActiveWriter && (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl border border-red-100 animate-in fade-in slide-in-from-left-2 duration-300">
                                 <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                                 <span className="text-[10px] font-black uppercase tracking-widest">Voice Active</span>
                              </div>
                           )}

                           <div className="h-4 w-px bg-slate-200 mx-1" />
                           <button className="text-slate-400 hover:text-indigo-600 p-2"><CopyIcon className="w-4 h-4" /></button>
                        </div>
                     </div>

                     {/* Google Docs-style Formatting Toolbar */}
                     <div className="flex items-center gap-0.5 px-4 py-1.5 bg-slate-50 border-b border-slate-200 shrink-0 flex-wrap">
                        {/* Heading/paragraph style dropdown */}
                        <select
                           title="Text style"
                           className="text-xs bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-600 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer mr-1"
                           defaultValue="p"
                           onMouseDown={(e) => e.stopPropagation()}
                           onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'p') {
                                 document.execCommand('formatBlock', false, 'P');
                              } else {
                                 document.execCommand('formatBlock', false, val);
                              }
                              editableDivRef.current?.focus();
                           }}
                        >
                           <option value="p">Normal Text</option>
                           <option value="H1">Heading 1</option>
                           <option value="H2">Heading 2</option>
                           <option value="H3">Heading 3</option>
                           <option value="H4">Heading 4</option>
                        </select>

                        {/* Font family selector */}
                        <select
                           title="Font"
                           className="text-xs bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-600 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer mr-1"
                           defaultValue="Times New Roman"
                           onMouseDown={(e) => e.stopPropagation()}
                           onChange={(e) => { document.execCommand('fontName', false, e.target.value); editableDivRef.current?.focus(); }}
                        >
                           <option value="Times New Roman">Times New Roman</option>
                           <option value="Arial">Arial</option>
                           <option value="Helvetica">Helvetica</option>
                           <option value="Georgia">Georgia</option>
                           <option value="Courier New">Courier New</option>
                        </select>

                        {/* Font size selector */}
                        <select
                           title="Font size"
                           className="text-xs bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-600 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer mr-1 w-14"
                           defaultValue="3"
                           onMouseDown={(e) => e.stopPropagation()}
                           onChange={(e) => { document.execCommand('fontSize', false, e.target.value); editableDivRef.current?.focus(); }}
                        >
                           <option value="1">8</option>
                           <option value="2">10</option>
                           <option value="3">12</option>
                           <option value="4">14</option>
                           <option value="5">18</option>
                           <option value="6">24</option>
                           <option value="7">36</option>
                        </select>

                        <div className="w-px h-5 bg-slate-300 mx-1.5" />
                        {[
                           { cmd: 'undo', icon: Undo2Icon, title: 'Undo (Ctrl+Z)' },
                           { cmd: 'redo', icon: Redo2Icon, title: 'Redo (Ctrl+Y)' },
                        ].map(({ cmd, icon: Icon, title }) => (
                           <button key={cmd} title={title} onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); editableDivRef.current?.focus(); }}
                              className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"><Icon className="w-4 h-4" /></button>
                        ))}
                        <div className="w-px h-5 bg-slate-300 mx-1.5" />
                        {[
                           { cmd: 'bold', icon: BoldIcon, title: 'Bold (Ctrl+B)' },
                           { cmd: 'italic', icon: ItalicIcon, title: 'Italic (Ctrl+I)' },
                           { cmd: 'underline', icon: UnderlineIcon, title: 'Underline (Ctrl+U)' },
                           { cmd: 'strikeThrough', icon: StrikethroughIcon, title: 'Strikethrough' },
                        ].map(({ cmd, icon: Icon, title }) => (
                           <button key={cmd} title={title} onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); editableDivRef.current?.focus(); }}
                              className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"><Icon className="w-4 h-4" /></button>
                        ))}
                        <div className="w-px h-5 bg-slate-300 mx-1.5" />
                        {[
                           { cmd: 'justifyLeft', icon: AlignLeftIcon, title: 'Align Left' },
                           { cmd: 'justifyCenter', icon: AlignCenterIcon, title: 'Align Center' },
                           { cmd: 'justifyRight', icon: AlignRightIcon, title: 'Align Right' },
                           { cmd: 'justifyFull', icon: AlignJustifyIcon, title: 'Justify' },
                        ].map(({ cmd, icon: Icon, title }) => (
                           <button key={cmd} title={title} onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); editableDivRef.current?.focus(); }}
                              className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"><Icon className="w-4 h-4" /></button>
                        ))}
                        <div className="w-px h-5 bg-slate-300 mx-1.5" />
                        {[
                           { cmd: 'insertUnorderedList', icon: ListIcon, title: 'Bullet List' },
                           { cmd: 'insertOrderedList', icon: ListOrderedIcon, title: 'Numbered List' },
                           { cmd: 'indent', icon: IndentIcon, title: 'Indent' },
                           { cmd: 'outdent', icon: OutdentIcon, title: 'Outdent' },
                        ].map(({ cmd, icon: Icon, title }) => (
                           <button key={cmd} title={title} onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); editableDivRef.current?.focus(); }}
                              className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"><Icon className="w-4 h-4" /></button>
                        ))}
                     </div>

                     {/* Scrollable Content Area */}
                     <div className="flex-1 overflow-y-auto">
                        <div className="min-h-full py-8 px-4 md:py-12 md:px-8 flex justify-center">
                           {/* The Page Container - Unified Editable Workspace */}
                           <div className="w-full max-w-[8.5in] min-h-[11in] bg-white shadow-lg border border-slate-200 flex flex-col transition-all relative group">
                              <div
                                 key={writerContentKey}
                                 ref={editableDivRef}
                                 contentEditable
                                 suppressContentEditableWarning
                                 className="w-full min-h-[11in] outline-none px-[1in] py-[1in] bg-transparent font-serif text-[12pt] leading-[2] text-slate-900 prose prose-slate max-w-none prose-headings:font-serif prose-headings:font-bold prose-p:my-0 prose-h1:text-4xl md:prose-h1:text-5xl prose-h1:tracking-tight prose-h2:text-2xl md:prose-h2:text-3xl prose-h3:text-xl md:prose-h3:text-2xl prose-h2:mt-8 prose-h3:mt-6"
                                 style={{ fontFamily: "'Times New Roman', 'Liberation Serif', 'Nimbus Roman', Times, serif" }}
                                 onInput={() => {
                                    if (editableDivRef.current) {
                                       isUserTypingRef.current = true;
                                       const html = editableDivRef.current.innerHTML;
                                       setReportContent(html);
                                       pushToUndoStack(html);
                                    }
                                    setSelectionPopup(null);
                                 }}
                                 onMouseUp={handleTextSelect}
                                 onKeyDown={(e) => {
                                    if (e.key === 'Enter' && selectionPopup && !e.shiftKey && !e.ctrlKey) {
                                       e.preventDefault();
                                       handleCreateComment();
                                    }
                                 }}
                              />
                              {isGenerating && (
                                 <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
                                    <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                                    <p className="text-sm font-serif italic text-indigo-600 font-bold mt-4">Synthesizing clinical evidence...</p>
                                 </div>
                              )}
                              {selectionPopup && ReactDOM.createPortal(
                                 <div
                                    style={{
                                       position: 'fixed',
                                       left: selectionPopup.x,
                                       top: selectionPopup.y,
                                       transform: 'translate(-50%, -100%)',
                                       zIndex: 9999
                                    }}
                                    className="flex items-center gap-1"
                                 >
                                    <button
                                       onClick={handleEditWithAI}
                                       className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium px-3 py-1.5 rounded shadow-lg flex items-center gap-1.5 transition-colors"
                                       title="Edit selection with AI"
                                    >
                                       <SparklesIcon className="w-3 h-3" />
                                       Edit with AI
                                    </button>
                                    <button
                                       onClick={handleCreateComment}
                                       className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded shadow-lg flex items-center gap-1.5 transition-colors"
                                       title="Create comment (or press Enter)"
                                    >
                                       <MessageCircleIcon className="w-3 h-3" />
                                       Comment
                                    </button>
                                 </div>,
                                 document.body
                              )}
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Right: Docs-Style Sidebar (Fixed Width) */}
                  <div className="w-96 flex flex-col bg-white border-l border-slate-200">
                     {/* Sidebar Header / Toggle */}
                     <div className="flex border-b border-slate-200 bg-white">
                        <button
                           onClick={() => setWriterSidebarMode('COMMENTS')}
                           className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-colors ${writerSidebarMode === 'COMMENTS' ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                        >
                           <MessageCircleIcon className="w-3.5 h-3.5" /> Comments
                        </button>
                        <button
                           onClick={() => setWriterSidebarMode('AI')}
                           className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-colors ${writerSidebarMode === 'AI' ? 'text-emerald-600 border-emerald-600 bg-emerald-50/50' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                        >
                           <BrainCircuitIcon className="w-3.5 h-3.5" /> AI Assistant
                        </button>
                     </div>

                     {/* Sidebar Content */}
                     <div className="flex-1 overflow-y-auto p-4 space-y-4">

                        {/* MODE: COMMENTS */}
                        {writerSidebarMode === 'COMMENTS' && (
                           <WriterCommentSidebar
                              comments={caseItem.reportComments || []}
                              selectedText={selectedTextForComment}
                              commentInput={commentInput}
                              currentUserName={currentUser.name}
                              onCommentInputChange={setCommentInput}
                              onCancelSelection={() => setSelectedTextForComment('')}
                              onAddComment={handleAddComment}
                              onLocateComment={handleLocateComment}
                              onResolveComment={handleResolveComment}
                              onDeleteComment={handleDeleteComment}
                              onEditComment={(id, newText) => {
                                 const updated = (caseItem.reportComments || []).map(c =>
                                    c.id === id ? { ...c, text: newText } : c
                                 );
                                 onUpdateCase({ ...caseItem, reportComments: updated });
                              }}
                           />
                        )}

                        {/* MODE: AI ASSISTANT (Claude) */}
                        {writerSidebarMode === 'AI' && (
                           <div className="flex flex-col h-full -m-4">
                              {/* Sidebar Header */}
                              <div className="px-4 py-3 border-b border-slate-200 bg-violet-50/60 flex items-center justify-between shrink-0">
                                 <div className="flex items-center gap-2">
                                    <SparklesIcon className="w-4 h-4 text-violet-500" />
                                    <span className="text-xs font-bold text-violet-800">Claude AI</span>
                                 </div>
                                 <div className="flex items-center gap-1">
                                    {sidebarTemplateStep === 'chat' && (
                                       <button
                                          onClick={() => { setSidebarTemplateStep('select'); setSidebarSelectedTemplate(null); setSidebarTemplateSections([]); setSidebarCaseDescription(''); }}
                                          className="text-[9px] font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full hover:bg-violet-200 transition-colors"
                                       >
                                          New Report
                                       </button>
                                    )}
                                    {selectedEditorText && (
                                       <span className="text-[9px] font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                                          Selection active
                                       </span>
                                    )}
                                    {sidebarMessages.length > 0 && (
                                       <button onClick={handleClearSidebar} className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors" title="Clear chat">
                                          <Trash2Icon className="w-3.5 h-3.5" />
                                       </button>
                                    )}
                                 </div>
                              </div>

                              {/* Scrollable Messages + Suggestions */}
                              <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollBehavior: 'smooth' }}>

                                 {/* STEP 1: Template Selection */}
                                 {sidebarTemplateStep === 'select' && (
                                    <div className="space-y-3">
                                       <div className="text-center pt-2 pb-3">
                                          <FileTextIcon className="w-10 h-10 text-violet-400 mx-auto mb-2" />
                                          <h3 className="text-sm font-extrabold text-slate-800 mb-1">Start Your Report</h3>
                                          <p className="text-[10px] text-slate-500 leading-relaxed">Choose a template to begin, then customize the sections and describe your case.</p>
                                       </div>
                                       <div className="space-y-2">
                                          {SIDEBAR_TEMPLATES.map(tpl => (
                                             <button
                                                key={tpl.id}
                                                onClick={() => {
                                                   setSidebarSelectedTemplate(tpl.id);
                                                   setSidebarTemplateSections(
                                                      tpl.sections.map((s, i) => ({ id: `sec-${i}`, name: s, enabled: true }))
                                                   );
                                                   setSidebarTemplateStep('customize');
                                                }}
                                                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50/40 transition-all group"
                                             >
                                                <div className="flex items-center gap-3">
                                                   <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                                                      <SparklesIcon className="w-4 h-4 text-violet-500" />
                                                   </div>
                                                   <div>
                                                      <h4 className="text-xs font-bold text-slate-800 group-hover:text-violet-700">{tpl.title}</h4>
                                                      <p className="text-[10px] text-slate-400">{tpl.desc}</p>
                                                   </div>
                                                </div>
                                             </button>
                                          ))}
                                       </div>
                                       <p className="text-[9px] text-slate-400 text-center pt-2">Or type a message below to chat with Claude directly.</p>
                                    </div>
                                 )}

                                 {/* STEP 2: Customize Template Sections */}
                                 {sidebarTemplateStep === 'customize' && (
                                    <div className="space-y-3">
                                       <div className="flex items-center justify-between">
                                          <button
                                             onClick={() => { setSidebarTemplateStep('select'); setSidebarSelectedTemplate(null); }}
                                             className="text-[10px] text-violet-600 hover:text-violet-800 font-bold"
                                          >
                                             &larr; Back
                                          </button>
                                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                             {SIDEBAR_TEMPLATES.find(t => t.id === sidebarSelectedTemplate)?.title}
                                          </span>
                                       </div>

                                       <p className="text-[10px] text-slate-500">Edit, reorder, or toggle sections for your report:</p>

                                       <div className="space-y-1.5">
                                          {sidebarTemplateSections.map((section, idx) => (
                                             <div key={section.id} className="flex items-center gap-1.5 group">
                                                <GripVerticalIcon className="w-3 h-3 text-slate-300 cursor-grab shrink-0" />
                                                <button
                                                   onClick={() => {
                                                      setSidebarTemplateSections(prev =>
                                                         prev.map(s => s.id === section.id ? { ...s, enabled: !s.enabled } : s)
                                                      );
                                                   }}
                                                   className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${section.enabled ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'}`}
                                                >
                                                   {section.enabled && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                                                </button>
                                                <input
                                                   type="text"
                                                   value={section.name}
                                                   onChange={(e) => {
                                                      setSidebarTemplateSections(prev =>
                                                         prev.map(s => s.id === section.id ? { ...s, name: e.target.value } : s)
                                                      );
                                                   }}
                                                   className={`flex-1 text-[11px] px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-violet-400 focus:outline-none transition-colors ${!section.enabled ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                                                />
                                                <button
                                                   onClick={() => {
                                                      setSidebarTemplateSections(prev => prev.filter(s => s.id !== section.id));
                                                   }}
                                                   className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                   <XIcon className="w-3 h-3" />
                                                </button>
                                             </div>
                                          ))}
                                       </div>

                                       <button
                                          onClick={() => {
                                             const newId = `sec-${Date.now()}`;
                                             setSidebarTemplateSections(prev => [...prev, { id: newId, name: 'NEW SECTION', enabled: true }]);
                                          }}
                                          className="flex items-center gap-1.5 text-[10px] font-bold text-violet-600 hover:text-violet-800 pl-6"
                                       >
                                          <PlusIcon className="w-3 h-3" /> Add Section
                                       </button>

                                       <div className="pt-2 space-y-2">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Describe your case</label>
                                          <textarea
                                             value={sidebarCaseDescription}
                                             onChange={(e) => setSidebarCaseDescription(e.target.value)}
                                             placeholder="Briefly describe the essence of your case, key facts, and what you need this report to address..."
                                             className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none bg-slate-50 transition-all"
                                             rows={4}
                                          />
                                       </div>

                                       <button
                                          onClick={async () => {
                                             setSidebarTemplateStep('chat');
                                             setIsGenerating(true);
                                             try {
                                                if (reportContent.trim()) {
                                                   setUndoStack(prev => [...prev, reportContent].slice(-50));
                                                   setRedoStack([]);
                                                }
                                                let pdfTextContext = '';
                                                try {
                                                   pdfTextContext = await extractPdfTextForAnnotations(docs, annotations, {
                                                      perPageCharLimit: 1500,
                                                      totalCharLimit: 12000
                                                   });
                                                } catch (err) {
                                                   console.warn('PDF text extraction failed:', err);
                                                }
                                                const commentsText = (caseItem.reportComments || [])
                                                   .map(c => `- ${c.author}: ${c.text}${c.context ? ` (Context: ${c.context})` : ''}`)
                                                   .join('\n');

                                                // Extract CV text for expert qualifying paragraph
                                                let cvContent = '';
                                                if (currentUser.cvUrl) {
                                                   try {
                                                      cvContent = await extractPdfTextFromUrl(currentUser.cvUrl, 15000);
                                                   } catch (err) {
                                                      console.warn('CV extraction failed:', err);
                                                   }
                                                }

                                                const caseContext = buildCaseContext(
                                                   caseItem,
                                                   docs,
                                                   annotations,
                                                   pdfTextContext,
                                                   currentUser,
                                                   '',
                                                   commentsText,
                                                   cvContent
                                                );

                                                // Build custom template from editable sections
                                                const customTemplate = sidebarTemplateSections
                                                   .filter(s => s.enabled)
                                                   .map((s, i) => `${toRoman(i + 1)}. ${s.name}`)
                                                   .join('\n');

                                                // If user provided a case description, prepend it to the context
                                                if (sidebarCaseDescription.trim()) {
                                                   caseContext.caseDescription = (caseContext.caseDescription ? caseContext.caseDescription + '\n\n' : '') +
                                                      'ADDITIONAL CASE CONTEXT FROM USER:\n' + sidebarCaseDescription.trim();
                                                }

                                                const generatedReport = await generateReport(
                                                   caseContext,
                                                   customTemplate,
                                                   (chunk) => {
                                                      const html = parse(chunk) as string;
                                                      setReportContent(html);
                                                      lastContentRef.current = html;
                                                   }
                                                );
                                                const html = parse(generatedReport) as string;

                                                await onUpdateCase({ ...caseItemRef.current, reportContent: html });
                                                setReportContent(html);
                                                lastContentRef.current = html;
                                                setWriterContentKey(prev => prev + 1);
                                                setSidebarSuggestions([]);
                                             } catch (error) {
                                                console.error("Failed to generate report:", error);
                                                alert("Failed to generate report. Please try again.");
                                             } finally {
                                                setIsGenerating(false);
                                             }
                                          }}
                                          disabled={isGenerating}
                                          className="w-full py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 shadow-lg shadow-violet-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                       >
                                          {isGenerating ? (
                                             <><Loader2Icon className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                                          ) : (
                                             <><SparklesIcon className="w-3.5 h-3.5" /> Generate Report</>
                                          )}
                                       </button>
                                    </div>
                                 )}

                                 {/* STEP 3: Chat mode (existing chat + messages) */}
                                 {sidebarTemplateStep === 'chat' && (
                                    <>
                                 {/* Empty state for chat mode */}
                                 {sidebarMessages.length === 0 && sidebarSuggestions.length === 0 && !sidebarStreaming && (
                                    <div className="text-center py-6">
                                       <SparklesIcon className="w-8 h-8 text-violet-300 mx-auto mb-2" />
                                       <p className="text-xs text-slate-500 font-medium mb-1">Ask Claude anything about your case</p>
                                       <p className="text-[10px] text-slate-400">Select text in the editor for focused rewriting, or attach files for context.</p>
                                    </div>
                                 )}

                                 {/* Chat messages */}
                                 {sidebarMessages.map((msg) => (
                                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                       {msg.role === 'user' ? (
                                          <div className="bg-violet-600 text-white px-3 py-2 rounded-2xl rounded-br-none text-xs max-w-[90%]">
                                             {msg.content}
                                          </div>
                                       ) : (
                                          <div className="w-full">
                                             <div className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-2xl rounded-bl-none text-xs shadow-sm prose prose-sm prose-slate max-w-none prose-p:my-1 prose-li:my-0"
                                                dangerouslySetInnerHTML={{ __html: parse(msg.content) as string }}
                                             />
                                             {!msg.content.startsWith('Error:') && !msg.content.startsWith('Found ') && (
                                                <div className="flex items-center gap-1 mt-1 ml-1">
                                                   <button
                                                      onClick={() => navigator.clipboard.writeText(msg.content)}
                                                      className="text-[9px] font-bold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
                                                   >
                                                      Copy
                                                   </button>
                                                   <button
                                                      onClick={() => handleInsertFromChat(msg.content)}
                                                      className="text-[9px] font-bold text-emerald-500 hover:text-emerald-700 px-1.5 py-0.5 rounded hover:bg-emerald-50 transition-colors"
                                                   >
                                                      Insert
                                                   </button>
                                                </div>
                                             )}
                                          </div>
                                       )}
                                    </div>
                                 ))}

                                 {/* Streaming text */}
                                 {sidebarStreaming && sidebarStreamText && (
                                    <div className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-2xl rounded-bl-none text-xs shadow-sm prose prose-sm prose-slate max-w-none prose-p:my-1"
                                       dangerouslySetInnerHTML={{ __html: parse(sidebarStreamText) as string }}
                                    />
                                 )}

                                 {/* Loading indicator */}
                                 {sidebarStreaming && !sidebarStreamText && (
                                    <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                                       <Loader2Icon className="w-3 h-3 animate-spin" /> Claude is thinking...
                                    </div>
                                 )}

                                 {/* Suggestion Cards (Accept / Reject) */}
                                 {sidebarSuggestions.length > 0 && (
                                    <div className="space-y-3 pt-2">
                                       <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                             {sidebarSuggestions.length} Suggested Edit{sidebarSuggestions.length > 1 ? 's' : ''}
                                          </span>
                                          {sidebarSuggestions.length > 1 && (
                                             <button
                                                onClick={handleAcceptAllSuggestions}
                                                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 px-2 py-0.5 rounded hover:bg-emerald-50 transition-colors"
                                             >
                                                Accept All
                                             </button>
                                          )}
                                       </div>
                                       {sidebarSuggestions.map((s) => (
                                          <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                             <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100">
                                                <span className="text-[10px] font-bold text-slate-600">{s.reason}</span>
                                             </div>
                                             <div className="p-2.5 text-[10px] font-mono bg-slate-50/50 max-h-48 overflow-y-auto leading-relaxed">
                                                {s.diff.map((part, i) => (
                                                   <span
                                                      key={i}
                                                      className={
                                                         part.added ? 'bg-green-100 text-green-800' :
                                                            part.removed ? 'bg-red-100 text-red-800 line-through' : 'text-slate-500'
                                                      }
                                                   >
                                                      {part.value}
                                                   </span>
                                                ))}
                                             </div>
                                             <div className="p-2 border-t border-slate-100 flex gap-2">
                                                <button
                                                   onClick={() => handleAcceptSuggestion(s)}
                                                   className="flex-1 bg-emerald-600 text-white py-1.5 rounded-lg text-[10px] font-bold hover:bg-emerald-700 flex items-center justify-center gap-1"
                                                >
                                                   <CheckIcon className="w-3 h-3" /> Accept
                                                </button>
                                                <button
                                                   onClick={() => handleRejectSuggestion(s.id)}
                                                   className="flex-1 bg-white text-slate-500 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-50 hover:text-red-600 border border-slate-200 flex items-center justify-center gap-1"
                                                >
                                                   <XIcon className="w-3 h-3" /> Reject
                                                </button>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 )}
                                 </>
                                 )}
                              </div>

                              {/* Input Area (pinned to bottom) */}
                              <div className="shrink-0 border-t border-slate-200 bg-white p-3 space-y-2">
                                 {/* Selection indicator */}
                                 {selectedEditorText && (
                                    <div className="flex items-center gap-2 px-2 py-1.5 bg-violet-50 border border-violet-200 rounded-lg">
                                       <Edit3Icon className="w-3 h-3 text-violet-500 shrink-0" />
                                       <span className="text-[10px] text-violet-700 font-medium truncate">
                                          Editing: "{selectedEditorText.slice(0, 60)}{selectedEditorText.length > 60 ? '...' : ''}"
                                       </span>
                                    </div>
                                 )}

                                 {/* Quick edit chips */}
                                 <div className="flex flex-wrap gap-1.5">
                                    {[
                                       { label: 'Authoritative', prompt: 'Make the tone more authoritative and expert-driven.' },
                                       { label: 'Concise', prompt: 'Make this more concise and clinically direct.' },
                                       { label: 'Critique', prompt: 'Critique for clinical inconsistencies or weak logic.' },
                                       { label: 'Expand', prompt: 'Expand with deeper clinical reasoning and analysis.' }
                                    ].map(chip => (
                                       <button
                                          key={chip.label}
                                          onClick={() => handleQuickEdit(chip.prompt)}
                                          className="text-[10px] font-bold px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-all shadow-sm"
                                       >
                                          {chip.label}
                                       </button>
                                    ))}
                                 </div>

                                 {/* Attachment chips */}
                                 {sidebarAttachments.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                       {sidebarAttachments.map((att, idx) => (
                                          <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-violet-50 border border-violet-200 rounded-lg text-[10px] text-violet-700 font-medium">
                                             <PaperclipIcon className="w-3 h-3" />
                                             <span className="truncate max-w-[120px]">{att.name}</span>
                                             <button onClick={() => setSidebarAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-violet-400 hover:text-red-500">
                                                <XIcon className="w-3 h-3" />
                                             </button>
                                          </div>
                                       ))}
                                    </div>
                                 )}

                                 {/* Input */}
                                 <form onSubmit={handleSidebarSubmit} className="relative">
                                    <input
                                       type="file"
                                       ref={sidebarFileInputRef}
                                       className="hidden"
                                       accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                                       multiple
                                       onChange={async (e) => {
                                          const fileList = e.target.files;
                                          if (!fileList) return;
                                          for (let fi = 0; fi < fileList.length; fi++) {
                                             const file = fileList[fi];
                                             const attachment: SidebarAttachment = { file, name: file.name, type: file.type };
                                             if (file.type === 'application/pdf') {
                                                try {
                                                   const arrayBuffer = await file.arrayBuffer();
                                                   const pdfjsLib = await import('pdfjs-dist');
                                                   const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                                                   let text = '';
                                                   for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
                                                      const page = await pdf.getPage(i);
                                                      const content = await page.getTextContent();
                                                      text += (content.items as any[]).map((item: any) => item.str).join(' ') + '\n';
                                                      if (text.length > 12000) break;
                                                   }
                                                   attachment.extractedText = text.slice(0, 12000);
                                                } catch (err) {
                                                   console.warn('PDF text extraction failed for attachment:', err);
                                                }
                                             } else if (file.type.startsWith('image/')) {
                                                const reader = new FileReader();
                                                attachment.preview = await new Promise<string>((resolve) => {
                                                   reader.onload = () => resolve(reader.result as string);
                                                   reader.readAsDataURL(file);
                                                });
                                             }
                                             setSidebarAttachments(prev => [...prev, attachment]);
                                          }
                                          e.target.value = '';
                                       }}
                                    />
                                    <button
                                       type="button"
                                       onClick={() => sidebarFileInputRef.current?.click()}
                                       className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-violet-600 transition-colors"
                                       title="Attach file"
                                    >
                                       <PaperclipIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                       className="w-full pl-8 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all shadow-sm"
                                       placeholder={selectedEditorText ? "Describe how to rewrite the selection..." : "Ask Claude or describe an edit..."}
                                       value={sidebarInput}
                                       onChange={(e) => setSidebarInput(e.target.value)}
                                       disabled={sidebarStreaming}
                                    />
                                    <button
                                       type="submit"
                                       disabled={!sidebarInput.trim() || sidebarStreaming}
                                       className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 shadow-sm"
                                    >
                                       <ArrowRightIcon className="w-3.5 h-3.5" />
                                    </button>
                                 </form>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>

               </div>
            )}

            {/* === TAB: DEPOSITION STRATEGY === */}
            {activeTab === 'STRATEGY' && (
               <div className="h-full flex overflow-hidden">
                  {depoStage === 'ANALYSIS' ? (
                     <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                        <div className="max-w-6xl mx-auto">
                           <div className="flex justify-between items-start mb-8">
                              <div>
                                 <h2 className="text-4xl font-extrabold tracking-[-0.02em] text-slate-900 leading-tight">Deposition Strategy</h2>
                                 <p className="text-slate-500 mt-2 max-w-2xl text-base font-medium">
                                    Detailed breakdown of opposing theories. Analyze the battlefield before simulating testimony.
                                 </p>
                              </div>
                              <button
                                 onClick={handleRunStrategy}
                                 disabled={isGenerating}
                                 className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-bold text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center gap-2.5 disabled:opacity-50"
                              >
                                 {isGenerating ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                                 {strategyData ? 'Refresh Analysis' : 'Run Strategy Analysis'}
                              </button>
                           </div>

                           {isGenerating && (!strategyData || !strategyData.scenarios) ? (
                              <div className="py-8">
                                 <SkeletonLoader type="strategy" />
                              </div>
                           ) : !strategyData || !strategyData.scenarios ? (
                              <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
                                 <ShieldAlertIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                 <h3 className="text-lg font-bold text-slate-500">No Strategy Generated Yet</h3>
                                 <p className="text-slate-400 text-sm">Click the button above to analyze Plaintiff vs. Defense theories.</p>
                              </div>
                           ) : (
                              <div className="space-y-8 animate-in slide-in-from-bottom-4">
                                 {/* Overall Assessment (Matching Image) */}
                                 {strategyData.overallAssessment && (
                                    <div className="bg-slate-50/80 p-10 rounded-[2.5rem] border border-slate-200/60 shadow-sm mb-12">
                                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Executive Strategic Summary</h3>
                                       <p className="text-xl text-slate-800 leading-[1.8] font-serif font-medium">
                                          {strategyData.overallAssessment}
                                       </p>
                                    </div>
                                 )}

                                 {/* Scenarios List (Matching Image) */}
                                 <div className="space-y-10 pb-20">
                                    {strategyData.scenarios.map((scenario, i) => (
                                       <div key={i} className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 overflow-hidden">
                                          <div className="p-8 pb-4 flex justify-between items-center">
                                             <h3 className="text-2xl font-serif font-black text-slate-900">{scenario.title}</h3>
                                             <button
                                                onClick={() => handleStartDepo(scenario)}
                                                className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-6 py-2.5 rounded-xl hover:bg-black flex items-center gap-2 transition-all shadow-lg shadow-slate-200"
                                             >
                                                <TerminalIcon className="w-4 h-4" />
                                                {activeScenarioId === scenario.title && depoChats[scenario.title]?.length > 0
                                                   ? `Resume (${depoChats[scenario.title].length} msgs)`
                                                   : 'Simulate Cross-Exam'}
                                             </button>
                                          </div>

                                          <div className="p-8 pt-0 grid grid-cols-2 gap-8">
                                             <div className="space-y-6">
                                                <div>
                                                   <div className="flex items-center gap-2 mb-3 text-red-600">
                                                      <SwordsIcon className="w-3.5 h-3.5" />
                                                      <span className="font-black text-[10px] uppercase tracking-[0.15em]">Plaintiff's Theory</span>
                                                   </div>
                                                   <p className="text-sm text-slate-600 leading-relaxed font-medium">{scenario.plaintiffArgument}</p>
                                                </div>
                                                <div className="p-5 bg-red-50 rounded-2xl border border-red-100/50">
                                                   <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-2">Incoming Trap</p>
                                                   <p className="text-sm font-serif font-bold text-red-900 leading-relaxed italic pr-4">"{scenario.firstQuestion}"</p>
                                                </div>
                                             </div>

                                             <div className="space-y-6">
                                                <div>
                                                   <div className="flex items-center gap-2 mb-3 text-indigo-600">
                                                      <ShieldIcon className="w-3.5 h-3.5" />
                                                      <span className="font-black text-[10px] uppercase tracking-[0.15em]">Defense Strategy</span>
                                                   </div>
                                                   <p className="text-sm text-slate-600 leading-relaxed font-medium">{scenario.defenseArgument}</p>
                                                </div>
                                                <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                                                   <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-2">Recommended Pivot</p>
                                                   <p className="text-sm font-sans font-black text-indigo-900 leading-relaxed italic pr-4">"{scenario.idealAnswer}"</p>
                                                </div>
                                             </div>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>
                  ) : (
                     <DepositionSimulation
                        chatHistory={chatHistory}
                        isChatting={isChatting}
                        isListening={isListening}
                        chatInput={chatInput}
                        currentFeedback={currentFeedback}
                        onChatInputChange={setChatInput}
                        onMicClick={handleMicClick}
                        onSubmit={handleDepoSubmit}
                        onRetry={handleRetryAnswer}
                        onNext={handleProceedToNextQuestion}
                        onClearHistory={handleClearChatHistory}
                        onBackToAnalysis={() => {
                           setDepoStage('ANALYSIS');
                           setCurrentFeedback(null);
                        }}
                        chatScrollRef={chatScrollRef}
                     />
                  )}
               </div>
            )}
         </div>

         {/* Version History Modal */}
         {showVersionHistory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
               <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                     <div>
                        <h3 className="text-2xl font-serif font-black text-slate-900">Version History</h3>
                        <p className="text-sm text-slate-500 mt-1">View and restore previous drafts</p>
                     </div>
                     <button
                        onClick={() => setShowVersionHistory(false)}
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                     >
                        <XIcon className="w-5 h-5" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                     {(caseItem.draftVersions || []).length === 0 ? (
                        <div className="text-center py-12">
                           <ClockIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                           <p className="text-slate-500">No version history yet</p>
                           <p className="text-xs text-slate-400 mt-1">Versions are created when you generate or finalize drafts</p>
                        </div>
                     ) : (
                        <div className="space-y-3">
                           {[...(caseItem.draftVersions || [])].reverse().map((version, idx) => (
                              <div
                                 key={version.id}
                                 className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all group"
                              >
                                 <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                       <div className="flex items-center gap-2 mb-1">
                                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${version.status === 'finalized' ? 'bg-emerald-100 text-emerald-700' :
                                             version.status === 'generated' ? 'bg-indigo-100 text-indigo-700' :
                                                'bg-slate-200 text-slate-700'
                                             }`}>
                                             {version.status.toUpperCase()}
                                          </span>
                                          <span className="text-xs text-slate-500 font-medium">
                                             {new Date(version.date).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}
                                          </span>
                                       </div>
                                       <p className="text-sm font-bold text-slate-700">{version.label}</p>
                                       <p className="text-xs text-slate-500">By {version.author}</p>
                                       <p className="text-xs text-slate-400 mt-1">
                                          {version.content.substring(0, 100)}...
                                       </p>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                       <button
                                          onClick={() => handleRestoreVersion(version)}
                                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                                       >
                                          Restore
                                       </button>
                                       <button
                                          onClick={() => {
                                             if (!confirm('Delete this version? This cannot be undone.')) return;
                                             const updated = (caseItem.draftVersions || []).filter(v => v.id !== version.id);
                                             onUpdateCase({ ...caseItemRef.current, draftVersions: updated });
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                          title="Delete version"
                                       >
                                          <Trash2Icon className="w-3.5 h-3.5" />
                                       </button>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-slate-50">
                     <p className="text-xs text-slate-500 text-center">
                        Last {(caseItem.draftVersions || []).length} versions • Max 20 versions stored
                     </p>
                  </div>
               </div>
            </div>
         )}

         {/* Export Modal */}
         {showExportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
               <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center justify-between mb-6">
                     <div>
                        <h3 className="text-2xl font-serif font-black text-slate-900">Export Report</h3>
                        <p className="text-sm text-slate-500 mt-1">Choose your preferred format to download</p>
                     </div>
                     <button
                        onClick={() => setShowExportModal(false)}
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                     >
                        <XIcon className="w-5 h-5" />
                     </button>
                  </div>

                  <div className="space-y-3">
                     {/* PDF Export */}
                     <button
                        onClick={() => {
                           exportAsPDF();
                           setShowExportModal(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 border border-red-200 rounded-2xl transition-all group"
                     >
                        <div className="p-3 bg-red-500 text-white rounded-xl group-hover:scale-110 transition-transform">
                           <FileTextIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 text-left">
                           <h4 className="font-bold text-slate-900">Export as PDF</h4>
                           <p className="text-xs text-slate-600">Print-ready document format</p>
                        </div>
                        <ArrowRightIcon className="w-5 h-5 text-red-600" />
                     </button>

                     {/* Word Export */}
                     <button
                        onClick={() => {
                           exportAsWord();
                           setShowExportModal(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-200 rounded-2xl transition-all group"
                     >
                        <div className="p-3 bg-blue-500 text-white rounded-xl group-hover:scale-110 transition-transform">
                           <FileTextIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 text-left">
                           <h4 className="font-bold text-slate-900">Export as Word</h4>
                           <p className="text-xs text-slate-600">Editable .doc format</p>
                        </div>
                        <ArrowRightIcon className="w-5 h-5 text-blue-600" />
                     </button>

                     {/* Text Export */}
                     <button
                        onClick={() => {
                           exportAsText();
                           setShowExportModal(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 border border-slate-200 rounded-2xl transition-all group"
                     >
                        <div className="p-3 bg-slate-500 text-white rounded-xl group-hover:scale-110 transition-transform">
                           <FileTextIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 text-left">
                           <h4 className="font-bold text-slate-900">Export as Text</h4>
                           <p className="text-xs text-slate-600">Plain text .txt file</p>
                        </div>
                        <ArrowRightIcon className="w-5 h-5 text-slate-600" />
                     </button>

                     {/* Copy to Clipboard */}
                     <button
                        onClick={() => {
                           copyReportToClipboard();
                           setShowExportModal(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border border-emerald-200 rounded-2xl transition-all group"
                     >
                        <div className="p-3 bg-emerald-500 text-white rounded-xl group-hover:scale-110 transition-transform">
                           <CopyIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 text-left">
                           <h4 className="font-bold text-slate-900">Copy to Clipboard</h4>
                           <p className="text-xs text-slate-600">Quick copy for pasting elsewhere</p>
                        </div>
                        <ArrowRightIcon className="w-5 h-5 text-emerald-600" />
                     </button>
                  </div>

                  <button
                     onClick={() => setShowExportModal(false)}
                     className="w-full mt-6 py-3 text-slate-500 hover:text-slate-700 font-semibold text-sm transition-colors"
                  >
                     Cancel
                  </button>
               </div>
            </div>
         )}
      </div >
   );
};
