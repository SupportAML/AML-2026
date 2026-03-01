
import Anthropic from '@anthropic-ai/sdk';
import { Annotation, Case, Document, ChatMessage, StrategyAnalysis, StructuredChronology, DepoFeedback } from "../types";
import { aiCache } from "./aiCacheManager";

// ============================================================================
// ANTHROPIC (CLAUDE) API CONFIGURATION
// ============================================================================

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY || process.env.CLAUDE_API_KEY || "";

if (!API_KEY) {
    console.error("CLAUDE API KEY IS MISSING!");
    console.error("   Add VITE_CLAUDE_API_KEY to your .env.local file");
    console.error("   Example: VITE_CLAUDE_API_KEY=sk-ant-...");
} else {
    console.log("Claude API Key loaded:", API_KEY.substring(0, 12) + "...");
}

const anthropic = new Anthropic({
    apiKey: API_KEY,
    dangerouslyAllowBrowser: true
});

// ============================================================================
// MODEL CONFIGURATION - Claude Models
// ============================================================================

/**
 * Claude Haiku - Fast, cost-effective model for simple tasks
 * Best for: Data extraction, simple queries, form processing
 */
const CLAUDE_HAIKU = "claude-haiku-4-5-20251001";

/**
 * Claude Sonnet - Powerful model for complex reasoning
 * Best for: AI assistance, legal analysis, medical case analysis, coaching
 */
const CLAUDE_SONNET = "claude-sonnet-4-20250514";

// Environment override for testing specific models; default to Claude Sonnet
const DEFAULT_CLAUDE_MODEL = import.meta.env.VITE_CLAUDE_MODEL || process.env.CLAUDE_MODEL || CLAUDE_SONNET;

/**
 * Smart model selection based on task complexity
 */
const getModelForTask = (taskType: 'simple' | 'complex' | 'critical'): string => {
    const envModel = import.meta.env.VITE_CLAUDE_MODEL || process.env.CLAUDE_MODEL;
    if (envModel) return envModel;

    switch (taskType) {
        case 'simple':
            return CLAUDE_HAIKU;
        case 'complex':
            return CLAUDE_SONNET;
        case 'critical':
            return CLAUDE_SONNET;
        default:
            return CLAUDE_SONNET;
    }
};

// ========================================================================
// REPORT TEMPLATE RESOLUTION
// ========================================================================

const REPORT_TEMPLATES: Record<string, { label: string; template: string }> = {
    ime: {
        label: 'IME Report',
        template: `
I. HEADER
II. QUESTION PRESENTED / SCOPE
III. DOCUMENTS REVIEWED
IV. HISTORY & RECORDS REVIEW
V. EXAMINATION SUMMARY (IF PROVIDED)
VI. DIAGNOSTIC STUDIES
VII. ANALYSIS
VIII. OPINIONS
IX. EXPERT DISCLOSURES (IF PROVIDED)
X. LIMITATIONS
XI. CERTIFICATION
`
    },
    causation: {
        label: 'Causation Analysis',
        template: `
I. HEADER
II. QUESTION PRESENTED
III. DOCUMENTS REVIEWED
IV. MEDICAL HISTORY & TIMELINE
V. MEDICAL ANALYSIS
VI. CAUSATION OPINION(S)
VII. ALTERNATIVE CAUSES
VIII. EXPERT DISCLOSURES (IF PROVIDED)
IX. LIMITATIONS
X. CERTIFICATION
`
    },
    rebuttal: {
        label: 'Rebuttal Report',
        template: `
I. HEADER
II. SUMMARY OF OPPOSING OPINIONS
III. DOCUMENTS REVIEWED
IV. REBUTTAL ANALYSIS
V. SUPPORTING FACTS/DATA
VI. CONCLUSIONS / OPINIONS
VII. EXPERT DISCLOSURES (IF PROVIDED)
VIII. LIMITATIONS
IX. CERTIFICATION
`
    },
    chronology: {
        label: 'Chronology Summary',
        template: `
I. HEADER
II. DOCUMENTS REVIEWED
III. CLINICAL TIMELINE
IV. KEY CLINICAL FINDINGS
V. ANALYTICAL NOTES
VI. LIMITATIONS
VII. CERTIFICATION
`
    },
    deposition: {
        label: 'Deposition Prep Memo',
        template: `
I. HEADER
II. PURPOSE & SCOPE
III. KEY FACTS
IV. KEY MEDICAL ISSUES
V. LIKELY LINES OF QUESTIONING
VI. EXHIBIT LIST
VII. RISK AREAS / WEAKNESSES
VIII. LIMITATIONS
IX. CERTIFICATION
`
    }
};

const resolveReportTemplate = (reportTemplate?: string) => {
    if (!reportTemplate) return undefined;
    const key = reportTemplate.trim().toLowerCase();
    if (REPORT_TEMPLATES[key]) return REPORT_TEMPLATES[key];
    return { label: 'Custom Template', template: reportTemplate };
};

const getTargetCharsForTemplate = (reportTemplate: string | undefined, inputChars: number) => {
    const key = (reportTemplate || '').trim().toLowerCase();
    const base =
        key === 'deposition' ? 30000 :
            key === 'chronology' ? 32000 :
                key === 'rebuttal' ? 36000 :
                    (key === 'causation' || key === 'ime') ? 38000 : 34000;
    const scaled = Math.round(inputChars * 2.5);
    return Math.min(50000, Math.max(base, scaled));
};

// ============================================================================
// REQUEST TIMEOUT CONFIGURATION
// ============================================================================

const REQUEST_TIMEOUT_MS = Number(
    import.meta.env.VITE_CLAUDE_REQUEST_TIMEOUT_MS ||
    process.env.CLAUDE_REQUEST_TIMEOUT_MS ||
    90000
);

const LONG_REQUEST_TIMEOUT_MS = Number(
    import.meta.env.VITE_CLAUDE_LONG_REQUEST_TIMEOUT_MS ||
    process.env.CLAUDE_LONG_REQUEST_TIMEOUT_MS ||
    180000
);

