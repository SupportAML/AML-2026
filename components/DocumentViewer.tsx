
import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquareIcon,
  XIcon,
  Loader2Icon,
  ZoomInIcon,
  ZoomOutIcon,
  MousePointer2Icon,
  MicIcon,
  AlertCircleIcon,
  PanelRightIcon,
  SparklesIcon,
  TerminalIcon,
  PencilIcon,
  Trash2Icon,
  FileTextIcon,
  ChevronDownIcon,
  CheckIcon,
  LayoutListIcon,
  SquareIcon
} from 'lucide-react';
import { Document as DocType, Annotation } from '../types';
import { processAnnotationInput } from '../services/geminiService';
import { VoiceTranscriptionOverlay } from './VoiceTranscriptionOverlay';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;

interface DocumentViewerProps {
  doc: DocType;
  annotations: Annotation[];
  onAddAnnotation: (page: number, text: string, category: string, x: number, y: number, type?: 'point' | 'highlight' | 'area' | 'voice', imageUrl?: string, width?: number, height?: number, author?: string, eventDate?: string, eventTime?: string) => void;
  onUpdateAnnotation: (annotation: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onBack: () => void;
  onOpenClinicalWorkspace?: () => void;
  googleAccessToken: string | null;
  initialPage?: number;
  focusedAnnotationId?: string | null;
  isEditingFocused?: boolean;
  onClearFocus?: () => void;
  onSetFocus?: (id: string) => void;
  allDocuments?: DocType[];
  onSwitchDocument?: (doc: DocType) => void;
}

const getAvatarColor = (name: string) => {
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const AnnotationPopup: React.FC<any> = ({
  x, y, height, activeCategory, pendingText, setPendingText,
  pendingAuthor, setPendingAuthor, pendingDate, setPendingDate,
  availableAuthors, onCycleCategory, onCancel, onCommit,
  getCategoryColor, activeTool, setActiveCategory
}) => {
  const [showAuthorMenu, setShowAuthorMenu] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  const handleRefine = async () => {
    if (!pendingText.trim()) return;
    setIsRefining(true);
    try {
      const result = await processAnnotationInput(pendingText);
      if (result.refinedText) setPendingText(result.refinedText);

      if (result.extractedDate) {
        // More robust date extraction: find anything that looks like a date and normalize to YYYY-MM-DD
        const dateMatch = result.extractedDate.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
        if (dateMatch) {
          const y = dateMatch[1];
          const m = dateMatch[2].padStart(2, '0');
          const d = dateMatch[3].padStart(2, '0');
          setPendingDate(`${y}-${m}-${d}`);
        } else {
          // Fallback for different formats
          const altMatch = result.extractedDate.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
          if (altMatch) {
            const y = altMatch[3];
            const m = altMatch[1].padStart(2, '0');
            const d = altMatch[2].padStart(2, '0');
            setPendingDate(`${y}-${m}-${d}`);
          }
        }
      }
      return result; // Return result for unified voice workflow
    } catch (err) {
      console.error("Refine error:", err);
      return null;
    } finally {
      setIsRefining(false);
    }
  };

  const handleVoiceConfirm = async () => {
    if (!pendingText.trim() || isRefining) return;

    setIsRefining(true);
    try {
      // 1. Refine with AI
      const result = await processAnnotationInput(pendingText);
      let finalDate = pendingDate;

      if (result.extractedDate) {
        const dateMatch = result.extractedDate.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
        if (dateMatch) {
          finalDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
        }
      }

      // 2. Commit directly with the refined values
      onCommit(result.refinedText || pendingText, finalDate);
    } catch (err) {
      console.error("Voice confirm error:", err);
      onCommit(); // Fallback to normal commit if AI fails
    } finally {
      setIsRefining(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (activeTool === 'VOICE') {
        handleVoiceConfirm();
      } else {
        onCommit();
      }
    }
  };

  const categories = ['Review', 'Medical', 'Legal', 'Urgent'];

  return (
    <div
      className="absolute z-40 w-80 bg-white rounded-2xl shadow-2xl border border-indigo-100 p-4 animate-in zoom-in-95 duration-150"
      style={{ left: `${x}%`, top: `${y + (height || 0)}%`, marginTop: '12px' }}
      onClick={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full shadow-sm animate-pulse ${getCategoryColor(activeCategory)}`} />
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="text-[10px] font-black text-slate-900 uppercase tracking-widest bg-transparent border-none focus:ring-0 cursor-pointer hover:text-indigo-600 transition-colors outline-none"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat} Annotation</option>
            ))}
          </select>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-full transition-colors"><XIcon className="w-4 h-4" /></button>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1 block ml-1">Author</label>
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 cursor-pointer text-[10px] font-bold text-slate-700 hover:border-indigo-200 transition-all" onClick={() => setShowAuthorMenu(!showAuthorMenu)}>
            <div className={`w-4 h-4 rounded-full mr-2 shrink-0 flex items-center justify-center text-[8px] text-white font-bold shadow-sm ${getAvatarColor(pendingAuthor)}`}>{pendingAuthor.charAt(0)}</div>
            <span className="flex-1 truncate">{pendingAuthor}</span>
          </div>
          {showAuthorMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
              {availableAuthors.map((author: string) => (
                <button key={author} className="w-full text-left px-3 py-2.5 text-[10px] font-medium hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-slate-50 last:border-0" onClick={() => { setPendingAuthor(author); setShowAuthorMenu(false); }}>{author}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col w-40 shrink-0">
          <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1 ml-1">Event Date</label>
          <input type="date" className="w-full text-[10px] border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-slate-600" value={pendingDate} onChange={e => setPendingDate(e.target.value)} />
        </div>
      </div>

      <div className="relative mb-4">
        {activeTool === 'VOICE' && (
          <div className="mb-3">
            <VoiceTranscriptionOverlay
              isActive={true}
              onTranscription={setPendingText}
            />
          </div>
        )}
        <textarea
          autoFocus
          placeholder={activeTool === 'VOICE' ? "Voice transcription appearing here..." : "Type your clinical observation..."}
          value={pendingText}
          onChange={e => setPendingText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[13px] h-28 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all leading-relaxed text-slate-700"
        />
        <button
          onClick={handleRefine}
          disabled={!pendingText.trim() || isRefining}
          title="Refine with AI"
          className="absolute right-2 bottom-2 p-2 rounded-xl bg-white border border-slate-200 text-indigo-600 hover:text-indigo-700 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
        >
          {isRefining ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onCancel}
          className="py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          disabled={!pendingText.trim() || isRefining}
          onClick={() => onCommit()}
          className="py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {isRefining && <Loader2Icon className="w-3 h-3 animate-spin" />}
          {isRefining ? 'Refining...' : 'Save Note'}
        </button>
      </div>
    </div>
  );
};

const PDFPage: React.FC<any> = ({
  pageNumber, pdfDoc, scale, annotations, onPageClick, activeTool, pendingAnnotation, isPendingOnThisPage, onCancelPending, onCommitPending,
  pendingText, setPendingText, pendingAuthor, setPendingAuthor, pendingDate, setPendingDate, availableAuthors, activeCategory, onCycleCategory, getCategoryColor, setActiveCategory,
  focusedAnnotationId, onEditExisting, onVisible
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(true);

  // Intersection observer for continuous scroll
  useEffect(() => {
    if (!onVisible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            onVisible(pageNumber);
          }
        });
      },
      { threshold: [0.1, 0.5, 0.9], rootMargin: '-10% 0px -10% 0px' }
    );

    if (wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }

    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  useEffect(() => {
    if (focusedAnnotationId && wrapperRef.current) {
      const activeAnn = annotations.find(a => a.id === focusedAnnotationId);
      if (activeAnn) {
        // Smooth scroll to the focused annotation
        const container = wrapperRef.current.closest('.overflow-auto');
        if (container) {
          const pageRect = wrapperRef.current.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const targetYInPage = (activeAnn.y / 100) * pageRect.height;

          const targetScrollTop = container.scrollTop + (pageRect.top - containerRect.top) + targetYInPage - (container.clientHeight / 2);

          container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        }
      }
    }
  }, [focusedAnnotationId, annotations]);

  useEffect(() => {
    let active = true;
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;
      setIsRendering(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        if (active) {
          await page.render({ canvasContext: context, viewport }).promise;
          const textContent = await page.getTextContent();
          textLayerRef.current.innerHTML = '';
          textLayerRef.current.style.height = `${viewport.height}px`;
          textLayerRef.current.style.width = `${viewport.width}px`;
          await (pdfjsLib as any).renderTextLayer({ textContentSource: textContent, container: textLayerRef.current, viewport }).promise;
          setIsRendering(false);
        }
      } catch (err) { console.error(err); }
    };
    renderPage();
    return () => { active = false; };
  }, [pdfDoc, pageNumber, scale]);

  const handleMouseUp = (e: React.MouseEvent) => {
    if (activeTool === 'POINT' || activeTool === 'VOICE') {
      const rect = wrapperRef.current!.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      onPageClick(pageNumber, x, y, activeTool === 'VOICE' ? 'voice' : 'point');
    }
  };

  return (
    <div id={`pdf-page-${pageNumber}`} ref={wrapperRef} className="relative bg-white shadow-lg mb-4 mx-auto" onMouseUp={handleMouseUp}>
      <canvas ref={canvasRef} className="block" />
      <div ref={textLayerRef} className="textLayer absolute inset-0" style={{ pointerEvents: activeTool === 'TEXT' ? 'auto' : 'none' }} />
      {isRendering && <div className="absolute inset-0 flex items-center justify-center bg-white/50"><Loader2Icon className="w-8 h-8 animate-spin text-indigo-400" /></div>}
      <div className="absolute inset-0 pointer-events-none">
        {annotations.map((ann: any) => {
          const isFocused = ann.id === focusedAnnotationId;
          return (
            <div
              key={ann.id}
              className={`absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 ${isFocused ? 'scale-150 z-20' : ''}`}
              style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
              onClick={(e) => { e.stopPropagation(); onEditExisting(ann); }}
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-md transition-all ${getCategoryColor(ann.category)} ${isFocused ? 'animate-annotation-bounce ring-4 ring-indigo-500/30' : ''}`} />
            </div>
          );
        })}
      </div>
      {isPendingOnThisPage && pendingAnnotation && (
        <AnnotationPopup x={pendingAnnotation.x} y={pendingAnnotation.y} activeCategory={activeCategory} pendingText={pendingText} setPendingText={setPendingText} pendingAuthor={pendingAuthor} setPendingAuthor={setPendingAuthor} pendingDate={pendingDate} setPendingDate={setPendingDate} availableAuthors={availableAuthors} onCycleCategory={onCycleCategory} onCancel={onCancelPending} onCommit={onCommitPending} getCategoryColor={getCategoryColor} activeTool={activeTool} setActiveCategory={setActiveCategory} />
      )}
    </div>
  );
};

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  doc, annotations, onAddAnnotation, onUpdateAnnotation, onDeleteAnnotation, onBack, onOpenClinicalWorkspace,
  googleAccessToken, initialPage = 1, focusedAnnotationId, isEditingFocused, onClearFocus, onSetFocus,
  allDocuments = [], onSwitchDocument
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.2);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [activeTool, setActiveTool] = useState<'POINT' | 'TEXT' | 'VOICE'>('POINT');
  const [activeCategory, setActiveCategory] = useState('Review');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; isCors: boolean } | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [isContinuous, setIsContinuous] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [pendingAnnotation, setPendingAnnotation] = useState<any>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const [pendingText, setPendingText] = useState('');
  const [pendingAuthor, setPendingAuthor] = useState('Dr. User');
  const [pendingDate, setPendingDate] = useState('');

  const jumpToPage = (targetPage: number, smooth = true) => {
    const page = Math.max(1, Math.min(numPages, targetPage));
    setCurrentPage(page);

    if (isContinuous && scrollRef.current) {
      const pageElement = document.getElementById(`pdf-page-${page}`);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      }
    }
  };

  const handlePageVisible = React.useCallback((pageNumber: number) => {
    if (isContinuous) {
      setCurrentPage(pageNumber);
    }
  }, [isContinuous]);

  // Sync with initialPage from prop for navigation jumps
  useEffect(() => {
    if (initialPage && initialPage !== currentPage) {
      if (isContinuous) {
        jumpToPage(initialPage, false);
      } else {
        setCurrentPage(initialPage);
      }
    }
  }, [initialPage, numPages]); // Added numPages to ensure we can jump once doc is loaded

  // Handle focused annotation from props
  useEffect(() => {
    if (focusedAnnotationId) {
      const ann = annotations.find(a => a.id === focusedAnnotationId);
      if (ann) {
        if (ann.page !== currentPage) {
          setCurrentPage(ann.page);
        }
        if (isEditingFocused) {
          handleStartEdit(ann);
        }
      }
    }
  }, [focusedAnnotationId, isEditingFocused, annotations]);

  useEffect(() => {
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(doc.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        const loadedPdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);
      } catch (err: any) {
        console.error("PDF Load Error:", err);
        const isCors = err.message === 'Failed to fetch' || err.message.includes('CORS');
        setError({
          message: isCors ? "Access Blocked by Storage Policy (CORS)" : (err.message || "Failed to load document."),
          isCors
        });
      } finally {
        setLoading(false);
      }
    };
    loadPdf();
  }, [doc.url]);

  const handleCommitPending = (manualText?: string, manualDate?: string) => {
    const textToUse = manualText !== undefined ? manualText : pendingText;
    const dateToUse = manualDate !== undefined ? manualDate : pendingDate;

    if (editingAnnotation) {
      onUpdateAnnotation({
        ...editingAnnotation,
        text: textToUse,
        category: activeCategory,
        author: pendingAuthor,
        eventDate: dateToUse
      });
      setEditingAnnotation(null);
      setPendingText('');
      setPendingDate('');
      onClearFocus?.();
    } else if (pendingAnnotation) {
      onAddAnnotation(
        pendingAnnotation.page,
        textToUse,
        activeCategory,
        pendingAnnotation.x,
        pendingAnnotation.y,
        pendingAnnotation.type,
        undefined,
        undefined,
        undefined,
        pendingAuthor,
        dateToUse,
        undefined
      );
      setPendingAnnotation(null);
      setPendingText('');
      setPendingDate('');
    }
  };

  const handleJumpToAndFocus = (ann: Annotation) => {
    if (ann.page !== currentPage) {
      setCurrentPage(ann.page);
    }
    // Set focus via internal state for immediate animation if already on page
    // or via parent prop if managed globally. But since we are inside DocumentViewer,
    // we can use a local 'focused' state if we want, but App.tsx also manages it.
    // To be safe, we call the parent's onNavigateToAnnotation if available,
    // or just handle it locally if we want to stay within the viewer.
    // Wait, DocumentViewer doesn't have an onNavigateToAnnotation prop, it has focusedAnnotationId.
    // So we should probably just use handleStartEdit or similar?
    // Actually, focusedAnnotationId comes from App.tsx.
    // To trigger the bounce and scroll, we need App.tsx to update that ID.
    // I should add a local setFocusedId for internal navigation within the same doc.
  };

  const handleFocusAnnotation = (ann: Annotation) => {
    if (ann.page !== currentPage) {
      setCurrentPage(ann.page);
    }
    setEditingAnnotation(null);
    setPendingAnnotation(null);
    setPendingText('');
    setPendingDate('');
    onSetFocus?.(ann.id);
  };

  const handleStartEdit = (ann: Annotation) => {
    if (ann.page !== currentPage) {
      setCurrentPage(ann.page);
    }
    setEditingAnnotation(ann);
    setPendingText(ann.text);
    setActiveCategory(ann.category);
    setPendingAuthor(ann.author);
    setPendingDate(ann.eventDate || '');
    setPendingAnnotation(null); // Clear any pending

    // Trigger global focus logic in App.tsx so PDFPage knows to bounce/scroll
    onSetFocus?.(ann.id);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Medical': return 'bg-red-500';
      case 'Legal': return 'bg-blue-500';
      case 'Review': return 'bg-amber-500';
      case 'Urgent': return 'bg-rose-500';
      default: return 'bg-slate-500';
    }
  };

  const cycleCategory = () => {
    const cats = ['Review', 'Medical', 'Legal', 'Urgent'];
    const idx = cats.indexOf(activeCategory);
    setActiveCategory(cats[(idx + 1) % cats.length]);
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-50 text-center">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
        <AlertCircleIcon className="w-10 h-10 text-red-500" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">{error.message}</h3>

      {error.isCors ? (
        <div className="max-w-md bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left mb-8">
          <p className="text-sm text-slate-600 mb-4 font-medium">To fix this, you must authorize your domain in your Firebase Storage bucket:</p>
          <div className="bg-slate-900 rounded-lg p-4 font-mono text-[11px] text-emerald-400 mb-4 overflow-x-auto">
            <p># 1. Create cors.json with origins ["*"]</p>
            <p># 2. Run in terminal:</p>
            <p>gsutil cors set cors.json gs://{doc.url.split('/b/')[1]?.split('/o/')[0] || 'your-bucket-name'}</p>
          </div>
          <p className="text-[10px] text-slate-400 italic">This is a standard security requirement for PDF viewers reading files from cloud storage.</p>
        </div>
      ) : (
        <p className="text-slate-600 max-w-md mb-8">An unexpected error occurred while fetching the case file.</p>
      )}

      <button onClick={onBack} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
        Return to Matter
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-100">
      <div className="h-14 bg-white border-b flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><ArrowLeftIcon className="w-5 h-5" /></button>

          {/* Document Switcher Dropdown */}
          {allDocuments.length > 0 && onSwitchDocument ? (
            <div className="relative">
              <button
                onClick={() => setShowDocMenu(!showDocMenu)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all group"
              >
                <FileTextIcon className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-700 text-sm max-w-[250px] truncate">
                  {doc.name}
                </span>
                <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${showDocMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showDocMenu && (
                <>
                  {/* Click-outside overlay */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDocMenu(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-[500px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="p-3 border-b bg-gradient-to-r from-indigo-50 to-slate-50 shrink-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-indigo-900 uppercase tracking-wider">
                          Case Documents
                        </p>
                        <span className="px-2 py-0.5 bg-white rounded-full text-[10px] font-bold text-slate-500 border border-slate-200">
                          {allDocuments.length}
                        </span>
                      </div>
                    </div>

                    {/* Document List */}
                    <div className="overflow-y-auto flex-1">
                      {allDocuments.map((document) => {
                        const docAnnotations = annotations.filter(a => a.documentId === document.id);
                        const isActive = document.id === doc.id;

                        return (
                          <button
                            key={document.id}
                            onClick={() => {
                              onSwitchDocument(document);
                              setShowDocMenu(false);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-all flex items-center gap-3 border-b border-slate-50 last:border-0 ${isActive ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'
                              }`}
                          >
                            <FileTextIcon className={`w-5 h-5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold truncate ${isActive ? 'text-indigo-700' : 'text-slate-700'}`}>
                                {document.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-400">
                                  {docAnnotations.length} {docAnnotations.length === 1 ? 'annotation' : 'annotations'}
                                </span>
                                {document.reviewStatus && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className={`text-[10px] font-bold uppercase ${document.reviewStatus === 'reviewed' ? 'text-green-600' :
                                      document.reviewStatus === 'in_review' ? 'text-amber-600' :
                                        'text-slate-400'
                                      }`}>
                                      {document.reviewStatus.replace('_', ' ')}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {isActive && (
                              <CheckIcon className="w-5 h-5 text-indigo-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <h2 className="font-bold text-slate-700 truncate max-w-[200px]">{doc.name}</h2>
          )}

          {onOpenClinicalWorkspace && (
            <button
              onClick={onOpenClinicalWorkspace}
              className="ml-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 flex items-center gap-2"
            >
              <SparklesIcon className="w-3.5 h-3.5" /> View Clinical Workspace
            </button>
          )}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setActiveTool('POINT')} className={`p-1.5 rounded ${activeTool === 'POINT' ? 'bg-white shadow' : 'text-slate-400'}`} title="Pointer Tool"><MousePointer2Icon className="w-4 h-4" /></button>
            <button onClick={() => setActiveTool('VOICE')} className={`p-1.5 rounded relative ${activeTool === 'VOICE' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-200'}`} title="Voice Annotation">
              <MicIcon className="w-4 h-4" />
              {activeTool === 'VOICE' && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
              )}
            </button>
          </div>

          {activeTool === 'VOICE' && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full border border-red-100 animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">Mic Ready</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setIsContinuous(!isContinuous)}
              className={`p-1.5 rounded transition-all ${isContinuous ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              title={isContinuous ? "Switch to Single Page" : "Switch to Continuous Scrolling"}
            >
              <LayoutListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsContinuous(!isContinuous)}
              className={`p-1.5 rounded transition-all ${!isContinuous ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              title={isContinuous ? "Switch to Single Page" : "Switch to Continuous Scrolling"}
            >
              <SquareIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border">
            <button onClick={() => jumpToPage(currentPage - 1)} disabled={currentPage <= 1} className="p-1 disabled:opacity-30"><ChevronLeftIcon className="w-4 h-4" /></button>
            <span className="text-xs font-bold px-2">{currentPage} / {numPages}</span>
            <button onClick={() => jumpToPage(currentPage + 1)} disabled={currentPage >= numPages} className="p-1 disabled:opacity-30"><ChevronRightIcon className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 text-slate-500 hover:text-indigo-600"><ZoomOutIcon className="w-4 h-4" /></button>
          <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-1.5 text-slate-500 hover:text-indigo-600"><ZoomInIcon className="w-4 h-4" /></button>
          <button onClick={() => setShowSidebar(!showSidebar)} className={`p-2 rounded-lg transition-colors ${showSidebar ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}><PanelRightIcon className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-auto p-8 bg-slate-200/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Loader2Icon className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
              <p className="font-serif italic text-slate-500">Decrypting & Loading Clinical Record...</p>
            </div>
          ) : (
            <div className={`max-w-4xl mx-auto pb-20 ${isContinuous ? 'space-y-8' : ''}`}>
              {isContinuous ? (
                Array.from({ length: numPages }, (_, i) => i + 1).map((pg) => (
                  <PDFPage
                    key={pg}
                    pageNumber={pg}
                    pdfDoc={pdfDoc}
                    scale={scale}
                    annotations={annotations.filter(a => a.page === pg)}
                    onPageClick={(p: any, x: any, y: any, t: any) => {
                      setPendingAnnotation({ page: p, x, y, type: t });
                      setEditingAnnotation(null);
                      setPendingText('');
                      setPendingDate('');
                      onClearFocus?.();
                    }}
                    activeTool={activeTool}
                    pendingAnnotation={pendingAnnotation || (editingAnnotation ? { x: editingAnnotation.x, y: editingAnnotation.y, page: editingAnnotation.page } : null)}
                    isPendingOnThisPage={pendingAnnotation?.page === pg || editingAnnotation?.page === pg}
                    onCancelPending={() => {
                      setPendingAnnotation(null);
                      setEditingAnnotation(null);
                      setPendingText('');
                      setPendingDate('');
                      onClearFocus?.();
                    }}
                    onCommitPending={handleCommitPending}
                    pendingText={pendingText}
                    setPendingText={setPendingText}
                    pendingAuthor={pendingAuthor}
                    setPendingAuthor={setPendingAuthor}
                    pendingDate={pendingDate}
                    setPendingDate={setPendingDate}
                    availableAuthors={['Dr. User']}
                    activeCategory={activeCategory}
                    onCycleCategory={cycleCategory}
                    getCategoryColor={getCategoryColor}
                    setActiveCategory={setActiveCategory}
                    focusedAnnotationId={focusedAnnotationId}
                    onEditExisting={handleFocusAnnotation}
                    onVisible={handlePageVisible}
                  />
                ))
              ) : (
                <PDFPage
                  pageNumber={currentPage}
                  pdfDoc={pdfDoc}
                  scale={scale}
                  annotations={annotations.filter(a => a.page === currentPage)}
                  onPageClick={(pg: any, x: any, y: any, t: any) => {
                    setPendingAnnotation({ page: pg, x, y, type: t });
                    setEditingAnnotation(null);
                    setPendingText('');
                    setPendingDate('');
                    onClearFocus?.();
                  }}
                  activeTool={activeTool}
                  pendingAnnotation={pendingAnnotation || (editingAnnotation ? { x: editingAnnotation.x, y: editingAnnotation.y, page: editingAnnotation.page } : null)}
                  isPendingOnThisPage={pendingAnnotation?.page === currentPage || editingAnnotation?.page === currentPage}
                  onCancelPending={() => {
                    setPendingAnnotation(null);
                    setEditingAnnotation(null);
                    setPendingText('');
                    setPendingDate('');
                    onClearFocus?.();
                  }}
                  onCommitPending={handleCommitPending}
                  pendingText={pendingText}
                  setPendingText={setPendingText}
                  pendingAuthor={pendingAuthor}
                  setPendingAuthor={setPendingAuthor}
                  pendingDate={pendingDate}
                  setPendingDate={setPendingDate}
                  availableAuthors={['Dr. User']}
                  activeCategory={activeCategory}
                  onCycleCategory={cycleCategory}
                  getCategoryColor={getCategoryColor}
                  setActiveCategory={setActiveCategory}
                  focusedAnnotationId={focusedAnnotationId}
                  onEditExisting={handleFocusAnnotation}
                  onVisible={handlePageVisible}
                />
              )}
            </div>
          )}
        </div>
        {showSidebar && (
          <div className="w-80 bg-white border-l flex flex-col shadow-xl animate-in slide-in-from-right-4 duration-300">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50 font-bold text-slate-700 text-sm">
              <div className="flex items-center">
                <MessageSquareIcon className="w-4 h-4 text-indigo-600 mr-2" /> Comments
              </div>
              <div className="flex items-center gap-2">
                {focusedAnnotationId && (
                  <button onClick={onClearFocus} className="text-[10px] text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-bold">Clear Focus</button>
                )}
                <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-[10px] text-slate-400">{annotations.length}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {annotations.length === 0 && (
                <div className="text-center py-10 opacity-30">
                  <MessageSquareIcon className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-xs">No comments yet</p>
                </div>
              )}
              {annotations.map(ann => (
                <div
                  key={ann.id}
                  onClick={() => handleFocusAnnotation(ann)}
                  className={`group p-3 bg-white rounded-xl border transition-all cursor-pointer hover:shadow-md relative ${focusedAnnotationId === ann.id ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-md' : 'border-slate-200 shadow-sm hover:border-indigo-200'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${getCategoryColor(ann.category)}`}>{ann.category}</span>
                    <span className="text-[9px] text-slate-400">Page {ann.page}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed mb-2">"{ann.text}"</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white font-bold ${getAvatarColor(ann.author)}`}>{ann.author.charAt(0)}</div>
                      <span>{ann.author}</span>
                    </div>
                    {/* Action Buttons - Shown on Hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartEdit(ann); }}
                        className="p-1 px-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md font-bold flex items-center gap-1 shadow-sm border border-indigo-100"
                      >
                        <PencilIcon className="w-2.5 h-2.5" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm('Delete this annotation?')) onDeleteAnnotation(ann.id); }}
                        className="p-1 px-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-md font-bold flex items-center"
                      >
                        <Trash2Icon className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    {!ann.eventDate && <span>{ann.timestamp.split(',')[0]}</span>}
                    {ann.eventDate && <span>{ann.eventDate}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;
