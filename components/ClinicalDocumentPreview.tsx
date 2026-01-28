
import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2Icon } from 'lucide-react';
import { Annotation, Document } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;

interface ClinicalDocumentPreviewProps {
    doc: Document;
    page: number;
    annotations: Annotation[];
}

export const ClinicalDocumentPreview: React.FC<ClinicalDocumentPreviewProps> = ({ doc, page, annotations }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [scale, setScale] = useState(1.0);

    useEffect(() => {
        const loadPdf = async () => {
            setLoading(true);
            try {
                const response = await fetch(doc.url);
                const buffer = await response.arrayBuffer();
                const loadedPdf = await pdfjsLib.getDocument({ data: buffer }).promise;
                setPdfDoc(loadedPdf);
            } catch (err) {
                console.error("Preview load error:", err);
            } finally {
                setLoading(false);
            }
        };
        loadPdf();
    }, [doc.url]);

    useEffect(() => {
        let active = true;
        const renderPage = async () => {
            if (!pdfDoc || !canvasRef.current) return;
            try {
                const pdfPage = await pdfDoc.getPage(page);
                const viewport = pdfPage.getViewport({ scale: 1.5 }); // High res for preview
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                if (!context) return;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                if (active) {
                    await pdfPage.render({ canvasContext: context, viewport }).promise;
                }
            } catch (err) {
                console.error(err);
            }
        };
        renderPage();
        return () => { active = false; };
    }, [pdfDoc, page]);

    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case 'Medical': return 'bg-red-500';
            case 'Legal': return 'bg-blue-500';
            case 'Review': return 'bg-amber-500';
            case 'Urgent': return 'bg-rose-500';
            default: return 'bg-slate-500';
        }
    };

    return (
        <div className="relative bg-white shadow-2xl rounded-sm overflow-hidden mx-auto border border-slate-300">
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
                    <Loader2Icon className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Source...</p>
                </div>
            )}
            <canvas ref={canvasRef} className="max-w-full h-auto block" />
            <div className="absolute inset-0 pointer-events-none">
                {annotations.filter(a => a.page === page).map((ann) => (
                    <div
                        key={ann.id}
                        className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
                    >
                        <div className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ring-white/20 ${getCategoryColor(ann.category)}`} />
                    </div>
                ))}
            </div>
        </div>
    );
};