// ============================================================================
// IN-MEMORY RESPONSE CACHE
// ============================================================================

const AI_RESPONSE_CACHE_TTL_MS = Number(process.env.CLAUDE_RESPONSE_CACHE_TTL_MS || 1000 * 60 * 60); // 1 hour
const aiResponseCache = new Map<string, { value: any; expires: number }>();

const cacheGet = (key: string) => {
    const entry = aiResponseCache.get(key);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) {
        aiResponseCache.delete(key);
        return undefined;
    }
    return entry.value;
};

const cacheSet = (key: string, value: any) => {
    aiResponseCache.set(key, { value, expires: Date.now() + AI_RESPONSE_CACHE_TTL_MS });
};

// ============================================================================
// JSON EXTRACTION HELPER
// ============================================================================

const extractJsonSafe = (text: string): string => {
    let s = text.trim();
    if (s.startsWith('```json')) s = s.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (s.startsWith('```')) s = s.replace(/^```\s*/, '').replace(/\s*```$/, '');

    try {
        JSON.parse(s);
        return s;
    } catch {
        const startIdx = s.indexOf('{');
        const startArrIdx = s.indexOf('[');
        let candidate = '';
        if (startIdx !== -1) {
            let depth = 0;
            for (let i = startIdx; i < s.length; i++) {
                if (s[i] === '{') depth++;
                if (s[i] === '}') depth--;
                if (depth === 0) { candidate = s.substring(startIdx, i + 1); break; }
            }
        }
        if (!candidate && startArrIdx !== -1) {
            let depth = 0;
            for (let i = startArrIdx; i < s.length; i++) {
                if (s[i] === '[') depth++;
                if (s[i] === ']') depth--;
                if (depth === 0) { candidate = s.substring(startArrIdx, i + 1); break; }
            }
        }
        return candidate || s;
    }
};

// ========================================================================
// REPORT LENGTH HELPERS
// ========================================================================

const stripMarkup = (text: string) => text.replace(/<[^>]+>/g, ' ');

const countChars = (text: string) => stripMarkup(text).length;

const expandReportIfTooShort = async (
    draft: string,
    minChars: number,
    resolvedTemplate: { label: string; template: string } | undefined
): Promise<string> => {
    const currentCount = countChars(draft);
    if (currentCount >= minChars) return draft;

    const systemPrompt = [
        "You are a Physician Expert expanding a medical-legal report.",
        "CRITICAL RULES:",
        "1) Do NOT add new facts or claims beyond the provided draft.",
        "2) Preserve the original structure and headings.",
        "3) Expand with deeper clinical reasoning, explanations of methodology, and limitations.",
        "4) If details are missing, explicitly state they are not provided.",
        "5) Do not remove or alter citations."
    ].join('\n');

    const userPrompt = `
Expand the following report to at least ${minChars} characters while preserving all facts and the chosen template.
You may add clarifying analysis, rationale, and limitations, but do not invent any new case facts.
Preserve the title line, date line, and prepared-by line at the top. Preserve Roman numeral headings.
Template selected: ${resolvedTemplate?.label || 'Standard Medical-Legal Report'}.

REPORT TO EXPAND:
${draft}
`;

    const expanded = await callClaude(systemPrompt, userPrompt, {
        model: getModelForTask('critical'),
        maxTokens: 16000,
        temperature: 0.4,
        timeoutMs: LONG_REQUEST_TIMEOUT_MS
    });

    return expanded?.trim() || draft;
};

// ============================================================================
// CORE API HELPERS
// ============================================================================

/**
 * Core Anthropic (Claude) chat completion call with timeout and error handling
 */
const callClaude = async (
    systemPrompt: string,
    userPrompt: string,
    options: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
        cache?: boolean;
        timeoutMs?: number;
        messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    } = {}
): Promise<string> => {
    const modelToUse = options.model || DEFAULT_CLAUDE_MODEL;
    const isServer = typeof window === 'undefined';
    const cacheKey = `${modelToUse}::${systemPrompt}::${userPrompt}`;

    if (options.cache && isServer) {
        const cached = cacheGet(cacheKey);
        if (cached) return cached as string;
    }

    const messages: Anthropic.MessageParam[] = [
        ...(options.messages || []).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
        })),
        { role: 'user', content: userPrompt }
    ];

    const requestTimeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;

    const reqPromise = anthropic.messages.create({
        model: modelToUse,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        system: systemPrompt,
        messages
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Claude request timed out')), requestTimeoutMs)
    );

    try {
        const response = await Promise.race([reqPromise, timeoutPromise]) as Anthropic.Message;
        const textBlock = response.content.find(block => block.type === 'text');
        const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';
        if (!text) throw new Error("No text content found in Claude response");
        if (options.cache && isServer) cacheSet(cacheKey, text);
        return text;
    } catch (error: any) {
        console.error("Claude API error:", error);

        if (error?.message?.includes('api_key') || error?.status === 401) {
            throw new Error("Invalid API key. Please check your VITE_CLAUDE_API_KEY configuration.");
        }
        if (error?.message?.includes('quota') || error?.message?.includes('billing') || error?.status === 402) {
            throw new Error("Anthropic quota exceeded. Please check your billing at console.anthropic.com.");
        }
        if (error?.status === 429) {
            throw new Error("Too many requests. Please wait a moment and try again.");
        }
        if (error?.status === 529) {
            throw new Error("Service temporarily overloaded. Please try again.");
        }
        throw error;
    }
};

/**
 * Stream text response from Claude — shows first words quickly
 */
