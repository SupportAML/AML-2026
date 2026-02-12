
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import * as Diff from 'diff';
import { parse } from 'marked';
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
  MoreHorizontalIcon
} from 'lucide-react';
import { Case, Document, Annotation, UserProfile, ChatMessage, ReportComment, Suggestion, StrategyAnalysis, StructuredChronology, DepoFeedback, ChronologyEvent, ResearchArticle, ResearchGap } from '../types';
import { DepositionSimulation } from './DepositionSimulation';
import { ClinicalDocumentPreview } from './ClinicalDocumentPreview';
import PreviewPanel from './PreviewPanel';
import WriterCommentSidebar from './WriterCommentSidebar';
import { VoiceInputButton } from './VoiceInputButton';
import {
   draftMedicalLegalReport,
   runFullCaseStrategy,
   chatWithDepositionCoach,
   cleanupChronology,
   suggestReportEdit,
   searchMedicalResearch,
   analyzeReportForResearchGaps,
   insertSmartCitation,
   extractFactsFromNotes,
   rewordClinicalNotes,
   finalizeLegalReport
} from '../services/claudeService';

interface AnnotationRollupProps {
   caseItem: Case;
   docs: Document[];
   annotations: Annotation[];
   onBack: () => void;
   googleAccessToken: string | null;
   onUpdateCase: (c: Case) => void;
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

interface EditorSuggestion {
   id: string;
   original: string;
   proposed: string;
   explanation: string;
   diff: Diff.Change[];
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
   const historyTimerRef = useRef<NodeJS.Timeout | null>(null);
   const [strategyData, setStrategyData] = useState<StrategyAnalysis | null>(caseItem.strategyData || null);
   const [chronologyData, setChronologyData] = useState<StructuredChronology | null>(caseItem.chronologyData || null);

   const DEFAULT_TEMPLATE = `1. HEADER: Case name, date, and expert identification.\n2. INTRODUCTION: Brief case overview and purpose of the report.\n3. DOCUMENTS REVIEWED: Detailed list of all materials examined.\n4. PATIENT HISTORY & TIMELINE: Chronological clinical summary.\n5. MEDICAL ANALYSIS: Clinical findings, standard of care, and causation.\n6. PROFESSIONAL OPINION: Final conclusions and recommendations.`;

   const [reportTemplate, setReportTemplate] = useState<string>(caseItem.reportTemplate || DEFAULT_TEMPLATE);
   const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
   const [writerViewMode, setWriterViewMode] = useState<'EDIT' | 'FINAL'>('EDIT');
   const [showExportModal, setShowExportModal] = useState(false);
   const [showVersionHistory, setShowVersionHistory] = useState(false);

   // --- UI State ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
   const [additionalContext, setAdditionalContext] = useState(caseItem.additionalContext || '');
   const moreButtonRef = useRef<HTMLButtonElement | null>(null);
   const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);

   // Writer State
   const [writerSidebarMode, setWriterSidebarMode] = useState<'COMMENTS' | 'AI'>('COMMENTS');
   const [selectedTextForComment, setSelectedTextForComment] = useState('');
   const [commentInput, setCommentInput] = useState('');

