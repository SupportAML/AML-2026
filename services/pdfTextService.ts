import * as pdfjsLib from 'pdfjs-dist';
import { Annotation, Document } from '../types';
import { pdfCacheManager } from './pdfCacheManager';

// Ensure worker is configured once for PDF.js usage in non-UI helpers
if (!(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs';
}

const isPdfDoc = (doc: Document) =>
  doc.type === 'pdf' || (!doc.type && doc.name?.toLowerCase().endsWith('.pdf'));

const fetchPdfBuffer = async (doc: Document): Promise<ArrayBuffer> => {
  const cacheKey = `pdf_${String(doc.id).replace(/[\/\.]/g, '_')}`;
  const cached = await pdfCacheManager.getCachedPDF(cacheKey);
  if (cached) return cached;

  const response = await fetch(doc.url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) {
    const msg = response.status >= 500
      ? `Document server error (${response.status}).`
      : `Failed to load document: ${response.status} ${response.statusText}`;
    throw new Error(msg);
  }
  const fetched = await response.arrayBuffer();
  await pdfCacheManager.cachePDF(cacheKey, fetched.slice(0), {
    path: (doc as any).storagePath || doc.url,
    docName: doc.name,
    downloadedAt: new Date().toISOString()
  });
  return fetched;
};

export const extractPdfTextForAnnotations = async (
  docs: Document[],
  annotations: Annotation[],
  options: { perPageCharLimit?: number; totalCharLimit?: number } = {}
): Promise<string> => {
  const perPageLimit = options.perPageCharLimit ?? 1500;
  const totalLimit = options.totalCharLimit ?? 12000;

  const pagesByDoc = new Map<string, Set<number>>();
  for (const ann of annotations) {
    if (!ann.documentId || ann.documentId === 'manual-notes' || ann.documentId === 'research-notes') continue;
    if (!ann.page || ann.page < 1) continue;
    if (!pagesByDoc.has(ann.documentId)) pagesByDoc.set(ann.documentId, new Set());
    pagesByDoc.get(ann.documentId)!.add(ann.page);
  }

  let totalChars = 0;
  const blocks: string[] = [];

  for (const doc of docs) {
    if (!isPdfDoc(doc)) continue;
    const pages = pagesByDoc.get(doc.id);
    if (!pages || pages.size === 0) continue;

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await fetchPdfBuffer(doc);
    } catch (err) {
      console.warn('PDF fetch failed for text extraction:', doc.name, err);
      continue;
    }

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer.slice(0),
        cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${(pdfjsLib as any).version}/cmaps/`,
        cMapPacked: true,
        disableAutoFetch: true,
        disableStream: false
      });
      const pdf = await loadingTask.promise;
      const pageNumbers = Array.from(pages).sort((a, b) => a - b);

      for (const pageNumber of pageNumbers) {
        if (totalChars >= totalLimit) break;
        if (pageNumber < 1 || pageNumber > pdf.numPages) continue;
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const raw = (textContent.items as any[])
          .map(item => item.str)
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (!raw) continue;
        const clipped = raw.slice(0, perPageLimit);
        const block = `[${doc.name} - p. ${pageNumber}]\n${clipped}`;
        blocks.push(block);
        totalChars += block.length;
      }
    } catch (err) {
      console.warn('PDF text extraction failed:', doc.name, err);
      continue;
    }

    if (totalChars >= totalLimit) break;
  }

  return blocks.join('\n\n');
};

/**
 * Extract text from a PDF URL (e.g., a CV). Does not require annotations.
 * Returns the extracted text up to the given character limit.
 */
export const extractPdfTextFromUrl = async (
  url: string,
  charLimit: number = 15000
): Promise<string> => {
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer.slice(0),
      cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${(pdfjsLib as any).version}/cmaps/`,
      cMapPacked: true,
    });
    const pdf = await loadingTask.promise;

    let text = '';
    for (let i = 1; i <= pdf.numPages && text.length < charLimit; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = (content.items as any[])
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      text += (text ? '\n\n' : '') + pageText;
    }

    return text.slice(0, charLimit);
  } catch (err) {
    console.warn('CV PDF text extraction failed:', err);
    return '';
  }
};