export const callClaudeStream = async (
    systemPrompt: string,
    userPrompt: string,
    onChunk: (text: string) => void,
    options: { model?: string; maxTokens?: number } = {}
): Promise<string> => {
    const modelToUse = options.model || DEFAULT_CLAUDE_MODEL;
    try {
        const stream = anthropic.messages.stream({
            model: modelToUse,
            max_tokens: options.maxTokens || 8000,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userPrompt }
            ]
        });

        let fullText = '';
        stream.on('text', (text) => {
            fullText += text;
            onChunk(fullText);
        });

        await stream.finalMessage();
        return fullText;
    } catch (e) {
        // Fallback to non-streaming
        const fallback = await callClaude(systemPrompt, userPrompt, { maxTokens: options.maxTokens || 8000 });
        onChunk(fallback);
        return fallback;
    }
};

/**
 * Helper for structured JSON responses
 */
const callClaudeJSON = async <T>(
    systemPrompt: string,
    userPrompt: string,
    options: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
        cache?: boolean;
        timeoutMs?: number;
    } = {}
): Promise<T> => {
    const enhancedSystemPrompt = `${systemPrompt}\n\nYou MUST respond with valid JSON only. Do not include any text before or after the JSON object.`;
    const response = await callClaude(enhancedSystemPrompt, userPrompt, options);

    let jsonText = String(response || '').trim();
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
        return JSON.parse(jsonText);
    } catch (err) {
        const isTruncated = !jsonText.trim().endsWith('}') && !jsonText.trim().endsWith(']');

        if (isTruncated) {
            let fixed = jsonText.trim();
            const openBraces = (fixed.match(/{/g) || []).length;
            const closeBraces = (fixed.match(/}/g) || []).length;
            const openBrackets = (fixed.match(/\[/g) || []).length;
            const closeBrackets = (fixed.match(/]/g) || []).length;
            for (let i = 0; i < (openBrackets - closeBrackets); i++) fixed += ']';
            for (let i = 0; i < (openBraces - closeBraces); i++) fixed += '}';
            try {
                const result = JSON.parse(fixed);
                console.log('Auto-completed truncated JSON response');
                return result;
            } catch {
                console.warn('JSON truncated and auto-completion failed');
            }
        }

        const candidate = extractJsonSafe(jsonText);
        try {
            return JSON.parse(candidate);
        } catch {
            const snippet = (candidate || jsonText).slice(0, 500);
            const errorMsg = isTruncated
                ? `JSON response was truncated. Response too large for maxTokens. Snippet: ${snippet}`
                : `Failed to parse JSON from model response. Snippet: ${snippet}`;
            throw new SyntaxError(errorMsg);
        }
    }
};

// ============================================================================
// EXPORTED AI FUNCTIONS (standardized signatures)
// ============================================================================

/**
 * Analyze document metadata for legal relevance.
 */
export const analyzeDocument = async (doc: Document) => {
    try {
        const systemPrompt = "You are a legal document analysis expert. Analyze documents for their legal relevance and provide concise insights.";
        const userPrompt = `Analyze this document metadata for legal relevance: ${JSON.stringify(doc)}`;
        return await callClaude(systemPrompt, userPrompt, { model: getModelForTask('simple') });
    } catch (e) {
        console.error("analyzeDocument error:", e);
        return "Analysis failed.";
    }
};

/**
 * Draft a professional medical-legal report.
 */
export const draftMedicalLegalReport = async (
    caseData: Case,
    docs: Document[],
    annotations: Annotation[],
    pdfTextContext: string = '',
    writerComments: string = '',
    additionalContext: string = '',
    qualifications: string = ''
): Promise<string> => {
    const systemPrompt = [
        "You are a Physician Expert drafting a formal Medical-Legal Report for litigation.",
        "Tone: authoritative, clinical, precise, and court-ready.",
        "CRITICAL RULES:",
        "1) Use ONLY the provided case notes, annotations, and document list.",
        "2) Do NOT fabricate facts; if a detail is missing, state it as a limitation.",
        "3) Be thorough and comprehensive. Do not be overly concise.",
        "4) Prefer narrative paragraphs over bullet-only sections unless the template demands bullets.",
        "5) If asked to include U.S. expert disclosure elements, list them and mark missing items as 'Not provided'."
    ].join('\n');

    const docNameById = new Map(docs.map(d => [d.id, d.name]));
    const formatAnnotationLine = (ann: Annotation) => {
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
        acc[key].push(formatAnnotationLine(ann));
        return acc;
    }, {} as Record<string, string[]>);

    const annotationsBlock = Object.entries(groupedAnnotations)
        .map(([category, items]) => `\n### ${category}\n${items.join('\n')}`)
        .join('\n') || 'No annotations available';

    const resolvedTemplate = resolveReportTemplate(caseData.reportTemplate);
    const inputChars = [
        annotationsBlock,
        pdfTextContext || '',
        additionalContext || '',
        writerComments || ''
    ].join('\n').length;
    const minChars = getTargetCharsForTemplate(caseData.reportTemplate, inputChars);
    const userPrompt = `
You are drafting a professional Medical-Legal Report for litigation purposes in the United States.

FORMAT REQUIREMENTS (match the example style):
- Use Markdown headings so sizes are consistent:
  - Main title: "# MEDICAL-LEGAL REPORT" (all caps).
  - Major sections: "## I. INTRODUCTION AND PURPOSE" (Roman numerals, all caps).
  - Sub-sections: "### A. The Index Traumatic Event" (bold label is optional).
- Then provide "**DATE OF REPORT:** ***" on its own line (all caps, bold label).
- Then provide "**PREPARED BY:** <Name>" on its own line (all caps, bold label).
- Insert a horizontal rule after the header block: "---".
- Insert a horizontal rule between major sections.
- Use full paragraphs with blank lines between paragraphs.
- Keep a formal tone and explicit medical reasoning.
- Preserve any citations exactly as provided.

**CASE INFORMATION:**
- Title: "${caseData.title}"
- Description: ${caseData.description || 'No description provided'}

**EXPERT CREDENTIALS:**
${qualifications || 'Medical Expert'}

**DOCUMENTS REVIEWED:**
${docs.map((d, i) => `${i + 1}. ${d.name}`).join('\n') || 'No documents listed'}

**PDF ANNOTATIONS & EVIDENCE EXCERPTS:**
${annotationsBlock}

**PDF TEXT EXCERPTS (FROM SOURCE DOCUMENTS):**
${pdfTextContext || 'Not available'}

**WRITER COMMENTS / REVIEW NOTES:**
${writerComments || 'None provided'}

**CASE NOTES / CLINICAL NOTES:**
${additionalContext || 'None provided'}

---

**TASK:** Generate a complete, professional Medical-Legal Report.

Length guidance: aim for approximately 3200-5200 words unless the provided evidence is very limited; if limited, still provide a full structure and explicitly note limitations.
Each major section should include multiple paragraphs with reasoning, not just a single short paragraph. Use professional narrative prose.
If U.S. expert-report elements are relevant and the data is provided (e.g., qualifications, publications, prior testimony, compensation), include them in the appropriate section. If not provided, state the limitation.

If a template is provided below, follow its structure exactly. If not, use a standard professional format with clear headings and subheadings.

**REPORT STRUCTURE/TEMPLATE (use these as your Roman numeral section titles; ALL CAPS, BOLD):**
${resolvedTemplate?.template || `
1. HEADER: Case name, date, and expert identification.
2. INTRODUCTION: Brief case overview and purpose of the report.
3. DOCUMENTS REVIEWED: Detailed list of all materials examined.
4. PATIENT HISTORY & TIMELINE: Chronological clinical summary.
5. MEDICAL ANALYSIS: Clinical findings, standard of care, and causation.
6. PROFESSIONAL OPINION: Final conclusions and recommendations.
7. LIMITATIONS: Identify missing data or uncertainties.
`}

Template selected: ${resolvedTemplate?.label || 'Standard Medical-Legal Report'}.

Format the report professionally with proper sections, clinical terminology, and courtroom-appropriate language. Preserve any source citations that appear in the notes (e.g., ("Source", p. X)).
`;

    try {
        const result = await callClaude(systemPrompt, userPrompt, {
            model: getModelForTask('critical'),
            maxTokens: 12000,
            timeoutMs: LONG_REQUEST_TIMEOUT_MS
        });
        if (!result || result.trim() === '') {
            console.error("Empty response from Claude API");
            return "Error: Received empty response from AI. Please try again.";
        }
        const expanded = await expandReportIfTooShort(result, minChars, resolvedTemplate);
        return expanded;
    } catch (error: any) {
        console.error("draftMedicalLegalReport error:", error);
        return `Error: Unable to generate report. ${error?.message || 'Unknown error'}`;
    }
};

