
import { Annotation, Case, Document, UserProfile } from "../types";

export interface LegalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface CaseContext {
  caseTitle: string;
  caseDescription: string;
  qualifications: string;
  documents: string;
  annotations: string;
  pdfTextContext: string;
  clinicalNotes: string;
  currentDraft: string;
  writerComments?: string;
  cvContent?: string;
}

export interface SuggestionItem {
  original: string;
  suggested: string;
  reason: string;
}

// ============================================================================
// SHARED SSE STREAM READER
// ============================================================================

const readSSEStream = async (
  response: Response,
  onChunk: (text: string) => void
): Promise<string> => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);

      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text) {
          fullText += parsed.text;
          onChunk(fullText);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  return fullText;
};

// ============================================================================
// CASE CONTEXT BUILDER
// ============================================================================

/**
 * Build case context object from case data for the Claude API
 */
export const buildCaseContext = (
  caseData: Case,
  docs: Document[],
  annotations: Annotation[],
  pdfTextContext: string,
  currentUser: UserProfile,
  currentDraft: string,
  writerComments?: string,
  cvContent?: string
): CaseContext => {
  const docNameById = new Map(docs.map(d => [d.id, d.name]));

  const formatAnnotation = (ann: Annotation): string => {
    const docName =
      ann.documentId === 'manual-notes' ? 'Manual Notes' :
        ann.documentId === 'research-notes' ? 'Research Notes' :
          docNameById.get(ann.documentId) || 'Unknown Document';
    const pageInfo = ann.page ? `p. ${ann.page}` : '';
    const dateInfo = ann.eventDate ? `Date: ${ann.eventDate}` : '';
    const meta = [docName, pageInfo, dateInfo].filter(Boolean).join(', ');
    return `- [${ann.category}] ${ann.text}${meta ? ` (${meta})` : ''}`;
  };

  const groupedAnnotations = annotations.reduce((acc, ann) => {
    const key =
      ann.documentId === 'manual-notes' ? 'Case Notes (Manual)' :
        ann.documentId === 'research-notes' ? 'Research Notes' :
          'PDF Annotations';
    if (!acc[key]) acc[key] = [];
    acc[key].push(formatAnnotation(ann));
    return acc;
  }, {} as Record<string, string[]>);

  const annotationsBlock = Object.entries(groupedAnnotations)
    .map(([category, items]) => `\n### ${category}\n${items.join('\n')}`)
    .join('\n') || 'No annotations available';

  const expertLabel = currentUser.name
    ? `${currentUser.name}${currentUser.qualifications ? `, ${currentUser.qualifications}` : ''}`
    : (currentUser.qualifications || 'Medical Expert');

  return {
    caseTitle: caseData.title,
    caseDescription: caseData.description || '',
    qualifications: expertLabel,
    documents: docs.map((d, i) => `${i + 1}. ${d.name}`).join('\n') || 'No documents listed',
    annotations: annotationsBlock,
    pdfTextContext: pdfTextContext || '',
    clinicalNotes: caseData.additionalContext || '',
    currentDraft: currentDraft || '',
    writerComments: writerComments || '',
    cvContent: cvContent || '',
  };
};

// ============================================================================
// CHAT WITH CLAUDE (Streaming)
// ============================================================================

/**
 * Chat with Claude for legal report drafting via the /api/legal-chat serverless endpoint.
 * Streams the response via SSE and calls onChunk with accumulated text.
 */
export const chatWithClaude = async (
  messages: LegalChatMessage[],
  caseContext: CaseContext,
  onChunk: (text: string) => void
): Promise<string> => {
  const apiMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const response = await fetch('/api/legal-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: apiMessages,
      caseContext,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return readSSEStream(response, onChunk);
};

// ============================================================================
// GENERATE REPORT (Streaming)
// ============================================================================

/**
 * Generate a full medical-legal report via the /api/generate-report serverless endpoint.
 * Streams the response via SSE and calls onChunk with accumulated text.
 */
export const generateReport = async (
  caseContext: CaseContext,
  templateId: string,
  onChunk: (text: string) => void
): Promise<string> => {
  const response = await fetch('/api/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseContext,
      templateId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return readSSEStream(response, onChunk);
};

// ============================================================================
// SUGGEST EDIT (JSON response — not streaming)
// ============================================================================

/**
 * Request structured edit suggestions from Claude via the /api/suggest-edit endpoint.
 * Returns an array of suggestions with original text, suggested replacement, and reason.
 */
export const suggestEdit = async (
  content: string,
  instruction: string,
  isSelection: boolean = false
): Promise<{ suggestions: SuggestionItem[] }> => {
  const response = await fetch('/api/suggest-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      instruction,
      isSelection,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return response.json();
};
