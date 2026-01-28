
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
   ChevronRightIcon
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
   formatClinicalNotes
} from '../services/geminiService';

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
   const [strategyData, setStrategyData] = useState<StrategyAnalysis | null>(caseItem.strategyData || null);
   const [chronologyData, setChronologyData] = useState<StructuredChronology | null>(caseItem.chronologyData || null);

   // --- UI State ---
   const [isGenerating, setIsGenerating] = useState(false);
   const [additionalContext, setAdditionalContext] = useState(caseItem.additionalContext || '');

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

   const textareaRef = useRef<HTMLTextAreaElement>(null);

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

   // Strategy/Depo State
   const [depoStage, setDepoStage] = useState<'ANALYSIS' | 'SIMULATION'>('ANALYSIS');
   const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
   const [chatInput, setChatInput] = useState('');
   const [isChatting, setIsChatting] = useState(false);
   const [isListening, setIsListening] = useState(false);
   const [currentFeedback, setCurrentFeedback] = useState<DepoFeedback | null>(null);
   const chatScrollRef = useRef<HTMLDivElement>(null);

   const [annotationSearchQuery, setAnnotationSearchQuery] = useState('');

   // Chronology UI State
   const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

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
            JSON.stringify(caseItem.reportComments) !== JSON.stringify(caseItem.reportComments);

         if (hasChanges) {
            console.log('💾 Persisting Clinical Workspace state...');
            onUpdateCase({
               ...caseItem,
               reportContent,
               strategyData: strategyData || undefined,
               chronologyData: chronologyData || undefined,
               additionalContext,
               researchResults,
               researchGaps,
               // Preserve existing comments
               reportComments: caseItem.reportComments || []
            });
         }
      }, 1500); // Debounce for 1.5 seconds
      return () => clearTimeout(timer);
   }, [reportContent, strategyData, chronologyData, additionalContext, researchResults, researchGaps, caseItem.reportComments]);

   // --- Sync State from Case Data (when case changes externally) ---
   useEffect(() => {
      // Update local state if case data has been modified externally
      if (caseItem.researchResults && JSON.stringify(caseItem.researchResults) !== JSON.stringify(researchResults)) {
         console.log('🔄 Syncing research results from case data...');
         setResearchResults(caseItem.researchResults);
      }
      if (caseItem.researchGaps && JSON.stringify(caseItem.researchGaps) !== JSON.stringify(researchGaps)) {
         console.log('🔄 Syncing research gaps from case data...');
         setResearchGaps(caseItem.researchGaps);
      }
   }, [caseItem.id]); // Only run when case ID changes (switching cases)

   // --- Handlers: Source Navigation & Linking ---
   const handleJumpToSource = (annotationId: string) => {
      const ann = annotations.find(a => a.id === annotationId);
      if (ann) {
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
               // Check if this fact already exists to prevent duplicates
               const exists = annotations.some(a => a.text === fact.text);
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

   const handleFormatNotes = async () => {
      if (!additionalContext.trim()) return;
      setIsGenerating(true);
      try {
         const reformatted = await formatClinicalNotes(additionalContext, caseItem.title);
         setAdditionalContext(reformatted);
      } catch (error) {
         console.error("Failed to format notes:", error);
         alert("Failed to reformat notes. Please try again.");
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
      // For Legal Writer in 'continuous' mode, replace the entire content
      // This allows real-time preview of the full dictation
      setReportContent(text);
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
         setReportContent(activeCitationProposal.proposed);
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
      setReportContent(suggestion.proposed);
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
      setDepoStage('SIMULATION');
      setCurrentFeedback(null);
      setChatHistory([{
         id: 'init', role: 'model', text: scenario.firstQuestion, timestamp: Date.now()
      }]);
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
      if (!chatInput.trim()) return;

      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput, timestamp: Date.now() };
      const historyWithUser = [...chatHistory, userMsg];
      setChatHistory(historyWithUser);
      setChatInput('');
      setIsChatting(true);
      setCurrentFeedback(null);

      const result = await chatWithDepositionCoach(historyWithUser, userMsg.text, reportContent || caseItem.description);

      const historyWithFeedback = historyWithUser.map(msg =>
         msg.id === userMsg.id ? { ...msg, coaching: result.coaching } : msg
      );
      setChatHistory(historyWithFeedback);
      setCurrentFeedback(result.coaching);

      setIsChatting(false);
   };

   const handleProceedToNextQuestion = async () => {
      setIsChatting(true);
      setCurrentFeedback(null);
      const result = await chatWithDepositionCoach(chatHistory, "Proceed", reportContent || "");
      setChatHistory(prev => [...prev, {
         id: Date.now().toString(),
         role: 'model',
         text: result.nextQuestion,
         timestamp: Date.now()
      }]);
      setIsChatting(false);
   };

   const handleRetryAnswer = () => {
      setChatHistory(prev => prev.slice(0, -1));
      setCurrentFeedback(null);
      setChatInput(chatHistory[chatHistory.length - 1]?.text || "");
      setChatInput("");
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

         {/* Navbar */}
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
                                                const isExpanded = expandedMonths.has(monthKey);

                                                return (
                                                   <div key={m.month} className="border-l-2 border-slate-200 pl-8">
                                                      {/* Month Toggle */}
                                                      <button
                                                         onClick={() => {
                                                            const newSet = new Set(expandedMonths);
                                                            isExpanded ? newSet.delete(monthKey) : newSet.add(monthKey);
                                                            setExpandedMonths(newSet);
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
                  {previewSource && (
                     <PreviewPanel
                        doc={docs.find(d => d.id === previewSource.documentId)!}
                        page={previewSource.page}
                        annotations={annotations.filter(a => a.documentId === previewSource.documentId)}
                        highlightAnnotationId={previewSource.annotationId}
                        onClose={() => setPreviewSource(null)}
                        onOpenFullView={() => {
                           onNavigateToSource(previewSource.documentId, previewSource.page);
                           setPreviewSource(null);
                        }}
                     />
                  )}
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
                              onClick={handleFormatNotes}
                              disabled={isGenerating || !additionalContext.trim()}
                              className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-md shadow-indigo-100 transition-all disabled:opacity-50"
                           >
                              {isGenerating ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <SparklesIcon className="w-3 h-3" />}
                              AI Log Format
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
                        />
                     </div>
                  </div>

                  {/* Right: Live Evidence Feed OR Preview Panel */}
                  {previewSource ? (
                     <PreviewPanel
                        doc={docs.find(d => d.id === previewSource.documentId)!}
                        page={previewSource.page}
                        annotations={annotations.filter(a => a.documentId === previewSource.documentId)}
                        highlightAnnotationId={previewSource.annotationId}
                        onClose={() => setPreviewSource(null)}
                        onOpenFullView={() => {
                           onNavigateToSource(previewSource.documentId, previewSource.page);
                           setPreviewSource(null);
                        }}
                     />
                  ) : (
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
                                 .sort((a, b) => (b.eventDate ? new Date(b.eventDate).getTime() : 0) - (a.eventDate ? new Date(a.eventDate).getTime() : 0))
                                 .map((ann, i) => (
                                    <div
                                       key={i}
                                       onClick={() => handleJumpToSource(ann.id)}
                                       className="group p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all relative cursor-pointer"
                                    >
                                       <div className="flex justify-between items-start mb-2">
                                          <div className="flex items-center gap-2">
                                             {ann.eventDate ? (
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded font-mono">{ann.eventDate}</span>
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

                  <div className="flex-1 overflow-auto p-10 max-w-7xl mx-auto w-full no-scrollbar">
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
                     <div className="relative mb-12 max-w-5xl">
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
            )}

            {/* === TAB: WRITER (Google Docs Workflow) === */}
            {activeTab === 'WRITER' && (
               <div className="h-full flex overflow-hidden bg-slate-100/50">
                  {/* Left: Document Workspace */}
                  <div className="flex-1 overflow-y-auto p-12 flex flex-col items-center">
                     {/* Floating Action Bar (Top of Workspace) */}
                     <div className="w-[8.5in] mb-6 flex justify-between items-center bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-slate-200 shadow-sm shrink-0">
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
                           <button
                              onClick={async () => {
                                 setIsGenerating(true);
                                 try {
                                    const generatedReport = await draftMedicalLegalReport(
                                       caseItem,
                                       docs,
                                       annotations,
                                       additionalContext,
                                       currentUser.qualifications
                                    );
                                    setReportContent(generatedReport);
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
                           <div className="h-4 w-px bg-slate-200 mx-1" />

                           {/* Voice Input Button */}
                           <VoiceInputButton
                              isActive={isVoiceActiveWriter}
                              onToggle={() => setIsVoiceActiveWriter(!isVoiceActiveWriter)}
                              onTranscription={handleVoiceTranscriptionWriter}
                              size="md"
                              mode="continuous"
                           />

                           {isVoiceActiveWriter && (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl border border-red-100 animate-in fade-in slide-in-from-left-2 duration-300">
                                 <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                                 <span className="text-[10px] font-black uppercase tracking-widest">Voice Active</span>
                              </div>
                           )}

                           <div className="h-4 w-px bg-slate-200 mx-1" />
                           <button className="text-slate-400 hover:text-indigo-600 p-2"><CopyIcon className="w-4 h-4" /></button>
                           <button className="text-slate-400 hover:text-indigo-600 p-2"><ArchiveIcon className="w-4 h-4" /></button>
                        </div>
                     </div>

                     {/* The Page Container - Unified Editable Workspace */}
                     <div className="w-[8.5in] min-h-[8in] bg-white shadow-2xl shadow-slate-200/50 rounded-sm border border-slate-200 flex flex-col transition-all relative group mb-20 overflow-hidden">
                        <textarea
                           ref={textareaRef}
                           className="flex-1 resize-none outline-none p-12 w-full h-full bg-transparent font-serif text-lg leading-[2] text-slate-800"
                           value={reportContent}
                           onChange={(e) => setReportContent(e.target.value)}
                           onSelect={handleTextSelect}
                           placeholder={isVoiceActiveWriter ? "🎤 Listening... Speak to dictate your report" : "Start typing your professional medical-legal report here..."}
                        />
                        {isGenerating && (
                           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
                              <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                              <p className="text-sm font-serif italic text-indigo-600 font-bold">Synthesizing clinical evidence...</p>
                           </div>
                        )}

                        {/* Page Indicators */}
                        <div className="absolute -left-12 top-20 flex flex-col gap-4">
                           <div className="w-1.5 h-32 bg-indigo-100 rounded-full group-hover:bg-indigo-200 transition-colors" />
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
                                                <TerminalIcon className="w-4 h-4" /> Simulate Cross-Exam
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
                        chatScrollRef={chatScrollRef}
                     />
                  )}
               </div>
            )}
         </div>
      </div>
   );
};