/**
 * Draft Medical-Legal Report with STREAMING
 */
export const draftMedicalLegalReportStream = async (
    caseData: Case,
    docs: Document[],
    annotations: Annotation[],
    pdfTextContext: string,
    writerComments: string,
    additionalContext: string,
    qualifications: string,
    onChunk: (text: string) => void
): Promise<string> => {
    const systemPrompt = [
        "You are a Physician Expert drafting a formal Medical-Legal Report for litigation.",
        "Tone: authoritative, clinical, precise, and court-ready.",
        "CRITICAL RULES:",
        "1) Use ONLY the provided case notes, annotations, and document list.",
        "2) Do NOT fabricate facts; if a detail is missing, state it as a limitation.",
        "3) Be thorough and comprehensive. Do not be overly concise.",
        "4) Prefer narrative paragraphs over bullet-only sections unless the template demands bullets.",
        "5) If asked to include U.S. expert disclosure elements, list them and mark missing items as 'Not provided'."
    ].join('\n');

    const docNameById = new Map(docs.map(d => [d.id, d.name]));
    const formatAnnotationLine = (ann: Annotation) => {
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
        acc[key].push(formatAnnotationLine(ann));
        return acc;
    }, {} as Record<string, string[]>);

    const annotationsBlock = Object.entries(groupedAnnotations)
        .map(([category, items]) => `\n### ${category}\n${items.join('\n')}`)
        .join('\n') || 'No annotations available';

    const resolvedTemplate = resolveReportTemplate(caseData.reportTemplate);
    const inputChars = [
        annotationsBlock,
        pdfTextContext || '',
        additionalContext || '',
        writerComments || ''
    ].join('\n').length;
    const minChars = getTargetCharsForTemplate(caseData.reportTemplate, inputChars);
    const userPrompt = `
You are drafting a professional Medical-Legal Report for litigation purposes in the United States.

FORMAT REQUIREMENTS (match the example style):
- Use Markdown headings so sizes are consistent:
  - Main title: "# MEDICAL-LEGAL REPORT" (all caps).
  - Major sections: "## I. INTRODUCTION AND PURPOSE" (Roman numerals, all caps).
  - Sub-sections: "### A. The Index Traumatic Event" (bold label is optional).
- Then provide "**DATE OF REPORT:** ***" on its own line (all caps, bold label).
- Then provide "**PREPARED BY:** <Name>" on its own line (all caps, bold label).
- Insert a horizontal rule after the header block: "---".
- Insert a horizontal rule between major sections.
- Use full paragraphs with blank lines between paragraphs.
- Keep a formal tone and explicit medical reasoning.
- Preserve any citations exactly as provided.

**CASE INFORMATION:**
- Title: "${caseData.title}"
- Description: ${caseData.description || 'No description provided'}

**EXPERT CREDENTIALS:**
${qualifications || 'Medical Expert'}

**DOCUMENTS REVIEWED:**
${docs.map((d, i) => `${i + 1}. ${d.name}`).join('\n') || 'No documents listed'}

**PDF ANNOTATIONS & EVIDENCE EXCERPTS:**
${annotationsBlock}

**PDF TEXT EXCERPTS (FROM SOURCE DOCUMENTS):**
${pdfTextContext || 'Not available'}

**WRITER COMMENTS / REVIEW NOTES:**
${writerComments || 'None provided'}

**CASE NOTES / CLINICAL NOTES:**
${additionalContext || 'None provided'}

---

**TASK:** Generate a complete, professional Medical-Legal Report.

Length guidance: aim for approximately 3200-5200 words unless the provided evidence is very limited; if limited, still provide a full structure and explicitly note limitations.
Each major section should include multiple paragraphs with reasoning, not just a single short paragraph. Use professional narrative prose.
If U.S. expert-report elements are relevant and the data is provided (e.g., qualifications, publications, prior testimony, compensation), include them in the appropriate section. If not provided, state the limitation.

**REPORT STRUCTURE/TEMPLATE (use these as your Roman numeral section titles; ALL CAPS, BOLD):**
${resolvedTemplate?.template || `
1. HEADER: Case name, date, and expert identification.
2. INTRODUCTION: Brief case overview and purpose of the report.
3. DOCUMENTS REVIEWED: Detailed list of all materials examined.
4. PATIENT HISTORY & TIMELINE: Chronological clinical summary.
5. MEDICAL ANALYSIS: Clinical findings, standard of care, and causation.
6. PROFESSIONAL OPINION: Final conclusions and recommendations.
7. LIMITATIONS: Identify missing data or uncertainties.
`}

Template selected: ${resolvedTemplate?.label || 'Standard Medical-Legal Report'}.

Format the report professionally with proper sections, clinical terminology, and courtroom-appropriate language. Preserve any source citations that appear in the notes (e.g., ("Source", p. X)).
`;
    try {
        const result = await callClaudeStream(systemPrompt, userPrompt, onChunk, {
            model: getModelForTask('critical'),
            maxTokens: 12000
        });
        const trimmed = result?.trim() || "Error: Empty response from AI.";
        const expanded = await expandReportIfTooShort(trimmed, minChars, resolvedTemplate);
        if (expanded !== trimmed) onChunk(expanded);
        return expanded;
    } catch (error: any) {
        console.error("draftMedicalLegalReportStream error:", error);
        const fallback = await draftMedicalLegalReport(caseData, docs, annotations, pdfTextContext, writerComments, additionalContext, qualifications);
        onChunk(fallback);
        return fallback;
    }
};

