import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ArrowLeftIcon, ExternalLinkIcon, Loader2Icon, XIcon } from 'lucide-react';
import { Document as DocType, Annotation } from '../types';
import { pdfCacheManager } from '../services/pdfCacheManager';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;

interface PreviewPanelProps {
    doc: DocType;
    page: number;
    annotations: Annotation[];
    onClose: () => void;
    onOpenFullView: () => void;
    highlightAnnotationId?: string | null;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
    doc,
    page,
    annotations,
    onClose,
    onOpenFullView,
    highlightAnnotationId
}) => {
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load PDF
    useEffect(() => {
        if (!doc || !doc.url) {
            setError('No document available');
            setLoading(false);
            return;
        }

        const loadPdf = async () => {
            setLoading(true);
            setError(null);
            try {
                const cacheKey = `pdf_${String(doc.id).replace(/[\/\.]/g, '_')}`;
                let buffer: ArrayBuffer;

                const cached = await pdfCacheManager.getCachedPDF(cacheKey);
                if (cached) {
                    buffer = cached;
                } else {
                    const response = await fetch(doc.url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const fetched = await response.arrayBuffer();
                    await pdfCacheManager.cachePDF(cacheKey, fetched.slice(0), {
                        docName: doc.name,
                        downloadedAt: new Date().toISOString()
                    });
                    buffer = fetched;
                }

                const loadedPdf = await pdfjsLib.getDocument({ data: buffer }).promise;
                setPdfDoc(loadedPdf);
            } catch (err: any) {
                console.error("Preview PDF Load Error:", err);
                setError(err.message || "Failed to load preview");
            } finally {
                setLoading(false);
            }
        };
        loadPdf();
    }, [doc.id]);

    // Render page
    useEffect(() => {
        if (!pdfDoc || !canvasRef.current) return;

        let active = true;
        let renderTask: any = null;

        const renderPage = async () => {
            try {
                const pdfPage = await pdfDoc.getPage(page);
                const viewport = pdfPage.getViewport({ scale: 1.0 });
                const canvas = canvasRef.current;
                if (!canvas || !active) return;

                const context = canvas.getContext('2d');
                if (!context) return;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                // Cancel previous render task if exists
                if (renderTask) {
                    renderTask.cancel();
                }

                if (!active) return;

                // Start new render task
                renderTask = pdfPage.render({ canvasContext: context, viewport });

                try {
                    await renderTask.promise;
                } catch (err: any) {
                    // Ignore cancellation errors
                    if (err?.name === 'RenderingCancelledException') {
                        return;
                    }
                    throw err;
                }

                if (!active) return;

                // Scroll to highlighted annotation if present
                if (highlightAnnotationId && containerRef.current) {
                    const ann = annotations.find(a => a.id === highlightAnnotationId && a.page === page);
                    if (ann) {
                        const targetY = (ann.y / 100) * viewport.height;
                        containerRef.current.scrollTo({ top: targetY - 200, behavior: 'smooth' });
                    }
                }
            } catch (err) {
                if (active) {
                    console.error("Preview render error:", err);
                }
            }
        };

        renderPage();

        return () => {
            active = false;
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [pdfDoc, page, highlightAnnotationId, annotations]);

    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case 'Medical': return 'bg-red-500';
            case 'Legal': return 'bg-blue-500';
            case 'Review': return 'bg-amber-500';
            case 'Urgent': return 'bg-rose-500';
            default: return 'bg-slate-500';
        }
    };

    const pageAnnotations = annotations.filter(a => a.page === page);

    return (
        <div className="w-1/2 flex flex-col bg-white border-l border-slate-200 shadow-2xl animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="h-14 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-slate-50 px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all hover:shadow-sm"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                    <div>
                        <h3 className="text-[10px] font-black text-indigo-900 uppercase tracking-[0.2em]">Source Preview</h3>
                        <p className="text-[11px] text-slate-500 font-bold truncate max-w-[250px]">
                            {doc.name} • Page {page}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onOpenFullView}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 hover:scale-105"
                >
                    <ExternalLinkIcon className="w-3 h-3" /> Full View
                </button>
            </div>

            {/* Content */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto bg-slate-100 p-8 scroll-smooth relative"
            >
                {loading && (
                    <div className="flex flex-col items-center justify-center h-full">
                        <Loader2Icon className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                        <p className="text-slate-500 font-medium text-sm">Loading preview...</p>
                    </div>
                )}

                {error && (
                    <div className="flex flex-col items-center justify-center h-full">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                            <ArrowLeftIcon className="w-8 h-8 text-red-500" />
                        </div>
                        <p className="text-red-600 font-bold">{error}</p>
                    </div>
                )}

                {!loading && !error && (
                    <div className="relative bg-white shadow-2xl mx-auto" style={{ width: 'fit-content' }}>
                        <canvas ref={canvasRef} className="block" />

                        {/* Annotation Overlays */}
                        <div className="absolute inset-0 pointer-events-none">
                            {pageAnnotations.map((ann) => {
                                const isHighlighted = ann.id === highlightAnnotationId;
                                return (
                                    <div
                                        key={ann.id}
                                        className={`absolute -translate-x-1/2 -translate-y-1/2 ${isHighlighted ? 'z-20' : 'z-10'}`}
                                        style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
                                    >
                                        <div
                                            className={`w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all ${getCategoryColor(ann.category)} ${isHighlighted ? 'animate-annotation-bounce ring-4 ring-indigo-500/40 scale-150' : ''
                                                }`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PreviewPanel;
