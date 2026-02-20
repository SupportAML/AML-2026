
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
  FileTextIcon,
  ChevronDownIcon,
  CheckIcon,
  LayoutListIcon,
  SquareIcon,
  Trash2Icon,
  HighlighterIcon,
  DownloadIcon,
  VideoIcon,
  ImageIcon,
  FileIcon,
  ScanIcon,
  ExternalLinkIcon
} from 'lucide-react';
import { Document as DocType, Annotation } from '../types';
import { processAnnotationInput } from '../services/claudeService';
import { pdfCacheManager } from '../services/pdfCacheManager';
import { VoiceTranscriptionOverlay } from './VoiceTranscriptionOverlay';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;

const ESTIMATED_PAGE_HEIGHT = 1100;
const PAGE_GAP = 8;
const VIRTUAL_WINDOW_SIZE = 5;
const INITIAL_RENDER_COUNT = 3;


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
  currentUser: { name: string; email: string };
}

const getAvatarColor = (name: string) => {
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// Format date from YYYY-MM-DD to "16/03/2026"
const formatDisplayDate = (dateStr?: string): string | null => {
  if (!dateStr) return null;
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
  } catch {
    return dateStr;
  }
};

const AnnotationPopup: React.FC<any> = ({
  x, y, height, activeCategory, pendingText, setPendingText,
  pendingAuthor, setPendingAuthor, pendingDate, setPendingDate,
  pendingTime, setPendingTime,
  availableAuthors, onCycleCategory, onCancel, onCommit,
  getCategoryColor, activeTool, setActiveCategory,
  detachPopup = false
}) => {
  const [showAuthorMenu, setShowAuthorMenu] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const lastEnterRef = useRef<number>(0);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVoiceConfirm = async () => {
    if (!pendingText.trim() || isRefining) return;

    setIsRefining(true);
    try {
      // 1. Refine with AI
      const result = await processAnnotationInput(pendingText);
      let finalText = result.refinedText || pendingText;
      let finalDate = pendingDate; // Only use if manually set
      let finalTime = pendingTime; // Only use if manually set

      // Only auto-extract date/time if user hasn't manually set them
      if (!pendingDate && result.extractedDate) {
        const dateMatch = result.extractedDate.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
        if (dateMatch) {
          finalDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
        }
      }

      if (!pendingTime && result.extractedTime) {
        const timeMatch = result.extractedTime.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          finalTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        }
      }

      // 2. Commit directly with the refined values
      onCommit(finalText, finalDate, finalTime);
    } catch (err) {
      console.error("Voice confirm error:", err);
      onCommit(); // Fallback to normal commit if AI fails
    } finally {
      setIsRefining(false);
    }
  };

  // AI Save helper - refine with AI then commit
  const doAiSave = async () => {
    if (!pendingText.trim() || isRefining) return;
    setIsRefining(true);
    try {
      const result = await processAnnotationInput(pendingText);
      let finalText = result.refinedText || pendingText;
      let finalDate = pendingDate;
      let finalTime = pendingTime;

      if (!pendingDate && result.extractedDate) {
        const dateMatch = result.extractedDate.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
        if (dateMatch) {
          finalDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
        }
      }
      if (!pendingTime && result.extractedTime) {
        const timeMatch = result.extractedTime.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          finalTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        }
      }
      onCommit(finalText, finalDate, finalTime);
    } catch (err) {
      console.error("AI refine error:", err);
      onCommit();
    } finally {
      setIsRefining(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!pendingText.trim() || isRefining) return;

      if (activeTool === 'VOICE') {
        handleVoiceConfirm();
        return;
      }

      const now = Date.now();
      const timeSinceLastEnter = now - lastEnterRef.current;
      lastEnterRef.current = now;

      // Double Enter (within 400ms) = Manual Save (no AI)
      if (timeSinceLastEnter < 400) {
        // Cancel the pending AI save timer
        if (enterTimerRef.current) {
          clearTimeout(enterTimerRef.current);
          enterTimerRef.current = null;
        }
        onCommit(); // Manual save immediately
        return;
      }

      // Single Enter = AI Save (with 400ms delay to detect double-enter)
      enterTimerRef.current = setTimeout(() => {
        enterTimerRef.current = null;
        doAiSave();
      }, 400);
    }
  };

  const categories = ['Review', 'Medical', 'Legal', 'Urgent'];

  // If detachPopup is false, render without absolute positioning (for sidebar)
  const isInSidebar = !detachPopup && x === 0 && y === 0;

  return (
    <div
      className={isInSidebar
        ? "w-full bg-white rounded-2xl shadow-lg border border-indigo-200 p-4 animate-in zoom-in-95 duration-150"
        : "absolute z-40 w-80 bg-white rounded-2xl shadow-2xl border border-indigo-100 p-4 animate-in zoom-in-95 duration-150"
      }
      style={isInSidebar ? {} : { left: `${x}%`, top: `${y + (height || 0)}%`, marginTop: '12px' }}
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
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex flex-col flex-1">
          <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1 ml-1">Event Date</label>
          <input type="date" className="w-full text-[10px] border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-slate-600" value={pendingDate} onChange={e => setPendingDate(e.target.value)} />
        </div>
        <div className="flex flex-col w-28 shrink-0">
          <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1 ml-1">Time</label>
          <input type="time" className="w-full text-[10px] border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-slate-600" value={pendingTime} onChange={e => setPendingTime(e.target.value)} />
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
        <div className="relative">
          <textarea
            autoFocus
            placeholder={activeTool === 'VOICE' ? "Voice transcription appearing here..." : "Type your clinical observation..."}
            value={pendingText}
            onChange={e => setPendingText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRefining}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[13px] h-28 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all leading-relaxed text-slate-700 disabled:opacity-50"
          />
          <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400 px-1">
            <span className="flex items-center gap-1">
              <SparklesIcon className="w-2.5 h-2.5" />
              Enter = AI Save
            </span>
            <span>2x Enter = Manual | Shift+Enter = New line</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {/* Manual Save - no AI processing */}
          <button
            disabled={!pendingText.trim() || isRefining}
            onClick={(e) => {
              e.preventDefault();
              onCommit();
            }}
            className="flex-1 py-2.5 bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 shadow-lg shadow-slate-100 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            Manual Save
          </button>
          {/* AI Save - with refinement and extraction */}
          <button
            disabled={!pendingText.trim() || isRefining}
            onClick={(e) => {
              e.preventDefault();
              doAiSave();
            }}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            {isRefining ? <><Loader2Icon className="w-3 h-3 animate-spin" /> Refining...</> : <><SparklesIcon className="w-3 h-3" /> AI Save</>}
          </button>
        </div>
        <button
          onClick={onCancel}
          className="py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const PDFPage: React.FC<any> = ({
  pageNumber, pdfDoc, scale, annotations, onPageClick, activeTool, pendingAnnotation, isPendingOnThisPage, onCancelPending, onCommitPending,
  pendingText, setPendingText, pendingAuthor, setPendingAuthor, pendingDate, setPendingDate, pendingTime, setPendingTime, availableAuthors, activeCategory, onCycleCategory, getCategoryColor, setActiveCategory,
  focusedAnnotationId, onEditExisting, onVisible, shouldRender = true, onTextHighlight
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Intersection observer for continuous scroll (simplified for performance)
  useEffect(() => {
    if (!onVisible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          onVisible(pageNumber, entry.intersectionRatio);
        });
      },
      { threshold: [0, 0.5, 1.0], rootMargin: '200px' }
    );

    if (wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }

    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  // Scroll to focused annotation
  useEffect(() => {
    if (focusedAnnotationId && wrapperRef.current) {
      const activeAnn = annotations.find((a: any) => a.id === focusedAnnotationId);
      if (activeAnn) {
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

  // Load dimensions initially (lightweight)
  useEffect(() => {
    let active = true;
    const loadDimensions = async () => {
      if (!pdfDoc) return;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        if (active) {
          setDimensions({ width: viewport.width, height: viewport.height });
        }
      } catch (err) {
        console.error(`Error loading dimensions for page ${pageNumber}:`, err);
      }
    };
    loadDimensions();
    return () => { active = false; };
  }, [pdfDoc, pageNumber, scale]);

  // Render canvas content (heavy)
  useEffect(() => {
    if (!shouldRender || !dimensions) return;

    let active = true;
    let renderTask: any = null;

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      setIsRendering(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!active || !canvasRef.current) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (!context || !active) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;

        if (active) setIsRendering(false);
      } catch (err: any) {
        if (active && err.name !== 'RenderingCancelledException') {
          console.error('Render error:', err);
          setIsRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      active = false;
      if (renderTask) renderTask.cancel();
    };
  }, [pdfDoc, pageNumber, scale, shouldRender, dimensions]);

  // Render text layer separately - only when TEXT (highlight) tool is active
  useEffect(() => {
    if (!shouldRender || !dimensions || !pdfDoc || !textLayerRef.current) return;

    if (activeTool !== 'TEXT') {
      textLayerRef.current.innerHTML = '';
      return;
    }

    let active = true;
    let textLayerTask: any = null;

    const renderText = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!active || !textLayerRef.current) return;

        const viewport = page.getViewport({ scale });
        const textContent = await page.getTextContent();
        if (!active || !textLayerRef.current) return;

        textLayerRef.current.innerHTML = '';

        textLayerTask = (pdfjsLib as any).renderTextLayer({
          textContentSource: textContent,
          container: textLayerRef.current,
          viewport
        });

        await textLayerTask.promise;
        console.log(`✅ Text layer rendered for page ${pageNumber} with ${textContent.items.length} items`);
      } catch (err: any) {
        if (active) {
          console.warn('Text layer render failed, building manually:', err.message);
          // Fallback: build text layer manually from text content items
          if (textLayerRef.current) {
            try {
              const page = await pdfDoc.getPage(pageNumber);
              const viewport = page.getViewport({ scale });
              const textContent = await page.getTextContent();
              if (!active || !textLayerRef.current) return;

              textLayerRef.current.innerHTML = '';

              for (const item of textContent.items as any[]) {
                if (!item.str || item.str.trim() === '') continue;

                const tx = (pdfjsLib as any).Util.transform(viewport.transform, item.transform);
                const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);

                const span = document.createElement('span');
                span.textContent = item.str;
                span.style.left = `${tx[4]}px`;
                span.style.top = `${tx[5] - fontHeight}px`;
                span.style.fontSize = `${fontHeight}px`;
                span.style.fontFamily = item.fontName ? `${item.fontName}, sans-serif` : 'sans-serif';

                if (item.width) {
                  span.style.width = `${item.width * scale}px`;
                  span.style.display = 'inline-block';
                }

                textLayerRef.current.appendChild(span);
              }
              console.log(`✅ Manual text layer built for page ${pageNumber}`);
            } catch (fallbackErr) {
              console.error('Manual text layer also failed:', fallbackErr);
            }
          }
        }
      }
    };

    renderText();

    return () => {
      active = false;
      if (textLayerTask?.cancel) textLayerTask.cancel();
    };
  }, [pdfDoc, pageNumber, scale, shouldRender, dimensions, activeTool]);

  const handleMouseUp = (e: React.MouseEvent) => {
    if (activeTool === 'TEXT' && dimensions) {
      // Use a micro-delay to ensure browser has finalized the selection
      const clientX = e.clientX;
      const clientY = e.clientY;
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        if (selectedText && selectedText.length > 0 && onTextHighlight && wrapperRef.current) {
          const rect = wrapperRef.current.getBoundingClientRect();
          const x = ((clientX - rect.left) / rect.width) * 100;
          const y = ((clientY - rect.top) / rect.height) * 100;
          onTextHighlight(pageNumber, selectedText, x, y);
          selection?.removeAllRanges();
        }
      }, 10);
      return;
    }
    if ((activeTool === 'POINT' || activeTool === 'VOICE') && dimensions) {
      const rect = wrapperRef.current!.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      onPageClick(pageNumber, x, y, activeTool === 'VOICE' ? 'voice' : 'point');
    }
  };

  if (!dimensions) {
    // Loading skeleton
    return (
      <div ref={wrapperRef} className="bg-slate-200 mx-auto animate-pulse rounded-sm" style={{ aspectRatio: '1/1.4', width: '100%', maxWidth: '800px', height: '800px', marginBottom: `${PAGE_GAP}px` }} />
    );
  }

  return (
    <div
      id={`pdf-page-${pageNumber}`}
      ref={wrapperRef}
      className="relative bg-white shadow-lg mx-auto transition-all"
      onMouseUp={handleMouseUp}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        marginBottom: `${PAGE_GAP}px`,
        cursor: activeTool === 'TEXT' ? 'text' : 'crosshair'
      }}
    >
      {shouldRender ? (
        <>
          <canvas ref={canvasRef} className="block" />
          <div
            ref={textLayerRef}
            className="textLayer"
            style={{
              pointerEvents: activeTool === 'TEXT' ? 'auto' : 'none',
              cursor: activeTool === 'TEXT' ? 'text' : 'default'
            }}
          />
          {isRendering && <div className="absolute inset-0 flex items-center justify-center bg-white/50"><Loader2Icon className="w-8 h-8 animate-spin text-indigo-400" /></div>}

          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
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
          {/* Annotation popup now rendered in sidebar - show temporary marker on PDF */}
          {isPendingOnThisPage && pendingAnnotation && (
            <div
              className="absolute pointer-events-none z-30"
              style={{ left: `${pendingAnnotation.x}%`, top: `${pendingAnnotation.y}%` }}
            >
              <div className="w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow-lg animate-pulse -translate-x-1/2 -translate-y-1/2" />
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center w-full h-full bg-slate-50 text-slate-400">
          <span className="text-2xl font-bold opacity-20">{pageNumber}</span>
        </div>
      )}
    </div>
  );
};

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  doc, annotations, onAddAnnotation, onUpdateAnnotation, onDeleteAnnotation, onBack, onOpenClinicalWorkspace,
  googleAccessToken, initialPage = 1, focusedAnnotationId, isEditingFocused, onClearFocus, onSetFocus,
  allDocuments = [], onSwitchDocument,
  currentUser
}) => {
  // annotations = all case annotations; currentDocAnnotations = for this document only (PDF + Comments)
  const currentDocAnnotations = React.useMemo(
    () => annotations.filter(a => a.documentId === doc.id),
    [annotations, doc.id]
  );
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
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const visiblePages = useRef(new Map<number, number>());

  // Jump to page state
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [tempPageInput, setTempPageInput] = useState('');

  const [pendingAnnotation, setPendingAnnotation] = useState<any>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const [pendingText, setPendingText] = useState('');
  const [pendingAuthor, setPendingAuthor] = useState(currentUser.name);
  const [pendingDate, setPendingDate] = useState(''); // Leave empty - user manually sets if needed
  const [pendingTime, setPendingTime] = useState(''); // Leave empty - user manually sets if needed
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'cached' | 'downloading'>('idle');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const estimatedHeightPerPage = (ESTIMATED_PAGE_HEIGHT * (scale / 1.2)) + PAGE_GAP;

  const jumpToPage = (targetPage: number, smooth = true) => {
    const page = Math.max(1, Math.min(numPages, targetPage));
    setCurrentPage(page);

    if (isContinuous && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: (page - 1) * estimatedHeightPerPage,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  const handleCoarseScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isContinuous || !pdfDoc) return;
    const scrollTop = e.currentTarget.scrollTop;

    // Coarse virtualization update
    const virtualPage = Math.max(1, Math.min(numPages, Math.floor((scrollTop + (estimatedHeightPerPage / 2)) / estimatedHeightPerPage) + 1));

    // If the virtual page is outside our current rendered window, force an update
    // This handles fast scrolling through empty space
    if (Math.abs(virtualPage - currentPage) >= VIRTUAL_WINDOW_SIZE) {
      setCurrentPage(virtualPage);
    }
  };


  const handlePageVisible = React.useCallback((pageNumber: number, ratio: number = 1) => {
    if (!isContinuous) return;

    visiblePages.current.set(pageNumber, ratio);

    let maxRatio = 0;
    let mostVisiblePage = pageNumber;

    for (const [pg, r] of visiblePages.current.entries()) {
      if (r > maxRatio) {
        maxRatio = r;
        mostVisiblePage = pg;
      } else if (r === maxRatio) {
        if (pg < mostVisiblePage) mostVisiblePage = pg;
      }
    }

    setCurrentPage(current => {
      if (current === mostVisiblePage) return current;
      const currentRatio = visiblePages.current.get(current) || 0;
      // Switch if new page is significantly more visible or current is mostly hidden
      if (maxRatio > currentRatio + 0.1 || currentRatio < 0.3) {
        return mostVisiblePage;
      }
      return current;
    });
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

  // Keyboard navigation: Up/Down scroll in both modes; Left/Right change pages in single-page mode
  useEffect(() => {
    if (!pdfDoc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowLeft':
          if (!isContinuous) {
            e.preventDefault();
            jumpToPage(currentPage - 1);
          }
          break;
        case 'ArrowRight':
          if (!isContinuous) {
            e.preventDefault();
            jumpToPage(currentPage + 1);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (scrollRef.current) {
            scrollRef.current.scrollBy({ top: -120, behavior: 'smooth' });
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (scrollRef.current) {
            scrollRef.current.scrollBy({ top: 120, behavior: 'smooth' });
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isContinuous, currentPage, pdfDoc, numPages]);

  // Handle focused annotation from props
  useEffect(() => {
    if (focusedAnnotationId) {
      const ann = currentDocAnnotations.find(a => a.id === focusedAnnotationId);
      if (ann) {
        if (ann.page !== currentPage) {
          setCurrentPage(ann.page);
        }
        if (isEditingFocused) {
          handleStartEdit(ann);
        }
      }
    }
  }, [focusedAnnotationId, isEditingFocused, currentDocAnnotations]);

  // Auto-scroll sidebar to the focused annotation card
  useEffect(() => {
    if (!focusedAnnotationId || !sidebarScrollRef.current) return;

    // Small delay to ensure the DOM has rendered the card
    const timer = setTimeout(() => {
      const card = sidebarScrollRef.current?.querySelector(`[data-annotation-id="${focusedAnnotationId}"]`) as HTMLElement | null;
      if (card && sidebarScrollRef.current) {
        const container = sidebarScrollRef.current;
        const cardTop = card.offsetTop - container.offsetTop;
        const cardHeight = card.offsetHeight;
        const containerHeight = container.clientHeight;

        // Scroll so the card is centered in the sidebar
        const scrollTarget = cardTop - (containerHeight / 2) + (cardHeight / 2);
        container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [focusedAnnotationId]);

  const isPdf = doc.type === 'pdf' || (!doc.type && doc.name?.toLowerCase().endsWith('.pdf'));

  useEffect(() => {
    // Skip PDF loading for non-PDF documents
    if (!isPdf) {
      setLoading(false);
      return;
    }

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      setCacheStatus('idle');

      if (pdfDocRef.current) {
        try { pdfDocRef.current.destroy(); } catch {}
        pdfDocRef.current = null;
        setPdfDoc(null);
      }

      try {
        const fetchUrl = doc.url;
        const cacheKey = `pdf_${String(doc.id).replace(/[\/\.]/g, '_')}`;
        let arrayBuffer: ArrayBuffer;

        const cached = await pdfCacheManager.getCachedPDF(cacheKey);
        const wasFromCache = !!cached;

        if (cached) {
          setCacheStatus('cached');
          arrayBuffer = cached;
        } else {
          setCacheStatus('downloading');
          const response = await fetch(fetchUrl, { mode: 'cors', credentials: 'omit' });
          if (!response.ok) {
            const msg = response.status >= 500
              ? `Document server error (${response.status}). The file may be unavailable.`
              : `Failed to load document: ${response.status} ${response.statusText}`;
            throw new Error(msg);
          }
          const fetched = await response.arrayBuffer();
          await pdfCacheManager.cachePDF(cacheKey, fetched.slice(0), {
            path: (doc as any).storagePath || doc.url,
            docName: doc.name,
            downloadedAt: new Date().toISOString()
          });
          arrayBuffer = fetched;
        }

        // Pass data - use copy for PDF.js since it may detach the buffer
        const dataForPdf = arrayBuffer.slice(0);
        const loadingTask = pdfjsLib.getDocument({
          data: dataForPdf,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
          disableAutoFetch: true,
          disableStream: false,
        });

        const loadedPdf = await loadingTask.promise;
        pdfDocRef.current = loadedPdf;
        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setLoading(false);
        if (!wasFromCache) setCacheStatus('idle');
        setTimeout(() => setIsInitialLoad(false), 1000);
      } catch (err: any) {
        console.error("PDF Load Error:", err);
        const isCors = err.message === 'Failed to fetch' || err.message.includes('CORS');
        setError({
          message: isCors ? "Access Blocked by Storage Policy (CORS)" : (err.message || "Failed to load document."),
          isCors
        });
        setLoading(false);
        setCacheStatus('idle');
      }
    };
    loadPdf();
    return () => {
      if (pdfDocRef.current) {
        try { pdfDocRef.current.destroy(); } catch {}
        pdfDocRef.current = null;
      }
    };
  }, [doc.id, doc.url]);

  // Handle text highlight from PDF - open popup with pre-filled text for user review
  const handleTextHighlight = (page: number, selectedText: string, x: number, y: number) => {
    // Open the annotation popup with the highlighted text pre-filled
    // User can then review, edit, and choose Manual Save or AI Save
    setPendingAnnotation({ page, x, y, type: 'highlight' });
    setEditingAnnotation(null);
    setPendingText(selectedText);
    setPendingDate('');
    setPendingTime('');
    onClearFocus?.();
  };

  const handleCommitPending = (manualText?: string, manualDate?: string, manualTime?: string) => {
    const textToUse = manualText !== undefined ? manualText : pendingText;
    const dateVal = manualDate !== undefined ? manualDate : pendingDate;
    const timeVal = manualTime !== undefined ? manualTime : pendingTime;
    const dateToUse = dateVal?.trim() ? dateVal.trim() : undefined;
    const timeToUse = timeVal?.trim() ? timeVal.trim() : undefined;

    if (editingAnnotation) {
      onUpdateAnnotation({
        ...editingAnnotation,
        text: textToUse,
        category: activeCategory,
        author: pendingAuthor,
        eventDate: dateToUse,
        eventTime: timeToUse
      });
      setEditingAnnotation(null);
      setPendingText('');
      setPendingDate('');
      setPendingTime('');
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
        timeToUse
      );
      setPendingAnnotation(null);
      setPendingText('');
      setPendingDate('');
      setPendingTime('');
    }
    // Show continue-annotating toast
    setSaveToast('Note saved! Click anywhere on the PDF to continue annotating.');
    setTimeout(() => setSaveToast(null), 4000);
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
    // Ensure sidebar is open so user can see the focused comment
    if (!showSidebar) setShowSidebar(true);
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
                            {document.type === 'video' ? <VideoIcon className={`w-5 h-5 shrink-0 ${isActive ? 'text-purple-600' : 'text-purple-400'}`} /> :
                             document.type === 'image' ? <ImageIcon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-emerald-400'}`} /> :
                             document.type === 'dicom' ? <ScanIcon className={`w-5 h-5 shrink-0 ${isActive ? 'text-cyan-600' : 'text-cyan-400'}`} /> :
                             document.type === 'other' ? <FileIcon className={`w-5 h-5 shrink-0 ${isActive ? 'text-slate-600' : 'text-slate-400'}`} /> :
                             <FileTextIcon className={`w-5 h-5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />}
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
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-700 truncate max-w-[200px]">{doc.name}</h2>
              {cacheStatus === 'cached' && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded" title="Loaded from cache - no network download">
                  📦 Cached
                </span>
              )}
              {cacheStatus === 'downloading' && loading && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  ⬇️ Downloading
                </span>
              )}
            </div>
          )}

          {onOpenClinicalWorkspace && (
            <button
              onClick={onOpenClinicalWorkspace}
              className="ml-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 flex items-center gap-2"
            >
              <SparklesIcon className="w-3.5 h-3.5" /> View Clinical Workspace
            </button>
          )}

          {!isPdf && (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
            >
              <DownloadIcon className="w-3.5 h-3.5" /> Download File
            </a>
          )}

          {isPdf && (
            <>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setActiveTool('POINT')} className={`p-1.5 rounded ${activeTool === 'POINT' ? 'bg-white shadow' : 'text-slate-400'}`} title="Pointer Tool"><MousePointer2Icon className="w-4 h-4" /></button>
                <button onClick={() => setActiveTool('TEXT')} className={`p-1.5 rounded ${activeTool === 'TEXT' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-200'}`} title="Highlight Text Tool - Select text in PDF to create annotations">
                  <HighlighterIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setActiveTool('VOICE')} className={`p-1.5 rounded relative ${activeTool === 'VOICE' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-200'}`} title="Voice Annotation">
                  <MicIcon className="w-4 h-4" />
                  {activeTool === 'VOICE' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                  )}
                </button>
              </div>

              {activeTool === 'TEXT' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200 animate-in fade-in slide-in-from-left-2 duration-300">
                  <HighlighterIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Select text in PDF to create annotation</span>
                </div>
              )}
              {activeTool === 'VOICE' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full border border-red-100 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Mic Ready</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isPdf && (
            <>
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
                {isEditingPage ? (
                  <input
                    autoFocus
                    className="w-12 text-xs font-bold px-1 py-0.5 bg-white border border-indigo-300 rounded text-center outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={tempPageInput}
                    onChange={(e) => setTempPageInput(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => {
                      setIsEditingPage(false);
                      if (tempPageInput) {
                        const p = parseInt(tempPageInput);
                        if (!isNaN(p)) jumpToPage(p);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsEditingPage(false);
                        if (tempPageInput) {
                          const p = parseInt(tempPageInput);
                          if (!isNaN(p)) jumpToPage(p);
                        }
                      }
                      if (e.key === 'Escape') setIsEditingPage(false);
                    }}
                  />
                ) : (
                  <span
                    className="text-xs font-bold px-2 cursor-pointer hover:bg-slate-200 rounded select-none transition-colors"
                    onDoubleClick={() => {
                      setTempPageInput(currentPage.toString());
                      setIsEditingPage(true);
                    }}
                    title="Double click to jump to page"
                  >
                    {currentPage} / {numPages}
                  </span>
                )}
                <button onClick={() => jumpToPage(currentPage + 1)} disabled={currentPage >= numPages} className="p-1 disabled:opacity-30"><ChevronRightIcon className="w-4 h-4" /></button>
              </div>
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 text-slate-500 hover:text-indigo-600"><ZoomOutIcon className="w-4 h-4" /></button>
              <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-1.5 text-slate-500 hover:text-indigo-600"><ZoomInIcon className="w-4 h-4" /></button>
            </>
          )}
          <button onClick={() => setShowSidebar(!showSidebar)} className={`p-2 rounded-lg transition-colors ${showSidebar ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}><PanelRightIcon className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleCoarseScroll}
          onClick={(e) => {
            if (!focusedAnnotationId) return;
            const onPage = (e.target as HTMLElement).closest('[id^="pdf-page-"]');
            if (!onPage) onClearFocus?.();
          }}
          className="flex-1 overflow-auto p-8 bg-slate-200/50 cursor-default"
          style={{ scrollBehavior: 'auto', WebkitOverflowScrolling: 'touch', willChange: 'scroll-position' }}
        >
          {!isPdf ? (
            /* Non-PDF file viewer */
            <div className="flex flex-col items-center justify-center h-full">
              {doc.type === 'video' ? (
                <div className="w-full max-w-5xl">
                  <video
                    controls
                    className="w-full rounded-2xl shadow-2xl bg-black"
                    style={{ maxHeight: 'calc(100vh - 200px)' }}
                    preload="metadata"
                  >
                    <source src={doc.url} type={doc.mimeType || 'video/mp4'} />
                    Your browser does not support video playback.
                  </video>
                  <div className="mt-4 text-center">
                    <p className="text-sm text-slate-500">{doc.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{doc.size}</p>
                  </div>
                </div>
              ) : doc.type === 'image' ? (
                <div className="w-full max-w-5xl flex flex-col items-center">
                  <img
                    src={doc.url}
                    alt={doc.name}
                    className="max-w-full rounded-2xl shadow-2xl"
                    style={{ maxHeight: 'calc(100vh - 200px)', objectFit: 'contain' }}
                  />
                  <div className="mt-4 text-center">
                    <p className="text-sm text-slate-500">{doc.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{doc.size}</p>
                  </div>
                </div>
              ) : (
                /* DICOM, or any other file type - show info card with download */
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-12 max-w-lg text-center">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
                    doc.type === 'dicom' ? 'bg-cyan-50 text-cyan-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {doc.type === 'dicom' ? <ScanIcon className="w-10 h-10" /> : <FileIcon className="w-10 h-10" />}
                  </div>
                  <h3 className="text-xl font-bold text-slate-700 mb-2">{doc.name}</h3>
                  <p className="text-sm text-slate-400 mb-1">{doc.size}</p>
                  {doc.mimeType && <p className="text-xs text-slate-400 mb-6 font-mono">{doc.mimeType}</p>}
                  {doc.type === 'dicom' && (
                    <p className="text-sm text-cyan-700 bg-cyan-50 rounded-xl px-4 py-3 mb-6 border border-cyan-100">
                      DICOM imaging files require a specialized viewer. Download the file and open it with your preferred DICOM viewer (e.g., Horos, RadiAnt, 3D Slicer).
                    </p>
                  )}
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg"
                  >
                    <DownloadIcon className="w-4 h-4" /> Download File
                  </a>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 ml-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all border border-slate-200"
                  >
                    <ExternalLinkIcon className="w-4 h-4" /> Open in New Tab
                  </a>
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Loader2Icon className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
              <p className="font-serif italic text-slate-500">Opening document...</p>
              <p className="text-xs text-slate-400 mt-2">Large files load progressively</p>
            </div>
          ) : (
            <div className={`max-w-4xl mx-auto pb-20 ${isContinuous ? 'relative' : ''}`} style={isContinuous ? { height: numPages * estimatedHeightPerPage } : {}}>
              {isContinuous ? (
                Array.from({ length: numPages }, (_, i) => i + 1)
                  .filter(pg => {
                    const renderWindow = isInitialLoad ? INITIAL_RENDER_COUNT : VIRTUAL_WINDOW_SIZE * 2;
                    return Math.abs(pg - currentPage) <= renderWindow;
                  })
                  .map((pg) => (
                    <div
                      key={pg}
                      style={{
                        position: 'absolute',
                        top: (pg - 1) * estimatedHeightPerPage,
                        left: 0,
                        right: 0
                      }}
                    >
                      <PDFPage
                        key={pg}
                        pageNumber={pg}
                        pdfDoc={pdfDoc}
                        scale={scale}
                        annotations={currentDocAnnotations.filter(a => a.page === pg)}
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
                          setPendingTime('');
                          onClearFocus?.();
                        }}
                        onCommitPending={handleCommitPending}
                        pendingText={pendingText}
                        setPendingText={setPendingText}
                        pendingAuthor={pendingAuthor}
                        setPendingAuthor={setPendingAuthor}
                        pendingDate={pendingDate}
                        setPendingDate={setPendingDate}
                        pendingTime={pendingTime}
                        setPendingTime={setPendingTime}
                        availableAuthors={[currentUser.name]}
                        activeCategory={activeCategory}
                        onCycleCategory={cycleCategory}
                        getCategoryColor={getCategoryColor}
                        setActiveCategory={setActiveCategory}
                        focusedAnnotationId={focusedAnnotationId}
                        onEditExisting={handleFocusAnnotation}
                        onVisible={handlePageVisible}
                        shouldRender={Math.abs(currentPage - pg) <= VIRTUAL_WINDOW_SIZE}
                        onTextHighlight={handleTextHighlight}
                      />
                    </div>
                  ))
              ) : (
                <PDFPage
                  pageNumber={currentPage}
                  pdfDoc={pdfDoc}
                  scale={scale}
                  annotations={currentDocAnnotations.filter(a => a.page === currentPage)}
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
                    setPendingTime('');
                    onClearFocus?.();
                  }}
                  onCommitPending={handleCommitPending}
                  pendingText={pendingText}
                  setPendingText={setPendingText}
                  pendingAuthor={pendingAuthor}
                  setPendingAuthor={setPendingAuthor}
                  pendingDate={pendingDate}
                  setPendingDate={setPendingDate}
                  pendingTime={pendingTime}
                  setPendingTime={setPendingTime}
                  availableAuthors={[currentUser.name]}
                  activeCategory={activeCategory}
                  onCycleCategory={cycleCategory}
                  getCategoryColor={getCategoryColor}
                  setActiveCategory={setActiveCategory}
                  focusedAnnotationId={focusedAnnotationId}
                  onEditExisting={handleFocusAnnotation}
                  onVisible={handlePageVisible}
                  onTextHighlight={handleTextHighlight}
                />
              )}
            </div>
          )}
        </div>
        {showSidebar && (
          <div className="w-96 min-w-[360px] bg-white border-l flex flex-col shadow-xl animate-in slide-in-from-right-4 duration-300 min-h-0">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50 font-bold text-slate-700 text-sm">
              <div className="flex items-center">
                <MessageSquareIcon className="w-4 h-4 text-indigo-600 mr-2" /> Comments
              </div>
              <div className="flex items-center gap-2">
                {!isPdf && !pendingAnnotation && !editingAnnotation && (
                  <button
                    onClick={() => {
                      setPendingAnnotation({ page: 1, x: 0, y: 0, type: 'point' });
                      setEditingAnnotation(null);
                      setPendingText('');
                      setPendingDate('');
                      setPendingTime('');
                      onClearFocus?.();
                    }}
                    className="text-[10px] text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-700 font-bold flex items-center gap-1 transition-colors"
                  >
                    + Add Note
                  </button>
                )}
                {focusedAnnotationId && (
                  <button onClick={onClearFocus} className="text-[10px] text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-bold">Clear Focus</button>
                )}
                <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-[10px] text-slate-400">{currentDocAnnotations.length}</span>
              </div>
            </div>

            {/* Active Annotation Form */}
            {(pendingAnnotation || editingAnnotation) && (
              <div className="p-4 bg-indigo-50 border-b border-indigo-100">
                <AnnotationPopup
                  x={0}
                  y={0}
                  height={0}
                  activeCategory={activeCategory}
                  pendingText={pendingText}
                  setPendingText={setPendingText}
                  pendingAuthor={pendingAuthor}
                  setPendingAuthor={setPendingAuthor}
                  pendingDate={pendingDate}
                  setPendingDate={setPendingDate}
                  pendingTime={pendingTime}
                  setPendingTime={setPendingTime}
                  availableAuthors={[currentUser.name]}
                  onCycleCategory={() => {
                    const cats = ['Review', 'Medical', 'Legal', 'Urgent'];
                    const idx = cats.indexOf(activeCategory);
                    setActiveCategory(cats[(idx + 1) % cats.length]);
                  }}
                  onCancel={() => {
                    setPendingAnnotation(null);
                    setEditingAnnotation(null);
                    setPendingText('');
                    setPendingDate('');
                    setPendingTime('');
                    onClearFocus?.();
                  }}
                  onCommit={handleCommitPending}
                  getCategoryColor={(cat: string) => {
                    switch (cat) {
                      case 'Medical': return 'bg-red-500';
                      case 'Legal': return 'bg-blue-500';
                      case 'Review': return 'bg-amber-500';
                      case 'Urgent': return 'bg-rose-500';
                      default: return 'bg-slate-500';
                    }
                  }}
                  activeTool={activeTool}
                  setActiveCategory={setActiveCategory}
                  detachPopup={false}
                />
              </div>
            )}

            <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ WebkitOverflowScrolling: 'touch', willChange: 'scroll-position', overscrollBehavior: 'contain' }}>
              {currentDocAnnotations.length === 0 && (
                <div className="text-center py-10 opacity-30">
                  <MessageSquareIcon className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-xs">No comments yet</p>
                </div>
              )}
              {[...currentDocAnnotations]
                .sort((a, b) => {
                  if (a.page !== b.page) return a.page - b.page;
                  const getTime = (ann: Annotation) => {
                    if (ann.eventDate && ann.eventTime) {
                      const t = new Date(`${ann.eventDate}T${ann.eventTime}`).getTime();
                      if (!isNaN(t)) return t;
                    }
                    if (ann.timestamp) {
                      const t = new Date(ann.timestamp).getTime();
                      if (!isNaN(t)) return t;
                    }
                    return 0;
                  };
                  return getTime(a) - getTime(b);
                })
                .map(ann => (
                <div
                  key={ann.id}
                  data-annotation-id={ann.id}
                  onClick={() => handleFocusAnnotation(ann)}
                  className={`group p-4 bg-white rounded-xl border transition-all cursor-pointer hover:shadow-md relative ${focusedAnnotationId === ann.id ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg bg-indigo-50/30' : 'border-slate-200 shadow-sm hover:border-indigo-200'}`}
                >
                  <div className="text-center mb-2 pb-1.5 border-b border-slate-100">
                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 inline-flex items-center gap-1">
                      <FileTextIcon className="w-2.5 h-2.5" />
                      {doc.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${getCategoryColor(ann.category)}`}>{ann.category}</span>
                    {isPdf && <span className="text-[9px] text-slate-400">Page {ann.page}</span>}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed mb-3">"{ann.text}"</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white font-bold ${getAvatarColor(ann.author)}`}>{ann.author.charAt(0)}</div>
                      <span>{ann.author}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Action Buttons - Shown on Hover */}
                      <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(ann); }}
                          className="p-1.5 px-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md font-bold text-[10px] shadow-sm border border-indigo-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async (e) => { 
                            e.stopPropagation(); 
                            if (confirm('Delete this annotation? This cannot be undone.')) {
                              try {
                                await onDeleteAnnotation(ann.id);
                                console.log(`✅ Successfully deleted annotation ${ann.id}`);
                              } catch (error) {
                                console.error('❌ Failed to delete annotation:', error);
                                alert('Failed to delete annotation. Please try again.');
                              }
                            }
                          }}
                          className="p-1.5 px-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-md font-bold flex items-center"
                          title="Delete"
                        >
                          <Trash2Icon className="w-3 h-3" />
                        </button>
                      </span>
                      {/* Date and time - no icons */}
                      {ann.eventDate && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          {formatDisplayDate(ann.eventDate)}
                        </span>
                      )}
                      {ann.eventTime && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          {ann.eventTime}
                        </span>
                      )}
                      {!ann.eventDate && !ann.eventTime && (
                        <span className="text-[10px] text-slate-300 italic">No date/time</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Save Toast - continue annotating prompt */}
      {saveToast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 px-5 py-3 bg-emerald-600 text-white rounded-xl shadow-2xl shadow-emerald-200">
            <CheckIcon className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">{saveToast}</span>
            <button onClick={() => setSaveToast(null)} className="p-1 hover:bg-emerald-700 rounded-lg ml-2">
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