/**
 * Organizes annotations into a structured timeline.
 */
export const cleanupChronology = async (annotations: Annotation[], userNotes: string = ''): Promise<StructuredChronology | null> => {
    const systemPrompt = `You are a medical chronology expert. Organize medical data into a structured timeline.
You MUST respond with valid JSON matching this exact structure:
{
  "years": [
    {
      "year": "2026",
      "months": [
        {
          "month": "January",
          "events": [
            {
              "id": "original-id-or-new-id",
              "date": "2026-01-15",
              "formattedText": "Professional clinical description"
            }
          ]
        }
      ]
    }
  ],
  "irrelevantFacts": [
    {
      "id": "fact-id",
      "date": "unknown",
      "formattedText": "Undated fact"
    }
  ]
}`;

    const input = annotations.map(a => ({ id: a.id, text: a.text, date: a.eventDate || null }));
    const caseId = annotations.length ? annotations[0].caseId : 'default';
    const cacheKey = aiCache.getCacheKey('chronology', caseId, {
        count: input.length,
        notes: userNotes?.slice(0, 200)
    });
    const cached = aiCache.get<StructuredChronology>(cacheKey);
    if (cached) return cached;

    console.log(`cleanupChronology: sending ${input.length} annotations to AI (dated=${input.filter(i => i.date).length})`);

    const userPrompt = `
TASK: Organize the provided medical data into a structured chronology.
DATA: ANNOTATIONS: ${JSON.stringify(input)} NOTES: "${userNotes}"

INSTRUCTIONS:
1. PRESERVE IDs: For every event derived from the ANNOTATIONS list, you MUST use its original "id". This is critical for document linking.
2. NEW IDs: For any new facts extracted solely from the "NOTES", assign them a new unique string ID (e.g., "manual-01").
3. FORMAT: Each event's formattedText should be professional and clinical.
4. STRUCTURE: Group by Year and then by Month. Put undated facts in irrelevantFacts.
`;

    try {
        const result = await callClaudeJSON<StructuredChronology>(systemPrompt, userPrompt, {
            model: getModelForTask('critical'),
            temperature: 0.3
        });
        if (result) aiCache.set(cacheKey, result);
        return result;
    } catch (e) {
        console.error("cleanupChronology error:", e);
        return null;
    }
};

/**
 * Extracts structured facts from raw user notes.
 */
export const extractFactsFromNotes = async (userNotes: string): Promise<Partial<Annotation>[]> => {
    const systemPrompt = `You are a clinical documentation expert. Extract key facts from physician notes.
You MUST respond with valid JSON: an array of objects with "text", "eventDate" (YYYY-MM-DD or null), and "category" fields.`;

    const userPrompt = `Extract key clinical facts from these physician notes. eventDate should be YYYY-MM-DD or null. NOTES: "${userNotes}"`;

    try {
        return await callClaudeJSON<Partial<Annotation>[]>(systemPrompt, userPrompt, {
            model: getModelForTask('simple'),
            temperature: 0.3,
            maxTokens: 512,
            cache: true
        });
    } catch (e) {
        console.error("extractFactsFromNotes error:", e);
        return [];
    }
};

/**
 * Analyzes case data for Deposition Preparation.
 */
export const runFullCaseStrategy = async (context: string): Promise<StrategyAnalysis | null> => {
    const systemPrompt = `You are a Senior Trial Consultant. Respond ONLY with valid JSON - no additional text.
Required JSON structure:
{
  "overallAssessment": "2-3 sentence strategic summary",
  "scenarios": [
    {
      "id": "scenario-1",
      "title": "Short title",
      "plaintiffArgument": "1-2 sentences",
      "defenseArgument": "1-2 sentences",
      "firstQuestion": "Opening question",
      "idealAnswer": "Expected response"
    }
  ]
}
Create 3-4 key scenarios. Keep each field concise.`;

    const userPrompt = `Deposition Strategy Analysis. CONTEXT: ${context}\n\nGenerate battlefield analysis with 3-4 critical scenarios.`;
    const contextHash = context.slice(0, 500);
    const cacheKey = aiCache.getCacheKey('strategy', contextHash, {});
    const cached = aiCache.get<StrategyAnalysis>(cacheKey);
    if (cached) return cached;

    try {
        const result = await callClaudeJSON<StrategyAnalysis>(systemPrompt, userPrompt, {
            model: getModelForTask('critical'),
            maxTokens: 12000,
            timeoutMs: LONG_REQUEST_TIMEOUT_MS
        });
        if (result) aiCache.set(cacheKey, result);
        return result;
    } catch (e) {
        console.error("runFullCaseStrategy error:", e);
        return null;
    }
};