   // AI Editor State
   const [editorHistory, setEditorHistory] = useState<{ role: 'user' | 'model', text: string, suggestion?: EditorSuggestion }[]>([]);
   const [editorInput, setEditorInput] = useState('');
   const [editorViewMode, setEditorViewMode] = useState<'PREVIEW' | 'EDIT' | 'SPLIT'>('EDIT');

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
   const researchScrollRef = useRef<HTMLDivElement>(null);
 
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
      setEditorInput(prompt);
      // We don't auto-submit so the user can see what's happening or add to it
   };

   // Research State
   const [researchQuery, setResearchQuery] = useState('');
   // Research State - Initialize from case data if available
   const [researchResults, setResearchResults] = useState<ResearchArticle[]>(caseItem.researchResults || []);
   const [researchGaps, setResearchGaps] = useState<{ topic: string; reason: string }[]>(caseItem.researchGaps || []);
   const [activeCitationProposal, setActiveCitationProposal] = useState<EditorSuggestion | null>(null);

 

   // Manual Source Link State
   const [linkingEventId, setLinkingEventId] = useState<string | null>(null);
   const [linkSourceFileId, setLinkSourceFileId] = useState<string>('');
   const [linkSourcePage, setLinkSourcePage] = useState<number>(1);

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

   const [annotationSearchQuery, setAnnotationSearchQuery] = useState('');

   // Chronology UI State
   const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

   // --- Derived State: Live Chronology & Facts ---
   const liveChronology = useMemo(() => {
      const base: StructuredChronology = chronologyData ? JSON.parse(JSON.stringify(chronologyData)) : { years: [], irrelevantFacts: [] };
      const existingIds = new Set<string>();

      // Index existing
      base.years.forEach(y => y.months.forEach(m => m.events.forEach(e => existingIds.add(e.id))));
      base.irrelevantFacts.forEach(f => existingIds.add(f.id));

      // Add new annotations dynamically if they have a date and aren't already processed
      annotations.forEach(ann => {
         if (existingIds.has(ann.id)) return;
         if (!ann.eventDate) return;

         const date = new Date(ann.eventDate);
         if (isNaN(date.getTime())) return;

         const yearStr = date.getFullYear().toString();
         const monthStr = date.toLocaleString('default', { month: 'long' });

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
   }, [chronologyData, annotations]);

   // --- Track previous values to detect real changes ---
   const prevDepoChatsRef = useRef<string>(JSON.stringify(caseItem.depoChats || {}));
   const prevDepoStageRef = useRef<string>(caseItem.depoStage || 'ANALYSIS');
   const prevScenarioIdRef = useRef<string | undefined>(caseItem.depoActiveScenario);

  // --- One-time cleanup of old depoChat field ---
  useEffect(() => {
      if ((caseItem as any).depoChat) {
         console.log('🔄 Migrating old depoChat field to new depoChats structure...');
         const { depoChat, ...cleanedCase } = caseItem as any;
         onUpdateCase({
            ...cleanedCase,
            depoChats,
            depoStage,
            depoActiveScenario: activeScenarioId
         });
      }
   }, []); // Run only once on mount

  // --- Immediate Persistence for Chat History (no debounce) ---
  useEffect(() => {
      const currentChatsStr = JSON.stringify(depoChats);
      
      if (currentChatsStr !== prevDepoChatsRef.current || 
          depoStage !== prevDepoStageRef.current ||
          activeScenarioId !== prevScenarioIdRef.current) {
         
         prevDepoChatsRef.current = currentChatsStr;
         prevDepoStageRef.current = depoStage;
         prevScenarioIdRef.current = activeScenarioId;
         
         console.log('💾 Persisting depo data:', {
            activeScenarioId,
            depoStage,
            chatCounts: Object.keys(depoChats).reduce((acc, key) => {
               acc[key] = depoChats[key].length;
               return acc;
            }, {} as Record<string, number>)
         });
         
         onUpdateCase({
            ...caseItem,
            depoChats,
            depoStage,
            depoActiveScenario: activeScenarioId
         });
      }
   }, [depoChats, depoStage, activeScenarioId, caseItem, onUpdateCase]);

   // --- Enhanced Persistence with All Tab States ---
   useEffect(() => {
      const timer = setTimeout(() => {
         // Only update if there are actual changes
         const hasChanges =
            reportContent !== caseItem.reportContent ||
            additionalContext !== caseItem.additionalContext ||
            JSON.stringify(strategyData) !== JSON.stringify(caseItem.strategyData) ||
            JSON.stringify(chronologyData) !== JSON.stringify(caseItem.chronologyData) ||
            JSON.stringify(researchResults) !== JSON.stringify(caseItem.researchResults) ||
            JSON.stringify(researchGaps) !== JSON.stringify(caseItem.researchGaps) ||
            reportTemplate !== caseItem.reportTemplate;

         if (hasChanges) {
            // console.log('💾 Persisting Clinical Workspace state...');
            onUpdateCase({
               ...caseItem,
               reportContent,
               strategyData: strategyData || undefined,
               chronologyData: chronologyData || undefined,
               additionalContext,
               researchResults,
              researchGaps,
              reportTemplate,
              // Preserve existing comments (depo data handled by dedicated useEffect)
              reportComments: caseItem.reportComments || []
           });
         }
      }, 1500); // Debounce for 1.5 seconds
      return () => clearTimeout(timer);
   }, [reportContent, strategyData, chronologyData, additionalContext, researchResults, researchGaps, caseItem.reportComments, reportTemplate]);

   // --- Sync State from Case Data (when case changes externally) ---
   useEffect(() => {
      if (caseItem.researchResults && JSON.stringify(caseItem.researchResults) !== JSON.stringify(researchResults)) {
         setResearchResults(caseItem.researchResults);
      }
      if (caseItem.researchGaps && JSON.stringify(caseItem.researchGaps) !== JSON.stringify(researchGaps)) {
         setResearchGaps(caseItem.researchGaps);
      }
      
      const newChatsStr = JSON.stringify(caseItem.depoChats || {});
      if (newChatsStr !== prevDepoChatsRef.current) {
         console.log('🔄 Syncing depo chats from Firebase:', {
            chatCounts: Object.keys(caseItem.depoChats || {}).reduce((acc, key) => {
               acc[key] = (caseItem.depoChats![key] || []).length;
               return acc;
            }, {} as Record<string, number>)
         });
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
   }, [caseItem.id]);

   // --- Handlers: Source Navigation & Linking ---
   const handleJumpToSource = (annotationId: string) => {
      const ann = annotations.find(a => a.id === annotationId);
      if (ann) {
         // Don't show preview for manual notes (no PDF document)
         if (ann.documentId === 'manual-notes') {
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
            setPreviewSource({ documentId: foundEvent.sourceDocumentId, page: foundEvent.sourcePage || 1, annotationId });
            return;
         }
      }
      alert("Source location unavailable.");
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
      if (!linkingEventId || !chronologyData) return;
      const doc = docs.find(d => d.id === linkSourceFileId);
      const updateEvent = (ev: any) => {
         if (ev.id === linkingEventId) {
            return {
               ...ev,
               sourceDocumentId: linkSourceFileId,
               sourceDocumentName: doc?.name,
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
      setLinkingEventId(null);
   };

   const getEventSourceInfo = (eventId: string) => {
      // 1. Check annotations
      const ann = annotations.find(a => a.id === eventId);
      if (ann) {
         const doc = docs.find(d => d.id === ann.documentId);
         return { name: doc?.name || 'Unknown Document', page: ann.page, id: ann.documentId };
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
            return { name: found.sourceDocumentName || 'Linked Document', page: found.sourcePage || 1, id: found.sourceDocumentId };
         }
      }
      return null;
   };

   const handleCleanupChronology = async () => {
      if (!additionalContext.trim()) return;
      setIsGenerating(true);

      try {
         let localAnnotations = [...annotations];

         // 1. Extract discrete facts from manual notes and add them as local items for AI processing
         const extractedFacts = await extractFactsFromNotes(additionalContext);

         if (extractedFacts && extractedFacts.length > 0) {
            extractedFacts.forEach(fact => {
               // Check if this fact already exists to prevent duplicates (check against localAnnotations to catch in-session duplicates)
               const exists = localAnnotations.some(a => a.text === fact.text);
               if (!exists) {
                  const newId = Math.random().toString(36).substr(2, 9);
                  const newAnn: any = {
                     id: newId,
                     page: 1,
                     text: fact.text || '',
                     category: fact.category || 'Observation',
                     x: 0, y: 0,
                     author: currentUser.name,
                     eventDate: fact.eventDate || undefined,
                     documentId: 'manual-notes',
                     timestamp: new Date().toLocaleString(),
                     type: 'point'
                  };

                  // Persist to parent
                  onAddAnnotation(1, newAnn.text, newAnn.category, 0, 0, 'point', undefined, undefined, undefined, currentUser.name, newAnn.eventDate, undefined, 'manual-notes');

                  // Add to our local list for the next AI step
                  localAnnotations.push(newAnn);
               }
            });
         }

         // 2. Run the chronology cleanup with the complete (original + newly extracted) list
         const result = await cleanupChronology(localAnnotations, additionalContext);
         if (result) {
            setChronologyData(result);
            setActiveTab('CHRONOLOGY');
         }
      } catch (error) {
         console.error("Failed to extract to timeline:", error);
         alert("Failed to process timeline extraction. Please try again.");
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

   const insertSourceRef = (docName: string) => {
      const ref = `\n(["${docName}", p. 1])\n`;
      setAdditionalContext(prev => prev + (prev.endsWith('\n') ? '' : '\n') + ref);
   };

   // --- Handlers: Voice Input ---
   const handleVoiceTranscriptionFactsNotes = (text: string) => {
      // In 'append' mode, VoiceInputButton only sends finalized phrases
      // We just need to append them to the existing content with proper spacing
      setAdditionalContext(prev => {
         if (!prev) return text;
         // Add space or newline before the new text
         const separator = prev.endsWith('\n') || prev.endsWith(' ') ? '' : ' ';
         return prev + separator + text;
      });
   };

   const handleVoiceTranscriptionWriter = (text: string) => {
      // Insert voice text at cursor position instead of appending to end
      setReportContent(prev => {
         if (!prev) return text;
         
         // Get cursor position from ref (updated on click/keyup)
         const cursorPos = cursorPositionRef.current;
         
         // Split content at cursor position
         const before = prev.substring(0, cursorPos);
         const after = prev.substring(cursorPos);
         
         // Determine separator: add space if needed before insertion
         const needsSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
         const needsSpaceAfter = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n');
         
         const separator = needsSpaceBefore ? ' ' : '';
         const separatorAfter = needsSpaceAfter ? ' ' : '';
         
         // Insert voice text at cursor with proper spacing
         const newContent = before + separator + text + separatorAfter + after;
         
         // Update cursor position to after inserted text
         const newCursorPos = before.length + separator.length + text.length + separatorAfter.length;
         cursorPositionRef.current = newCursorPos;
         
         // Restore cursor position in textarea after React updates
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
      const results = await searchMedicalResearch(topic, reportContent);
      setResearchResults(results);
      setIsGenerating(false);
   };

   const handleSmartCite = async (article: ResearchArticle) => {
      setIsGenerating(true);
      const result = await insertSmartCitation(reportContent, article);

      const diff = Diff.diffWords(reportContent, result.newContent);
      setActiveCitationProposal({
         id: Date.now().toString(),
         original: reportContent,
         proposed: result.newContent,
         explanation: result.explanation,
         diff
      });
      setIsGenerating(false);
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
      const results = await searchMedicalResearch(researchQuery, reportContent);
      setResearchResults(results);
      setIsGenerating(false);
   };

   const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Citation copied to clipboard");
   };

   // --- Handlers: Writer (AI Editor) ---
   const handleEditorSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editorInput.trim()) return;

      const userText = editorInput;
      setEditorInput('');
      setEditorHistory(prev => [...prev, { role: 'user', text: userText }]);
      setIsGenerating(true);

      const result = await suggestReportEdit(reportContent, userText);
      const diff = Diff.diffWords(reportContent, result.newContent);

      const suggestion: EditorSuggestion = {
         id: Date.now().toString(),
         original: reportContent,
         proposed: result.newContent,
         explanation: result.explanation,
         diff: diff
      };

      setEditorHistory(prev => [...prev, { role: 'model', text: result.explanation, suggestion }]);
      setIsGenerating(false);
   };

   const handleApplySuggestion = (suggestion: EditorSuggestion) => {
      // Push current state to undo stack before applying suggestion
      setUndoStack(prev => [...prev, reportContent].slice(-50));
      setRedoStack([]);
      setReportContent(suggestion.proposed);
      lastContentRef.current = suggestion.proposed;
      setEditorHistory(prev => prev.map(item =>
         item.suggestion?.id === suggestion.id
            ? { ...item, text: "Change applied successfully.", suggestion: undefined }
            : item
      ));
   };

   // --- Handlers: Writer (Comments) ---
   const handleTextSelect = () => {
      if (textareaRef.current) {
         const start = textareaRef.current.selectionStart;
         const end = textareaRef.current.selectionEnd;
         if (start !== end) {
            const selected = reportContent.substring(start, end);
            setSelectedTextForComment(selected);
            setWriterSidebarMode('COMMENTS');
         }
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
      if (!textareaRef.current || !context) return;
      const index = reportContent.indexOf(context);
      if (index !== -1) {
         // Switch to edit mode to ensure we can focus
         setEditorViewMode('SPLIT');
         textareaRef.current.focus();
         textareaRef.current.setSelectionRange(index, index + context.length);
         // Scroll logic
         const lineHeight = 24; // approx
         const lines = reportContent.substring(0, index).split('\n').length;
         textareaRef.current.scrollTop = lines * lineHeight - 100;
         textareaRef.current.blur();
         textareaRef.current.focus();
      } else {
         alert("Text not found in current document version.");
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

   const handleFinalizeReport = async () => {
      if (!reportContent.trim()) return;
      setIsGenerating(true);
      try {
         // Push current state to undo stack before finalizing
         setUndoStack(prev => [...prev, reportContent].slice(-50));
         setRedoStack([]);
         
         const finalized = await finalizeLegalReport(reportContent);
         
         // Create version snapshot
         const newVersion = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            content: finalized,
            status: 'finalized' as const,
            author: currentUser.name,
            label: 'Finalized Draft'
         };
         
         // Update case with new version
         onUpdateCase({
            ...caseItem,
            reportContent: finalized,
            draftVersions: [...(caseItem.draftVersions || []), newVersion].slice(-20) // Keep last 20 versions
         });
         
         setReportContent(finalized);
         lastContentRef.current = finalized;
         setWriterViewMode('FINAL');
         // Show export modal after finalizing
         setShowExportModal(true);
      } catch (error) {
         console.error("Failed to finalize report:", error);
         alert("Failed to finalize report. Please try again.");
      } finally {
         setIsGenerating(false);
      }
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
      /* US Legal Document Format - Letter size with 1 inch margins */
      @page { 
         size: letter;
         margin: 1in; 
      }
      
      body {
         font-family: 'Times New Roman', 'Liberation Serif', Times, serif;
         font-size: 12pt;
         line-height: 2.0;  /* Double-spaced as per legal standards */
         color: #000;
         margin: 0;
         padding: 0;
         background: white;
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
      
      /* Paragraph styles - justified text, minimal spacing */
      p { 
         margin: 0; 
         text-align: justify;
         orphans: 3;
         widows: 3;
      }
      
      /* Preserve formatting for structured content */
      pre { 
         white-space: pre-wrap; 
         font-family: 'Times New Roman', 'Liberation Serif', Times, serif;
         font-size: 12pt;
         line-height: 2.0;
         margin: 0;
      }
      
      /* List spacing */
      ul, ol {
         margin: 6pt 0;
      }
      
      li {
         margin: 3pt 0;
      }
   </style>
</head>
<body>
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
         
         // Create HTML content for Word
         const htmlContent = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
   <meta charset="UTF-8">
   <title>${caseItem.title} - Medical-Legal Report</title>
   <style>
      body {
         font-family: 'Times New Roman', Times, serif;
         font-size: 12pt;
         line-height: 1.8;
      }
      h1, h2, h3 { font-weight: bold; }
      p { margin: 12px 0; text-align: justify; }
      pre { white-space: pre-wrap; font-family: inherit; }
   </style>
</head>
<body>
   <pre>${reportContent}</pre>
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

   const handleRestoreVersion = (version: any) => {
      if (window.confirm(`Restore this version from ${new Date(version.date).toLocaleString()}? Current draft will be saved as a version.`)) {
         // Save current as a version before restoring
         const currentVersion = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            content: reportContent,
            status: 'draft' as const,
            author: currentUser.name,
            label: 'Saved before restore'
         };
         
         onUpdateCase({
            ...caseItem,
            reportContent: version.content,
            draftVersions: [...(caseItem.draftVersions || []), currentVersion].slice(-20)
         });
         
         setReportContent(version.content);
         setShowVersionHistory(false);
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
      const s = await runFullCaseStrategy(reportContent || caseItem.description);
      if (s) setStrategyData(s);
      setIsGenerating(false);
   };

   const handleStartDepo = (scenario: any) => {
      const scenarioId = scenario.title;
      const existingChat = depoChats[scenarioId];
      
      console.log('🎯 Starting deposition for:', scenarioId);
      console.log('   Existing chat messages:', existingChat?.length || 0);
      console.log('   All chats:', Object.keys(depoChats));
      
      setActiveScenarioId(scenarioId);
      setDepoStage('SIMULATION');
      setCurrentFeedback(null);
      
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
               
               /* Print styles for PDF export - US Legal Document Format */
               @media print {
                  @page {
                     size: letter;
                     margin: 1in;
                  }
                  
                  body {
                     font-family: 'Times New Roman', 'Liberation Serif', 'Nimbus Roman', Times, serif;
                     font-size: 12pt;
                     line-height: 2;
                     color: #000;
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
                        <div className="flex justify-between items-center mb-10">
                           <div>
                              <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-slate-900 leading-tight">Medical Chronology</h2>
                              <p className="text-slate-500 text-sm mt-1">AI-structured timeline. Automatically incorporates new dated annotations.</p>
                           </div>
                           <button onClick={handleCleanupChronology} disabled={isGenerating} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50">
                              {isGenerating ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                              Organize Timeline
                           </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-12 pb-20 no-scrollbar">
                           {(!liveChronology || (liveChronology.years.length === 0 && liveChronology.irrelevantFacts.length === 0)) ? (
                              <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
                                 <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                 <p className="text-slate-400 font-bold mb-1">Timeline is empty.</p>
                                 <p className="text-xs text-slate-400">Add dated annotations to documents or click "Clean & Structure".</p>
                              </div>
                           ) : (
                              <>
                                 {/* Medical Fact Matrix (Matching Image) */}
                                 <div className="mb-12">
                                    <div className="flex items-center gap-3 mb-6 p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                                       <div className="p-2 bg-white rounded-lg shadow-sm">
                                          <StethoscopeIcon className="w-5 h-5 text-amber-600" />
                                       </div>
                                       <div>
                                          <h3 className="font-bold text-amber-900 text-base">Medical Fact Matrix</h3>
                                          <p className="text-xs text-amber-700/70 font-medium">General medical context and undated facts extracted from notes.</p>
                                       </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       {liveChronology.irrelevantFacts.length === 0 ? (
                                          <p className="col-span-2 text-center py-8 text-slate-300 text-xs italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">No undated facts identified.</p>
                                       ) : (
                                          liveChronology.irrelevantFacts.map((fact, idx) => (
                                             <div
                                                key={idx}
                                                onClick={() => handleJumpToSource(fact.id)}
                                                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group relative cursor-pointer"
                                             >
                                                <p className="text-sm text-slate-700 leading-relaxed font-medium pr-6">{fact.formattedText}</p>
                                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                   <button onClick={(e) => { e.stopPropagation(); handleOpenLinkModal(fact.id); }} className="text-slate-300 hover:text-indigo-600"><LinkIcon className="w-3.5 h-3.5" /></button>
                                                </div>
                                             </div>
                                          ))
                                       )}
                                    </div>
                                 </div>

                                 {/* Timeline Stream - Clean Design */}
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
                                                                     onClick={() => handleJumpToSource(ev.id)}
                                                                     className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
                                                                  >
                                                                     <div className="flex justify-between items-start mb-2">
                                                                        <p className="text-sm font-bold text-indigo-600">
                                                                           {ev.date}
                                                                        </p>
                                                                        {src && (
                                                                           <button
                                                                              onClick={(e) => { e.stopPropagation(); handleJumpToSource(ev.id); }}
                                                                              className="text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                                                                           >
                                                                              View Source →
                                                                           </button>
                                                                        )}
                                                                     </div>
                                                                     <p className="text-sm text-slate-700 leading-relaxed">
                                                                        {ev.formattedText}
                                                                     </p>
                                                                     {src && (
                                                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                                                           <p className="text-xs text-slate-400">
                                                                              {src.name} • Page {src.page}
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
                              onNavigateToSource(previewSource.documentId, previewSource.page);
                              setPreviewSource(null);
                           }}
                        />
                     );
                  })()}
               </div>
            )}

            {/* === TAB: FACTS & NOTES === */}
            {activeTab === 'FACTS' && (
               <div className="h-full flex overflow-hidden bg-slate-100/50">
                  {/* Left: User Notes Input */}
                  <div className="w-1/2 p-8 border-r border-slate-200 overflow-y-auto flex flex-col">
                     <div className="flex justify-between items-center mb-6">
                        <div>
                           <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-slate-900">Case Notes</h2>
                           <p className="text-slate-500 text-sm">Enter clinical observations and manual events here.</p>
                        </div>
                        <div className="flex gap-2">
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
                        </div>
                     </div>

                     {/* Notes Toolbar */}
                     <div className="bg-white rounded-t-2xl border border-slate-200 border-b-0 p-2 flex items-center gap-1">
                        <button onClick={() => setAdditionalContext(prev => prev + (prev.endsWith('\n') ? '' : '\n') + '# Annotations\n')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-indigo-600" title="Add Main Header"><FileTextIcon className="w-4 h-4" /></button>
                        <button onClick={insertTimestamp} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-indigo-600" title="Insert Timestamp"><CalendarIcon className="w-4 h-4" /></button>

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
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mr-2">Link Source:</span>
                        <div className="flex gap-1 overflow-x-auto max-w-[200px] no-scrollbar">
                           {docs.slice(0, 3).map(d => (
                              <button
                                 key={d.id}
                                 onClick={() => insertSourceRef(d.name)}
                                 className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 whitespace-nowrap transition-colors"
                              >
                                 {d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="flex-1 bg-white rounded-b-2xl border border-slate-200 p-6 shadow-sm relative group overflow-hidden">
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-slate-100/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <textarea
                           className="w-full h-full bg-transparent border-none outline-none resize-none text-slate-800 leading-loose text-base font-medium placeholder:text-slate-300 font-serif"
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
                              onNavigateToSource(previewSource.documentId, previewSource.page);
                              setPreviewSource(null);
                           }}
                        />
                     );
                  })()}
                  {!previewSource && (
                     <div className="w-1/2 p-8 overflow-y-auto bg-slate-50 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-600 rounded-lg shadow-md">
                                 <MessageSquareIcon className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                 <h2 className="text-xl font-extrabold tracking-[-0.02em] text-slate-900">Timeline Feed</h2>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live Feed from Case Files</p>
                              </div>
                           </div>
                           <div className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-[10px] text-slate-400 font-bold">{annotations.length}</div>
                        </div>

                        {/* Search Bar for Feed */}
                        <div className="relative mb-6">
                           <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                              <SearchIcon className="h-3.5 w-3.5 text-slate-400" />
                           </div>
                           <input
                              type="text"
                              className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                              placeholder="Filter by keyword, date, or category..."
                              value={annotationSearchQuery}
                              onChange={(e) => setAnnotationSearchQuery(e.target.value)}
                           />
                        </div>

                        {annotations.length === 0 ? (
                           <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
                              <StickyNoteIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                              <p className="text-slate-400 font-medium">No annotations added yet.</p>
                              <p className="text-xs text-slate-300 mt-2">Annotate files to populate the fact matrix.</p>
                           </div>
                        ) : (
                           <div className="space-y-4">
                              {annotations
                                 .filter(ann => {
                                    if (!annotationSearchQuery) return true;
                                    const query = annotationSearchQuery.toLowerCase();
                                    return ann.text.toLowerCase().includes(query) ||
                                       ann.category.toLowerCase().includes(query) ||
                                       (ann.eventDate && ann.eventDate.toLowerCase().includes(query)) ||
                                       ann.author.toLowerCase().includes(query);
                                 })
                                 .sort((a, b) => {
                                    const getTime = (ann: Annotation) => {
                                       if (!ann.eventDate) return 0;
                                       return new Date(`${ann.eventDate}T${ann.eventTime || '00:00'}`).getTime();
                                    };
                                    return getTime(b) - getTime(a);
                                 })
                                 .map((ann) => (
                                    <div
                                       key={ann.id}
                                       onClick={() => handleJumpToSource(ann.id)}
                                       className="group p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all relative cursor-pointer"
                                    >
                                       <div className="flex justify-between items-start mb-2">
                                          <div className="flex items-center gap-2">
                                             {ann.eventDate ? (
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded font-mono flex items-center gap-1">
                                                   {ann.eventDate}
                                                   {ann.eventTime && <span className="opacity-75 border-l border-indigo-200 pl-1 ml-1">{ann.eventTime}</span>}
                                                </span>
                                             ) : (
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">UNDATED</span>
                                             )}
                                             <span className="text-[10px] font-bold text-slate-500 uppercase">{ann.category}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                             {ann.documentId !== 'manual-notes' && (
                                                <button
                                                   title="Jump to Document"
                                                   onClick={(e) => { e.stopPropagation(); handleJumpToSource(ann.id); }}
                                                   className="text-slate-300 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                                                >
                                                   <ArrowRightIcon className="w-4 h-4" />
                                                </button>
                                             )}
                                          </div>
                                       </div>
                                       <p className="text-sm text-slate-700 leading-relaxed font-medium">"{ann.text}"</p>
                                       <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400">
                                          <div className="flex items-center gap-2">
                                             <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] text-indigo-600 font-bold">{ann.author.charAt(0)}</div>
                                             <span>{ann.author}</span>
                                             <span className="text-slate-300 mx-0.5">•</span>
                                             <span className="font-semibold text-indigo-600/70 truncate max-w-[120px]">
                                                {docs.find(d => d.id === ann.documentId)?.name || (ann.documentId === 'manual-notes' ? 'Case Notes' : 'Source File')}
                                             </span>
                                          </div>

                                          {/* Hover Actions */}
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                             <button
                                                onClick={(e) => { e.stopPropagation(); handleUpdateAnnotation(ann); }}
                                                className="p-1 px-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md font-bold flex items-center gap-1 shadow-sm border border-indigo-100"
                                             >
                                                <PencilIcon className="w-2.5 h-2.5" />
                                                Edit
                                             </button>
                                             <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteAnnotation(ann.id); }}
                                                className="p-1 px-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-md font-bold flex items-center"
                                             >
                                                <Trash2Icon className="w-2.5 h-2.5" />
                                             </button>
                                          </div>

                                          <span>{ann.documentId === 'manual-notes' ? 'Manual Note' : `Page ${ann.page}`}</span>
                                       </div>
                                    </div>
                                 ))}
                           </div>
                        )}
                     </div>
                  )}
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
                        <div ref={researchSearchRef} className="relative mb-12 max-w-5xl">
                           <div className="relative flex items-center bg-white border border-slate-200 rounded-[1.5rem] shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all p-1.5 pr-2">
                              <SearchIcon className="ml-4 w-5 h-5 text-slate-400" />
                              <input
                                 className="flex-1 pl-3 pr-4 py-4 text-base focus:outline-none bg-transparent"
                                 placeholder="Search for guidelines, studies, or clinical standards..."
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

                        {/* Results List */}
                        <div className="space-y-6">
                           {researchResults.map((article, i) => (
                              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                 <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                       <h3 className="text-lg font-bold text-slate-800 text-emerald-800 hover:underline cursor-pointer" onClick={() => window.open(article.url, '_blank')}>
                                          {article.title} <ExternalLinkIcon className="w-3 h-3 inline ml-1 text-slate-400" />
                                       </h3>
                                       <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-wider mt-1 inline-block">{article.source}</span>
                                    </div>
                                    <button
                                       onClick={() => handleSmartCite(article)}
                                       disabled={isGenerating}
                                       className="ml-4 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 flex items-center gap-2 whitespace-nowrap"
                                    >
                                       <PenToolIcon className="w-4 h-4" /> Smart Cite
                                    </button>
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
                           {researchResults.length === 0 && !isGenerating && !researchGaps.length && (
                              <div className="text-center py-20 opacity-50">
                                 <BookOpenIcon className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                                 <p className="text-slate-500">Search for medical literature to support your case.</p>
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
                              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Single-Page Workspace</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="relative">
                              <button
                                 ref={(el) => moreButtonRef.current = el}
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

                           <button
                              onClick={async () => {
                                 setIsGenerating(true);
                                 try {
                                    // Push current state to undo stack before generating new report
                                    if (reportContent.trim()) {
                                       setUndoStack(prev => [...prev, reportContent].slice(-50));
                                       setRedoStack([]);
                                    }
                                    const generatedReport = await draftMedicalLegalReport(
                                       { ...caseItem, reportTemplate },
                                       docs,
                                       annotations,
                                       additionalContext,
                                       currentUser.qualifications
                                    );
                                    
                                    // Create version snapshot for AI-generated draft
                                    const newVersion = {
                                       id: Date.now().toString(),
                                       date: new Date().toISOString(),
                                       content: generatedReport,
                                       status: 'generated' as const,
                                       author: 'AI Assistant',
                                       label: 'AI Generated Draft'
                                    };
                                    
                                    // Update case with new version
                                    onUpdateCase({
                                       ...caseItem,
                                       reportContent: generatedReport,
                                       draftVersions: [...(caseItem.draftVersions || []), newVersion].slice(-20)
                                    });
                                    
                                    setReportContent(generatedReport);
                                    lastContentRef.current = generatedReport;
                                    setWriterViewMode('EDIT');
                                 } catch (error) {
                                    console.error("Failed to generate report:", error);
                                    alert("Failed to generate report. Please try again.");
                                 } finally {
                                    setIsGenerating(false);
                                 }
                              }}
                              disabled={isGenerating}
                              className="bg-indigo-600 text-white px-4 py-1.5 rounded-xl shadow-md shadow-indigo-100 hover:bg-indigo-700 font-bold flex items-center gap-2 text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                              {isGenerating ? (
                                 <>
                                    <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                                    Generating...
                                 </>
                              ) : (
                                 <>
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                    {reportContent ? 'Regenerate Draft' : 'Auto-Draft'}
                                 </>
                              )}
                           </button>

                           <button
                              onClick={handleFinalizeReport}
                              disabled={isGenerating || !reportContent}
                              className="bg-emerald-600 text-white px-4 py-1.5 rounded-xl shadow-md shadow-emerald-100 hover:bg-emerald-700 font-bold flex items-center gap-2 text-xs transition-all disabled:opacity-50"
                           >
                              <FileCheckIcon className="w-3.5 h-3.5" />
                              Finalize
                           </button>

                           <div className="h-4 w-px bg-slate-200 mx-1" />

                           <div className="flex bg-slate-100 p-1 rounded-xl">
                              <button
                                 onClick={() => setWriterViewMode('EDIT')}
                                 className={`p-1.5 rounded-lg transition-all ${writerViewMode === 'EDIT' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
                                 title="Edit Mode"
                              >
                                 <PencilIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                 onClick={() => setWriterViewMode('FINAL')}
                                 className={`p-1.5 rounded-lg transition-all ${writerViewMode === 'FINAL' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}
                                 title="Final Preview"
                              >
                                 <EyeIcon className="w-3.5 h-3.5" />
                              </button>
                           </div>

                           <div className="h-4 w-px bg-slate-200 mx-1" />

                           {/* Voice Input Button */}
                           <VoiceInputButton
                              isActive={isVoiceActiveWriter}
                              onToggle={() => {
                                 // When activating voice, capture current cursor position
                                 // When deactivating, no action needed
                                 if (!isVoiceActiveWriter) {
                                    // Capture cursor position from textarea
                                    if (textareaRef.current) {
                                       cursorPositionRef.current = textareaRef.current.selectionStart;
                                    }
                                 }
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

                     {/* Scrollable Content Area */}
                     <div className="flex-1 overflow-y-auto">
                        <div className="min-h-full py-8 px-4 md:py-12 md:px-8 flex justify-center">
                           {/* The Page Container - Unified Editable Workspace */}
                           <div className="w-full max-w-[8.5in] min-h-[11in] bg-white shadow-lg border border-slate-200 flex flex-col transition-all relative group">
                              {writerViewMode === 'EDIT' ? (
                                 <textarea
                                    ref={textareaRef}
                                    className="w-full min-h-[11in] resize-none outline-none px-[1in] py-[1in] bg-transparent font-serif text-[12pt] leading-[2] text-slate-900"
                                    style={{ fontFamily: "'Times New Roman', 'Liberation Serif', 'Nimbus Roman', Times, serif" }}
                                    value={reportContent}
                                    onChange={(e) => {
                                       const newContent = e.target.value;
                                       setReportContent(newContent);
                                       pushToUndoStack(newContent);
                                    }}
                                    onSelect={handleTextSelect}
                                    onClick={(e) => {
                                       // Track cursor position for voice input
                                       const target = e.target as HTMLTextAreaElement;
                                       cursorPositionRef.current = target.selectionStart;
                                    }}
                                    onKeyDown={(e) => {
                                       // Handle Ctrl+Z (Undo) and Ctrl+Y (Redo)
                                       if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                                          e.preventDefault();
                                          handleUndo();
                                       } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                                          e.preventDefault();
                                          handleRedo();
                                       }
                                    }}
                                    onKeyUp={(e) => {
                                       // Track cursor position as user types or moves cursor
                                       const target = e.target as HTMLTextAreaElement;
                                       cursorPositionRef.current = target.selectionStart;
                                    }}
                                    placeholder={isVoiceActiveWriter ? "🎤 Listening... Speak to dictate your report" : "Start typing your professional medical-legal report here..."}
                                 />
                              ) : (
                                 <div
                                    className="w-full min-h-[11in] px-[1in] py-[1in] bg-transparent font-serif text-[12pt] leading-[2] text-slate-900 prose prose-slate max-w-none prose-headings:font-serif prose-headings:font-bold prose-p:my-0"
                                    style={{ fontFamily: "'Times New Roman', 'Liberation Serif', 'Nimbus Roman', Times, serif" }}
                                    dangerouslySetInnerHTML={{ __html: parse(reportContent) }}
                                 />
                              )}
                              {isGenerating && (
                                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                                    <p className="text-sm font-serif italic text-indigo-600 font-bold">Synthesizing clinical evidence...</p>
                                 </div>
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

                        {/* MODE: AI ASSISTANT */}
                        {writerSidebarMode === 'AI' && (
                           <>
                              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center">
                                 <BrainCircuitIcon className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                                 <p className="text-xs text-emerald-800 font-bold">AI Editing Partner</p>
                                 <p className="text-[10px] text-emerald-600">I can rewrite, rephrase, or critique your draft.</p>
                              </div>

                              {editorHistory.map((msg, idx) => (
                                 <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    {msg.role === 'user' ? (
                                       <div className="bg-emerald-600 text-white px-3 py-2 rounded-2xl rounded-br-none text-xs max-w-[90%] mb-2">
                                          {msg.text}
                                       </div>
                                    ) : (
                                       <div className="w-full mb-4">
                                          {/* Suggestion Card */}
                                          {msg.suggestion ? (
                                             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full">
                                                <div className="bg-slate-50 p-2 border-b border-slate-100 flex justify-between items-center">
                                                   <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Proposed Change</span>
                                                   <span className="text-[10px] font-bold text-emerald-600">{msg.suggestion.explanation}</span>
                                                </div>
                                                <div className="p-3 text-[10px] font-mono bg-slate-50/50 max-h-60 overflow-y-auto">
                                                   {msg.suggestion.diff.map((part, i) => (
                                                      <span
                                                         key={i}
                                                         className={
                                                            part.added ? 'bg-green-100 text-green-800 decoration-clone' :
                                                               part.removed ? 'bg-red-100 text-red-800 line-through decoration-clone' : 'text-slate-500'
                                                         }
                                                      >
                                                         {part.value}
                                                      </span>
                                                   ))}
                                                </div>
                                                <div className="p-2 border-t border-slate-100 flex gap-2">
                                                   <button
                                                      onClick={() => handleApplySuggestion(msg.suggestion!)}
                                                      className="flex-1 bg-emerald-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"
                                                   >
                                                      <CheckIcon className="w-3 h-3" /> Approve
                                                   </button>
                                                </div>
                                             </div>
                                          ) : (
                                             <div className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-2xl rounded-bl-none text-xs shadow-sm">
                                                {msg.text}
                                             </div>
                                          )}
                                       </div>
                                    )}
                                 </div>
                              ))}

                              {isGenerating && (
                                 <div className="flex items-center gap-2 text-slate-400 text-xs">
                                    <Loader2Icon className="w-3 h-3 animate-spin" /> Thinking...
                                 </div>
                              )}

                              {/* AI Input Area */}
                              <div className="pt-2 sticky bottom-0 bg-slate-50 space-y-3">
                                 <div className="flex flex-wrap gap-2 px-1">
                                    {[
                                       { label: 'Authoritative', prompt: 'Make the tone more authoritative and expert-driven.' },
                                       { label: 'Concise', prompt: 'Make this section more concise and clinically direct.' },
                                       { label: 'Critique', prompt: 'Critique this draft for any clinical inconsistencies or weak logic.' },
                                       { label: 'Summarize', prompt: 'Summarize the core clinical findings in this section.' }
                                    ].map(chip => (
                                       <button
                                          key={chip.label}
                                          onClick={() => handleQuickEdit(chip.prompt)}
                                          className="text-[10px] font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-full text-slate-500 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm"
                                       >
                                          {chip.label}
                                       </button>
                                    ))}
                                 </div>
                                 <form onSubmit={handleEditorSubmit} className="relative">
                                    <input
                                       className="w-full pl-3 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                                       placeholder="e.g. 'Make tone more authoritative'"
                                       value={editorInput}
                                       onChange={(e) => setEditorInput(e.target.value)}
                                       disabled={isGenerating}
                                    />
                                    <button
                                       type="submit"
                                       disabled={!editorInput.trim() || isGenerating}
                                       className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                                    >
                                       <ArrowRightIcon className="w-4 h-4" />
                                    </button>
                                 </form>
                              </div>
                           </>
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

                           {!strategyData || !strategyData.scenarios ? (
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
                           <p className="text-xs text-slate-400 mt-1">Versions are created when you regenerate or finalize drafts</p>
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
                                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                             version.status === 'finalized' ? 'bg-emerald-100 text-emerald-700' :
                                             version.status === 'generated' ? 'bg-indigo-100 text-indigo-700' :
                                             'bg-slate-200 text-slate-700'
                                          }`}>
                                             {version.status.toUpperCase()}
                                          </span>
                                          <span className="text-xs text-slate-500 font-medium">
                                             {new Date(version.date).toLocaleString()}
                                          </span>
                                       </div>
                                       <p className="text-sm font-bold text-slate-700">{version.label}</p>
                                       <p className="text-xs text-slate-500">By {version.author}</p>
                                       <p className="text-xs text-slate-400 mt-1">
                                          {version.content.substring(0, 100)}...
                                       </p>
                                    </div>
                                    <button
                                       onClick={() => handleRestoreVersion(version)}
                                       className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                       Restore
                                    </button>
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