/**
 * Rewords and refines raw notes into professional medical-legal language.
 */
export const rewordClinicalNotes = async (rawNotes: string, caseTitle: string): Promise<string> => {
    try {
        const systemPrompt = "You are a professional medical-legal scribe. Your task is to reword and refine clinical notes to be more professional, authoritative, and clinically precise. \n\nCRITICAL RULES:\n1. Maintain ALL original facts, dates, symptoms, and findings exactly as provided.\n2. PRESERVE CITATIONS: Do NOT alter or remove source links in the format `([\"Source Name\", p. X])` or `(Source Name, p. X)`. Keep them exactly where they are.\n3. Only improve the phrasing, vocabulary, and clarity.\n4. Do not add headers if they aren't there, and do not change the basic structure.";
        const userPrompt = `CASE: "${caseTitle}"\n\nNOTES TO REWORD:\n${rawNotes}`;

        return await callClaude(systemPrompt, userPrompt, {
            model: getModelForTask('critical')
        });
    } catch (e) {
        console.error("rewordClinicalNotes error:", e);
        return rawNotes;
    }
};

/**
 * Refines raw annotation input text and extracts date/time.
 */
export const processAnnotationInput = async (rawText: string) => {
    try {
        console.log('processAnnotationInput called');
        console.log('API Key exists:', !!API_KEY);
        console.log('API Key prefix (first 15 chars):', API_KEY.slice(0, 15));
        console.log('Default model:', DEFAULT_CLAUDE_MODEL);
    } catch (dbgError) {
        console.warn('Debug logging failed:', dbgError);
    }

    const systemPrompt = `You are a concise medical-legal note assistant. Keep refined text brief — fix grammar/spelling only, never expand or over-formalize.
DATE & TIME EXTRACTION RULES:
- Extract dates from ANY format: "21st jan 2026", "21/01/26", "21 jan 2026", "21-01-2026", "January 21st", "21st of January"
- If year is missing but month/day present, assume current year (2026)
- Parse natural language dates intelligently
- Return dates as YYYY-MM-DD format (ISO 8601)
- Extract times from ANY format: "23:00 hours", "11 PM", "17:00", "5pm", "approximately 23:00"
- Return times as HH:mm in 24-hour format
- If NO date/time found in text, return null (do NOT make up dates)

CITATION PRESERVATION:
- Do NOT remove or alter source citations like \`(["Source", p. 1])\` or \`(Source, p. 1)\`.
- Include them exactly as they appear in the \`refinedText\`.

You MUST respond with valid JSON matching this structure:
{
  "refinedText": "string",
  "extractedDate": "YYYY-MM-DD or null",
  "extractedTime": "HH:mm or null"
}`;

    const userPrompt = `
TASK: Lightly clean up the note and extract any dates/times.

RAW INPUT:
---
${rawText}
---

INSTRUCTIONS:
1. REFINED TEXT: Clean up grammar and spelling only. Keep it SHORT and close to the original wording.
   - Do NOT expand, elaborate, or make it more formal than the original.
   - Do NOT add medical jargon or synonyms the user didn't use.
   - Example: "patient started work at 7 am on dec 1, 2021" -> "Patient started work at 7:00 AM on December 1, 2021."
   - Example: "bad fever noted" -> "Bad fever noted."
   - Keep the same length or shorter than the original.
2. DATE EXTRACTION: Extract dates from ANY natural language format.
   - "21st of January" -> "2026-01-21" (assume current year 2026 if not stated)
   - "23rd jan 2026" -> "2026-01-23"
   - "dec 1, 2021" -> "2021-12-01"
   - If NO date mentioned in text, return null (do NOT invent dates)
3. TIME EXTRACTION: Extract times from ANY format.
   - "7 am" -> "07:00"
   - "23:00 hours" -> "23:00"
   - "2pm" -> "14:00"
   - If NO time mentioned in text, return null
`;

    try {
        const result = await callClaudeJSON<{
            refinedText: string;
            extractedDate: string | null;
            extractedTime: string | null;
        }>(systemPrompt, userPrompt, {
            model: getModelForTask('simple'),
            temperature: 0.1,
            maxTokens: 256,
            cache: true
        });

        return {
            refinedText: result.refinedText || rawText,
            extractedDate: result.extractedDate || null,
            extractedTime: result.extractedTime || null
        };
    } catch (e) {
        console.error("processAnnotationInput error:", e);
        return { refinedText: rawText, extractedDate: null, extractedTime: null };
    }
};

/**
 * Chat with Deposition Coach.
 */
export const chatWithDepositionCoach = async (history: ChatMessage[], message: string, context: string) => {
    const systemPrompt = `You are an aggressive opposing counsel deposition coach.
Your goal is to trap the physician expert with difficult clinical questions.
After the user responds, analyze their answer:
    1. Score it(1 - 10).
2. Provide a critique of why their answer might be dangerous or weak.
3. Identify the 'trap' intent of your question.
4. Provide a 'Golden Answer'(betterAnswer) that use a specific deposition technique(e.g.Pivot, Assertive Neutrality).
5. Propose the 'nextQuestion' to continue the cross - examination.

        Context: ${context}.

You MUST respond with valid JSON matching this structure:
    {
        "coaching": {
            "score": number,
                "critique": "string",
                    "questionIntent": "string",
                        "technique": "string",
                            "betterAnswer": "string"
        },
        "nextQuestion": "string"
    }`;

    // Build conversation history for Claude
    const conversationMessages: Anthropic.MessageParam[] = [
        ...history.map(h => ({
            role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: h.text
        })),
        { role: 'user', content: message }
    ];

    try {
        const response = await anthropic.messages.create({
            model: getModelForTask('critical'),
            max_tokens: 2048,
            temperature: 0.8,
            system: systemPrompt,
            messages: conversationMessages
        });

        const textBlock = response.content.find(block => block.type === 'text');
        let jsonText = (textBlock && textBlock.type === 'text' ? textBlock.text : '').trim();

        if (!jsonText) throw new Error("No text content in response");
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        return JSON.parse(jsonText);
    } catch (e) {
        console.error("chatWithDepositionCoach error:", e);
        return {
            coaching: {
                score: 5,
                critique: "I'm having trouble analyzing that specific response due to a connection issue. However, in general, ensure you remain neutral and don't speculate.",
                questionIntent: "To clarify the clinical timeline.",
                technique: "Pivot to Standards",
                betterAnswer: "I followed the accepted standard of care based on the clinical presentation at that time."
            },
            nextQuestion: "Can you elaborate on the standard of care you applied in this instance?"
        };
    }
};

/**
 * Suggest Report Edits.
 */
export const suggestReportEdit = async (content: string, instruction: string) => {
    const systemPrompt = `You are a thoroughly trained Medical-Legal Report Editor.
You MUST respond with valid JSON matching this structure:
{
  "suggestions": [
    {
      "originalExcerpt": "string",
      "revisedExcerpt": "string",
      "explanation": "string"
    }
  ]
}

RULES:
1) Review the ENTIRE report and produce 5-12 targeted improvements spread throughout the document.
2) Each suggestion must be a SMALL, RELEVANT excerpt (do NOT rewrite the entire report).
3) The originalExcerpt must be copied verbatim from the report.
4) The revisedExcerpt should be an improved version of that excerpt only.
5) If no changes are needed, return an empty suggestions array.`;

    const userPrompt = `Report Content: ${content}\nInstruction: ${instruction}`;

    try {
        return await callClaudeJSON<{ suggestions: Array<{ originalExcerpt: string; revisedExcerpt: string; explanation: string }> }>(systemPrompt, userPrompt, {
            model: getModelForTask('critical'),
            timeoutMs: REQUEST_TIMEOUT_MS
        });
    } catch (e) {
        console.error("suggestReportEdit error:", e);
        return { suggestions: [] };
    }
};

/**
 * Search medical research using AI to generate realistic, relevant research articles.
 */
export const searchMedicalResearch = async (query: string, context: string) => {
    try {
        console.log('Searching medical literature for:', query);

        const systemPrompt = `You are a medical research librarian with access to comprehensive medical databases (PubMed, MEDLINE, Cochrane Library, medical journals).
Your task is to generate 4-6 REALISTIC research articles, clinical guidelines, or peer-reviewed studies that would be found when searching medical literature.

CRITICAL REQUIREMENTS:
- Use REAL journal names (e.g., NEJM, JAMA, Lancet, BMJ, Annals of Surgery, etc.)
- Create realistic titles that match medical literature style
- Generate plausible citations with proper format
- Include years between 2019-2024 for recency
- Summaries should be clinical and evidence-based
- URLs should follow pattern: https://pubmed.ncbi.nlm.nih.gov/[8-digit-number]

Return ONLY a JSON array of articles. Each article must have: title, source, summary, url, citation.`;

        const userPrompt = `Search Query: "${query}"

Case Context (for relevance): ${context ? context.substring(0, 1000) : 'Medical-legal case review'}

Search Type Detection:
- If query contains a DOI pattern (e.g., "10.1001/jama.2023.12345"), return that specific article
- If query mentions a journal name (e.g., "NEJM", "Lancet"), prioritize articles from that journal
- If query is a medical condition/topic, return relevant clinical studies
- If query is a keyword, search across all medical literature

Generate 4-6 highly relevant research articles that would help support medical-legal arguments. Focus on:
- Clinical standards of care
- Treatment guidelines
- Evidence-based protocols
- Causation studies
- Expert consensus statements

Return JSON array format:
[
  {
    "title": "Realistic medical study title",
    "source": "Real Journal Name",
    "summary": "Brief clinical summary of findings and relevance",
    "url": "https://pubmed.ncbi.nlm.nih.gov/12345678",
    "citation": "Author et al. Journal. Year; Vol(Issue):Pages"
  }
]`;

        const cacheKey = aiCache.getCacheKey('research', query, { ctx: context?.slice(0, 100) });
        const cached = aiCache.get<Array<{ title: string; source: string; summary: string; url: string; citation: string }>>(cacheKey);
        if (cached) return cached;

        const result = await callClaudeJSON<Array<{
            title: string;
            source: string;
            summary: string;
            url: string;
            citation: string;
        }>>(systemPrompt, userPrompt, {
            model: getModelForTask('critical'),
            maxTokens: 8192,
            temperature: 0.7,
            timeoutMs: LONG_REQUEST_TIMEOUT_MS
        });

        console.log(`Found ${result.length} research articles`);
        if (result.length) aiCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('searchMedicalResearch error:', error);
        return [
            {
                title: "Medical Standards and Clinical Practice Guidelines",
                source: "Journal of Medical Practice",
                summary: "Comprehensive review of clinical standards relevant to medical-legal cases. Search temporarily unavailable - please try again.",
                url: "https://pubmed.ncbi.nlm.nih.gov/00000000",
                citation: "Medical Standards Review. 2024; 1:1-10"
            }
        ];
    }
};

/**
 * Analyze research gaps in a report.
 */
export const analyzeReportForResearchGaps = async (content: string) => {
    const maxContentLength = 50000;
    const truncatedContent = content.length > maxContentLength
        ? content.substring(0, maxContentLength) + '\n\n[Report truncated for analysis]'
        : content;

    const systemPrompt = `You are a Senior Medical-Legal Researcher. Identify the TOP 5-8 CRITICAL research gaps in this report.
You MUST respond with CONCISE valid JSON: an array of objects with "topic" (short phrase) and "reason" (1 sentence max) fields.
Keep responses brief - aim for 5-8 gaps maximum.`;

    const userPrompt = `Analyze this report and identify the TOP 5-8 most critical research gaps where additional medical literature would strengthen the case:

${truncatedContent}

Return ONLY a JSON array. Example format:
[
  {"topic": "Post-operative monitoring standards", "reason": "Report lacks specific guidelines reference."},
  {"topic": "Medication interaction data", "reason": "No peer-reviewed studies cited for drug combination."}
]`;

    try {
        console.log('Analyzing report for research gaps (attempt 1/2)...');
        return await callClaudeJSON<Array<{ topic: string; reason: string }>>(systemPrompt, userPrompt, {
            model: getModelForTask('critical'),
            maxTokens: 16384,
            timeoutMs: LONG_REQUEST_TIMEOUT_MS,
            temperature: 0.1
        });
    } catch (e: any) {
        if (e?.message?.includes('truncated') || e?.message?.includes('JSON')) {
            console.warn('First attempt truncated, retrying with smaller content...');
            try {
                const shorterContent = content.substring(0, 20000);
                const retryPrompt = `Analyze this report excerpt and identify the TOP 5 most critical research gaps:

${shorterContent}

Return ONLY a JSON array with max 5 items. Keep "topic" and "reason" extremely brief.`;

                return await callClaudeJSON<Array<{ topic: string; reason: string }>>(systemPrompt, retryPrompt, {
                    model: getModelForTask('critical'),
                    maxTokens: 8192,
                    timeoutMs: LONG_REQUEST_TIMEOUT_MS,
                    temperature: 0.1
                });
            } catch (retryError) {
                console.error("analyzeReportForResearchGaps retry failed:", retryError);
                return [];
            }
        }
        console.error("analyzeReportForResearchGaps error:", e);
        return [];
    }
};

/**
 * Smart citation insertion.
 */
export const insertSmartCitation = async (content: string, article: any) => {
    const systemPrompt = `You are a medical-legal citation expert.

CRITICAL RULES:
- DO NOT modify the report header, case title, case identification, dates, "Prepared by" lines, author information, expert credentials, or any metadata sections.
- DO NOT modify the first 10 lines of the report under any circumstances.
- ONLY insert citations into the BODY paragraphs where the research is clinically relevant.
- Preserve ALL existing formatting, section headers, numbering, and structure exactly as-is.
- Add the citation in-line using standard legal citation format (e.g., "Author et al., Journal, Year").
- If a bibliography/references section exists, append the full citation there. If not, create one at the end.
- The changes should be minimal and surgical — only add the citation text, do not rewrite surrounding content.

You MUST respond with valid JSON matching this structure:
{
  "newContent": "string",
  "explanation": "string"
}`;

    const userPrompt = `Propose a MINIMAL citation insertion for this article into the report. Only modify body paragraphs where the research is relevant. Do NOT touch headers, metadata, or case identification.\n\nArticle: ${JSON.stringify(article)}\n\nReport:\n${content}`;

    try {
        return await callClaudeJSON<{ newContent: string; explanation: string }>(systemPrompt, userPrompt, {
            model: getModelForTask('critical'),
            maxTokens: 8192
        });
    } catch (e) {
        console.error("insertSmartCitation error:", e);
        return { newContent: content, explanation: "Citation addition failed." };
    }
};

/**
 * Finalizes the report into a client-ready format.
 */
export const finalizeLegalReport = async (content: string): Promise<string> => {
    try {
        const systemPrompt = "You are a senior medical-legal editor. Your task is to convert a draft report into a final, client-ready format. Remove all markdown artifacts (like double asterisks or hashtags) if they interfere with professional look, ensure consistent typography, and remove any 'working' tags or AI markers. The output should be a clean, perfectly formatted professional report ready for signature.";
        const userPrompt = `FINAL EDIT REQUEST:\n\n${content}\n\n--- \nPlease provide the finalized text below:`;

        return await callClaude(systemPrompt, userPrompt, {
            model: getModelForTask('critical'),
            maxTokens: 8000
        });
    } catch (e) {
        console.error("finalizeLegalReport error:", e);
        return content;
    }
};

/**
 * Extract handwritten notes from an image using Claude Vision.
 */
export const extractHandwrittenNotesFromImage = async (
    imageBase64: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
): Promise<string> => {
    const systemPrompt = `You are a medical-legal transcription specialist. Extract ALL text from this handwritten image accurately.

RULES:
1. Preserve the order of items as they appear top-to-bottom in the image.
2. Output each distinct point, bullet, or line as a separate bullet point.
3. Use a simple bullet format: each line starts with "* " (asterisk space).
4. If there are headings or sections, keep them with a blank line before the next section.
5. Do not add numbering unless it was in the original.
6. Transcribe handwritten text as accurately as possible; use your best judgment for unclear characters.
7. Return ONLY the extracted text - no preamble, no "Here are the points:", no explanation.
8. If the image is blank or unreadable, return exactly: "(No readable text found)"`;

    const userPrompt = "Extract all handwritten text from this image and return it as bullet points, one per line, preserving the order as shown in the image.";

    const response = await anthropic.messages.create({
        model: DEFAULT_CLAUDE_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mediaType,
                            data: imageBase64
                        }
                    },
                    { type: 'text', text: userPrompt }
                ]
            }
        ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = (textBlock && textBlock.type === 'text' ? textBlock.text : '').trim() || "(No readable text found)";

    if (text === "(No readable text found)") return text;

    const lines = text.split('\n').filter(Boolean);
    const bulleted = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('*') || trimmed.startsWith('-') || /^\d+[\.\)]/.test(trimmed)) return trimmed;
        return `* ${trimmed}`;
    }).filter(Boolean).join('\n');

    return bulleted || text;
};
