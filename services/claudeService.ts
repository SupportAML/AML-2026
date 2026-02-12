
import Anthropic from '@anthropic-ai/sdk';
import { Annotation, Case, Document, ChatMessage, StrategyAnalysis, StructuredChronology, DepoFeedback } from "../types";
import { aiCache } from "./aiCacheManager";

// ============================================================================
// CLAUDE API CONFIGURATION
// ============================================================================

// Initialize the API with the key from environment variables
const API_KEY = process.env.CLAUDE_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY || "";

// Log API key status (first 10 chars only for security)
if (!API_KEY) {
    console.error("❌ ANTHROPIC API KEY IS MISSING!");
    console.error("   Add VITE_ANTHROPIC_API_KEY to your .env.local file");
    console.error("   Example: VITE_ANTHROPIC_API_KEY=sk-ant-api03-...");
} else {
    console.log("✅ Anthropic API Key loaded:", API_KEY.substring(0, 10) + "...");
}

const anthropic = new Anthropic({
    apiKey: API_KEY,
    dangerouslyAllowBrowser: true // Required for client-side usage
});

// ============================================================================
// MODEL CONFIGURATION - Valid Anthropic Models (as of 2026)
// ============================================================================

/**
 * HAIKU - Fast, cost-effective model for simple tasks
 * Best for: Data extraction, simple queries, form processing
 */
const CLAUDE_HAIKU = "claude-3-5-haiku-20241022";

/**
 * SONNET - Balanced model for complex reasoning
 * Best for: AI assistance, legal analysis, medical case analysis, coaching
 */
const CLAUDE_SONNET = "claude-3-5-sonnet-20241022";

/**
 * OPUS - Most capable model (if needed in future)
 */
const CLAUDE_OPUS = "claude-opus-4-6";

// Environment override for testing specific models
// Default to OPUS which your key has access to (safe fallback)
const DEFAULT_CLAUDE_MODEL = process.env.CLAUDE_MODEL || CLAUDE_OPUS;

/**
 * Smart model selection based on task complexity
 */
const getModelForTask = (taskType: 'simple' | 'complex' | 'critical'): string => {
    // Allow environment override
    if (process.env.CLAUDE_MODEL) {
        return process.env.CLAUDE_MODEL;
    }
    
    switch (taskType) {
        case 'simple':
            return CLAUDE_HAIKU;
        case 'complex':
            return CLAUDE_SONNET;
        case 'critical':
            return CLAUDE_OPUS;
        default:
            return CLAUDE_SONNET;
    }
};

// Expose available models for quick debug
const MODELS = {
    HAIKU: CLAUDE_HAIKU,
    SONNET: CLAUDE_SONNET,
    OPUS: CLAUDE_OPUS,
    DEFAULT: DEFAULT_CLAUDE_MODEL
};
let MODELS_VERIFIED = false;

// ============================================================================
// REQUEST TIMEOUT CONFIGURATION
// ============================================================================

/**
 * Default timeout for standard AI requests (90 seconds)
 */
const REQUEST_TIMEOUT_MS = Number(process.env.CLAUDE_REQUEST_TIMEOUT_MS || import.meta?.env?.VITE_CLAUDE_REQUEST_TIMEOUT_MS || 90000);

/**
 * Extended timeout for complex operations like deposition strategy, full case analysis (3 minutes)
 */
const LONG_REQUEST_TIMEOUT_MS = Number(process.env.CLAUDE_LONG_REQUEST_TIMEOUT_MS || import.meta?.env?.VITE_CLAUDE_LONG_REQUEST_TIMEOUT_MS || 180000);

/**
 * Fetch available models from Anthropic Models API and verify model ids.
 * Populates MODELS with authoritative ids when possible.
 * Uses x-api-key header (preferred) and falls back to Authorization Bearer if needed.
 */
const verifyAvailableModels = async (): Promise<void> => {
    if (MODELS_VERIFIED) return;
    const key = process.env.CLAUDE_API_KEY || import.meta?.env?.VITE_ANTHROPIC_API_KEY || '';
    if (!key) {
        console.warn('verifyAvailableModels: no API key found');
        return;
    }

    try {
        // include optional API version header if provided via env
        const apiVersionHeader = process.env.ANTHROPIC_API_VERSION || import.meta?.env?.VITE_ANTHROPIC_API_VERSION;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            // prefer x-api-key header per Anthropic docs examples
            'x-api-key': key,
            // also include Authorization as fallback for different setups
            'Authorization': `Bearer ${key}`
        };
        if (apiVersionHeader) headers['Anthropic-Version'] = apiVersionHeader;

        const res = await fetch('https://api.anthropic.com/v1/models', {
            method: 'GET',
            headers
        });

        if (!res.ok) {
            console.warn('verifyAvailableModels: model list fetch returned', res.status);
            return;
        }

        const body = await res.json();
        if (!body || !Array.isArray(body.models) && !Array.isArray(body)) {
            // older/newer shapes: try body.models or body
            const arr = Array.isArray(body.models) ? body.models : (Array.isArray(body) ? body : []);
            if (!arr.length) return;
        }

        const modelsArray = Array.isArray(body.models) ? body.models : (Array.isArray(body) ? body : []);
        // find candidate ids by keyword
        const findByKeyword = (keyword: string) => {
            const m = modelsArray.find((m: any) => typeof m.id === 'string' && m.id.toLowerCase().includes(keyword));
            return m ? m.id : undefined;
        };

        const haiku = findByKeyword('haiku');
        const sonnet = findByKeyword('sonnet');
        const opus = findByKeyword('opus') || findByKeyword('opus-4') || findByKeyword('opus-');

        if (haiku) MODELS.HAIKU = haiku;
        if (sonnet) MODELS.SONNET = sonnet;
        if (opus) MODELS.OPUS = opus;

        // set default if environment not set
        if (!process.env.CLAUDE_MODEL && MODELS.SONNET) MODELS.DEFAULT = MODELS.SONNET;

        MODELS_VERIFIED = true;
        console.log('verifyAvailableModels: MODELS updated', MODELS);
    } catch (e: any) {
        console.warn('verifyAvailableModels error:', e?.message || e);
    }
};

// ====================================================================
// Lightweight in-memory cache to reduce repeat Opus calls (server-side)
// ====================================================================
const AI_RESPONSE_CACHE_TTL_MS = Number(process.env.CLAUDE_RESPONSE_CACHE_TTL_MS || 1000 * 60 * 60); // 1 hour default
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

// Flexible request helper that falls back if the SDK/endpoint differs
const sendAnthropicRequest = async (opts: {
    model: string;
    max_tokens?: number;
    temperature?: number;
    system?: string;
    messages?: { role: string; content: string }[];
    input?: string;
}) => {
    // Prefer original messages.create if available (older SDKs)
    try {
        if ((anthropic as any).messages && typeof (anthropic as any).messages.create === 'function') {
            return await (anthropic as any).messages.create({
                model: opts.model,
                max_tokens: opts.max_tokens,
                temperature: opts.temperature,
                system: opts.system,
                messages: opts.messages
            });
        }

        // Fallback to responses.create (newer SDK)
        if ((anthropic as any).responses && typeof (anthropic as any).responses.create === 'function') {
            const inputText = opts.input ?? `${opts.system || ''}\n\n${(opts.messages || []).map(m => m.content).join('\n')}`;
            return await (anthropic as any).responses.create({
                model: opts.model,
                input: inputText,
                temperature: opts.temperature
            });
        }

        // As a last resort, attempt chat completions if provided by SDK
        if ((anthropic as any).chat && typeof (anthropic as any).chat.create === 'function') {
            return await (anthropic as any).chat.create({
                model: opts.model,
                messages: opts.messages,
                temperature: opts.temperature,
                max_tokens: opts.max_tokens
            });
        }

        throw new Error("No compatible Anthropic client methods found on SDK instance.");
    } catch (e) {
        // Re-throw with more context
        (e as any).message = `Anthropic request failed: ${(e as any).message || e}`;
        throw e;
    }
};

// Helper to attempt to extract a JSON substring from noisy AI responses
const extractJsonSafe = (text: string): string => {
    // Remove common markdown fences first
    let s = text.trim();
    if (s.startsWith('```json')) s = s.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (s.startsWith('```')) s = s.replace(/^```\s*/, '').replace(/\s*```$/, '');

    // Quick valid JSON check
    try {
        JSON.parse(s);
        return s;
    } catch {
        // attempt to find the largest balanced {...} or [...] substring
        const startIdx = s.indexOf('{');
        const startArrIdx = s.indexOf('[');
        let candidate = '';
        if (startIdx !== -1) {
            // find matching closing brace for first '{'
            let depth = 0;
            for (let i = startIdx; i < s.length; i++) {
                if (s[i] === '{') depth++;
                if (s[i] === '}') depth--;
                if (depth === 0) {
                    candidate = s.substring(startIdx, i + 1);
                    break;
                }
            }
        }
        if (!candidate && startArrIdx !== -1) {
            let depth = 0;
            for (let i = startArrIdx; i < s.length; i++) {
                if (s[i] === '[') depth++;
                if (s[i] === ']') depth--;
                if (depth === 0) {
                    candidate = s.substring(startArrIdx, i + 1);
                    break;
                }
            }
        }

        // Final fallback: return original trimmed text (caller will handle parse error)
        return candidate || s;
    }
};

/**
 * Helper to call Claude API with consistent error handling
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
    } = {}
): Promise<string> => {
    try {
        // Only verify models server-side to avoid CORS from the browser
        const isServer = (typeof window === 'undefined') || (typeof import.meta !== 'undefined' && !!(import.meta as any).env?.SSR);
        if (isServer) {
            await verifyAvailableModels();
        } else {
        // Running in browser - skip verifying models to avoid CORS/preflight issues
            // Rely on server-side env `CLAUDE_MODEL` or MODELS.DEFAULT set at build time
            // If an explicit model was requested from the browser but models aren't verified, try mapping common names
            // to the known MODELS entries instead of dropping the request entirely. This avoids unnecessary 404s
            // while still allowing intent (haiku/sonnet/opus) to be respected.
            if (options.model && !MODELS_VERIFIED) {
                const requested = String(options.model).toLowerCase();
                // Your environment currently only supports OPUS. To avoid 404s from Sonnet/Haiku
                // requests in the browser, map any non-OPUS requests to OPUS when models aren't verified.
                if (requested.includes('opus')) {
                    options.model = MODELS.OPUS || CLAUDE_OPUS;
                } else {
                    // Map Sonnet/Haiku/unknown to OPUS to guarantee a supported model
                    // eslint-disable-next-line no-console
                    console.warn('Browser requested model mapped to OPUS to avoid 404. Requested:', options.model);
                    options.model = MODELS.OPUS || CLAUDE_OPUS;
                }
            }
        }

        const modelToUse = options.model || MODELS.DEFAULT || DEFAULT_CLAUDE_MODEL;
        // Check cache (server-side only) when requested
        const cacheKey = `${modelToUse}::${systemPrompt}::${userPrompt}`;
        if (options.cache && isServer) {
            const cached = cacheGet(cacheKey);
            if (cached) return cached as string;
        }

        const requestTimeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
        const reqPromise = sendAnthropicRequest({
            model: modelToUse,
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature || 0.7,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            input: `${systemPrompt}\n\n${userPrompt}`
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Anthropic request timed out')), requestTimeoutMs));
        const response = await Promise.race([reqPromise, timeoutPromise]);

        // Parse different possible response shapes
        // Old SDK: response.content -> [{ type: 'text', text: '...' }]
        if (response && Array.isArray((response as any).content)) {
            const textBlock = (response as any).content.find((b: any) => b.type === 'text');
            if (textBlock && typeof textBlock.text === 'string') {
                if (options.cache && isServer) cacheSet(cacheKey, textBlock.text);
                return textBlock.text;
            }
        }

        // Newer SDK: response.output_text or response.output[0].content[0].text
        if ((response as any).output_text && typeof (response as any).output_text === 'string') {
            if (options.cache && isServer) cacheSet(cacheKey, (response as any).output_text);
            return (response as any).output_text;
        }

        if (Array.isArray((response as any).output)) {
            const firstOutput = (response as any).output[0];
            if (firstOutput && Array.isArray(firstOutput.content)) {
                const textPart = firstOutput.content.find((c: any) => c.type === 'output_text' || c.type === 'text');
                if (textPart && (textPart.text || textPart.content)) {
                    const out = textPart.text || textPart.content;
                    if (options.cache && isServer) cacheSet(cacheKey, out);
                    return out;
                }
            }
        }

        throw new Error("No text content found in Anthropic response");
    } catch (error: any) {
        console.error("Claude API error:", error);

        // Provide specific error messages
        if (error?.message?.includes('api_key')) {
            throw new Error("Invalid API key. Please check your configuration.");
        }
        if (error?.message?.includes('credit balance') || error?.message?.includes('billing')) {
            throw new Error("Anthropic API credit balance is too low. Please add funds at console.anthropic.com/settings/billing");
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
 * Stream text response from Claude - shows first words in 2-3s
 */
export const callClaudeStream = async (
    systemPrompt: string,
    userPrompt: string,
    onChunk: (text: string) => void,
    options: { model?: string; maxTokens?: number } = {}
): Promise<string> => {
    const modelToUse = options.model || MODELS.DEFAULT || DEFAULT_CLAUDE_MODEL;
    try {
        const stream = (anthropic as any).messages?.stream
            ? await (anthropic as any).messages.stream({
                model: modelToUse,
                max_tokens: options.maxTokens || 8000,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }]
            })
            : null;
        if (!stream) {
            const full = await callClaude(systemPrompt, userPrompt, { maxTokens: options.maxTokens || 8000 });
            onChunk(full);
            return full;
        }
        let fullText = '';
        stream.on('text', (delta: string, snapshot: string) => {
            fullText = snapshot;
            onChunk(snapshot);
        });
        await stream.finalMessage();
        return fullText;
    } catch (e) {
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

    // Extract JSON from response (handle potential markdown code blocks)
    let jsonText = String(response || '').trim();
    // First try simple trims
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Try direct parse
    try {
        return JSON.parse(jsonText);
    } catch (err) {
        // Check if response looks truncated (doesn't end with } or ])
        const isTruncated = !jsonText.trim().endsWith('}') && !jsonText.trim().endsWith(']');
        
        if (isTruncated) {
            // Try to auto-complete simple truncations silently
            let fixed = jsonText.trim();
            // Count opening and closing braces
            const openBraces = (fixed.match(/{/g) || []).length;
            const closeBraces = (fixed.match(/}/g) || []).length;
            const openBrackets = (fixed.match(/\[/g) || []).length;
            const closeBrackets = (fixed.match(/]/g) || []).length;
            
            // Add missing closing brackets/braces
            for (let i = 0; i < (openBrackets - closeBrackets); i++) fixed += ']';
            for (let i = 0; i < (openBraces - closeBraces); i++) fixed += '}';
            
            try {
                const result = JSON.parse(fixed);
                console.log('✅ Auto-completed truncated JSON response');
                return result;
            } catch (fixErr) {
                // Auto-completion failed - throw error with truncated flag to enable retry
                console.warn('⚠️ JSON truncated and auto-completion failed - caller should retry with smaller input');
            }
        }
        
        // Attempt to extract a JSON object/array safely
        const candidate = extractJsonSafe(jsonText);
        try {
            return JSON.parse(candidate);
        } catch (err2) {
            // Provide more helpful error with snippet for debugging
            const snippet = (candidate || jsonText).slice(0, 500);
            const errorMsg = isTruncated 
                ? `JSON response was truncated. Response too large for maxTokens. Snippet: ${snippet}`
                : `Failed to parse JSON from model response. Snippet: ${snippet}`;
            throw new SyntaxError(errorMsg);
        }
    }
};

/**
 * Analyze document metadata for legal relevance.
 * Uses HAIKU for fast, simple metadata analysis
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
 * Uses SONNET for complex medical-legal reasoning and report generation
 */
export const draftMedicalLegalReport = async (
    caseData: Case,
    docs: Document[],
    annotations: Annotation[],
    additionalContext: string = '',
    qualifications: string = ''
): Promise<string> => {
    const systemPrompt = "You are a Physician Expert drafting a formal Medical-Legal Report. Your tone is authoritative, clinical, and precise.";

    // Group annotations by category
    const groupedAnnotations = annotations.reduce((acc, ann) => {
        const key = ann.documentId === 'research-notes' ? 'Research' : 'Medical Records';
        if (!acc[key]) acc[key] = [];
        acc[key].push(`- [${ann.category}] ${ann.text} ${ann.eventDate ? `(Date: ${ann.eventDate})` : ''}`);
        return acc;
    }, {} as Record<string, string[]>);

    // Create a comprehensive prompt
    const userPrompt = `
You are drafting a professional Medical-Legal Report for litigation purposes.

**CASE INFORMATION:**
- Title: "${caseData.title}"
- Description: ${caseData.description || 'No description provided'}

**EXPERT CREDENTIALS:**
${qualifications || 'Medical Expert'}

**DOCUMENTS REVIEWED:**
${docs.map((d, i) => `${i + 1}. ${d.name}`).join('\n') || 'No documents listed'}

**CLINICAL EVIDENCE:**
${Object.entries(groupedAnnotations).map(([category, items]) =>
        `\n### ${category}\n${items.join('\n')}`
    ).join('\n') || 'No annotations available'}

**ADDITIONAL CONTEXT:**
${additionalContext || 'None provided'}

---

**TASK:** Generate a complete, professional Medical-Legal Report.

If a template is provided below, follow its structure exactly. If not, use the standard professional format.

**REPORT STRUCTURE/TEMPLATE:**
${caseData.reportTemplate || `
1. HEADER: Case name, date, and expert identification.
2. INTRODUCTION: Brief case overview and purpose of the report.
3. DOCUMENTS REVIEWED: Detailed list of all materials examined.
4. PATIENT HISTORY & TIMELINE: Chronological clinical summary.
5. MEDICAL ANALYSIS: Clinical findings, standard of care, and causation.
6. PROFESSIONAL OPINION: Final conclusions and recommendations.
`}

Format the report professionally with proper sections and clinical terminology.
`;

    try {
        const result = await callClaude(systemPrompt, userPrompt, { 
            model: getModelForTask('critical'),
            maxTokens: 8000,
            timeoutMs: LONG_REQUEST_TIMEOUT_MS // Extended timeout for long report generation
        });
        if (!result || result.trim() === '') {
            console.error("Empty response from Claude API");
            return "Error: Received empty response from AI. Please try again.";
        }
        return result;
    } catch (error: any) {
        console.error("draftMedicalLegalReport error:", error);
        return `Error: Unable to generate report. ${error?.message || 'Unknown error'}`;
    }
};

/**
 * Draft Medical-Legal Report with STREAMING - first words in 2-3s
 */
export const draftMedicalLegalReportStream = async (
    caseData: Case,
    docs: Document[],
    annotations: Annotation[],
    additionalContext: string,
    qualifications: string,
    onChunk: (text: string) => void
): Promise<string> => {
    const systemPrompt = "You are a Physician Expert drafting a formal Medical-Legal Report. Your tone is authoritative, clinical, and precise.";
    const groupedAnnotations = annotations.reduce((acc, ann) => {
        const key = ann.documentId === 'research-notes' ? 'Research' : 'Medical Records';
        if (!acc[key]) acc[key] = [];
        acc[key].push(`- [${ann.category}] ${ann.text} ${ann.eventDate ? `(Date: ${ann.eventDate})` : ''}`);
        return acc;
    }, {} as Record<string, string[]>);
    const userPrompt = `
You are drafting a professional Medical-Legal Report for litigation purposes.

**CASE INFORMATION:**
- Title: "${caseData.title}"
- Description: ${caseData.description || 'No description provided'}

**EXPERT CREDENTIALS:**
${qualifications || 'Medical Expert'}

**DOCUMENTS REVIEWED:**
${docs.map((d, i) => `${i + 1}. ${d.name}`).join('\n') || 'No documents listed'}

**CLINICAL EVIDENCE:**
${Object.entries(groupedAnnotations).map(([category, items]) => `\n### ${category}\n${items.join('\n')}`).join('\n') || 'No annotations available'}

**ADDITIONAL CONTEXT:**
${additionalContext || 'None provided'}

---

**TASK:** Generate a complete, professional Medical-Legal Report.

**REPORT STRUCTURE/TEMPLATE:**
${caseData.reportTemplate || `
1. HEADER: Case name, date, and expert identification.
2. INTRODUCTION: Brief case overview and purpose of the report.
3. DOCUMENTS REVIEWED: Detailed list of all materials examined.
4. PATIENT HISTORY & TIMELINE: Chronological clinical summary.
5. MEDICAL ANALYSIS: Clinical findings, standard of care, and causation.
6. PROFESSIONAL OPINION: Final conclusions and recommendations.
`}

Format the report professionally with proper sections and clinical terminology.
`;
    try {
        const result = await callClaudeStream(systemPrompt, userPrompt, onChunk, {
            model: getModelForTask('critical'),
            maxTokens: 8000
        });
        return result?.trim() || "Error: Empty response from AI.";
    } catch (error: any) {
        console.error("draftMedicalLegalReportStream error:", error);
        const fallback = await draftMedicalLegalReport(caseData, docs, annotations, additionalContext, qualifications);
        onChunk(fallback);
        return fallback;
    }
};

/**
 * Organizes annotations into a structured timeline.
 * Uses SONNET for complex medical chronology organization
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

    console.log(`cleanupChronology: sending ${input.length} annotations to AI (dated=${input.filter(i=>i.date).length})`);

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
 * Uses HAIKU for fast, simple data extraction
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
 * Uses SONNET for complex legal/strategic analysis (Attorney mode)
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
            maxTokens: 12000, // Increased to prevent truncation of complex strategy analysis
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
 * Uses SONNET for professional medical-legal writing
 */
export const rewordClinicalNotes = async (rawNotes: string, caseTitle: string): Promise<string> => {
    try {
        const systemPrompt = "You are a professional medical-legal scribe. Your task is to reword and refine clinical notes to be more professional, authoritative, and clinically precise. Maintain ALL original facts, dates, symptoms, and findings exactly as provided. Only improve the phrasing, vocabulary, and clarity. Do not add headers if they aren't there, and do not change the basic structure.";
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
 * Refines raw annotation input text.
 * Uses HAIKU for fast text refinement and date/time extraction
 */
export const processAnnotationInput = async (rawText: string) => {
    // 🔍 DEBUG INFO: surface API key + model selection to browser console
    try {
        console.log('🔍 DEBUG INFO: processAnnotationInput called');
        console.log('API Key exists (import.meta or process.env):', !!(import.meta?.env?.VITE_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY));
        console.log('API Key prefix (first 15 chars):', (import.meta?.env?.VITE_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '').slice(0, 15));
        console.log('Available MODELS:', MODELS);
        console.log('getModelForTask(simple):', getModelForTask('simple'));
        console.log('DEFAULT_CLAUDE_MODEL:', DEFAULT_CLAUDE_MODEL);
    } catch (dbgError) {
        // Non-fatal - continue execution
        // eslint-disable-next-line no-console
        console.warn('Debug logging failed:', dbgError);
    }

    const systemPrompt = `You are a Senior Medical-Legal Consultant specializing in clinical documentation.
DATE EXTRACTION RULES:
- ONLY extract dates if they are EXPLICITLY stated with a full year (e.g., "January 22, 2025" or "2025-01-22").
- DO NOT assume or add any year if not explicitly mentioned.
- If only month/day is mentioned (e.g., "Jan 22") without year, return null for date.
- Return dates as YYYY-MM-DD format.
- Return times as HH:mm (24h format).
- If date or time not explicitly found, return null.

You MUST respond with valid JSON matching this structure:
{
  "refinedText": "string",
  "extractedDate": "YYYY-MM-DD or null",
  "extractedTime": "HH:mm or null"
}`;

    const userPrompt = `
TASK: Refine the clinical observation into an authoritative medical-legal statement and strictly extract any mentioned dates/times.

RAW INPUT: 
---
${rawText}
---

INSTRUCTIONS:
1. REFINED TEXT: Rewrite the raw input into a professional, clinically precise medical-legal observation. 
   - Example: "patient has bad fever" -> "The patient presents with high-grade pyrexia."
   - Maintain all clinical facts (dates, values, symptoms).
2. DATE EXTRACTION: ONLY extract dates if a complete date with YEAR is explicitly stated.
   - Format: YYYY-MM-DD.
   - Examples: "January 22, 2025" -> "2025-01-22", "2024-03-15" -> "2024-03-15"
   - If only month/day without year (e.g., "Jan 22"), return null.
   - DO NOT assume or add any year.
3. TIME EXTRACTION: Extract any mentioned time. 
   - Format: HH:mm (24-hour).
   - Examples: "2pm" -> "14:00", "09:30" -> "09:30".
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
 * Uses SONNET for interactive coaching and strategic deposition preparation (Coach mode)
 */
export const chatWithDepositionCoach = async (history: ChatMessage[], message: string, context: string) => {
    const systemPrompt = `You are an aggressive opposing counsel deposition coach. 
Your goal is to trap the physician expert with difficult clinical questions.
After the user responds, analyze their answer:
1. Score it (1-10).
2. Provide a critique of why their answer might be dangerous or weak.
3. Identify the 'trap' intent of your question.
4. Provide a 'Golden Answer' (betterAnswer) that use a specific deposition technique (e.g. Pivot, Assertive Neutrality).
5. Propose the 'nextQuestion' to continue the cross-examination.

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
    const conversationHistory = history.map(h => ({
        role: h.role === 'user' ? 'user' as const : 'assistant' as const,
        content: h.text
    }));

    try {
        const response = await sendAnthropicRequest({
            model: getModelForTask('critical'), // Use OPUS for deposition coaching
            max_tokens: 2048,
            temperature: 0.8,
            system: systemPrompt,
            messages: conversationHistory
        });

        // Parse different possible response shapes from sendAnthropicRequest
        let jsonText = '';
        if (response && Array.isArray((response as any).content)) {
            const textBlock = (response as any).content.find((b: any) => b.type === 'text');
            if (textBlock && typeof textBlock.text === 'string') {
                jsonText = textBlock.text.trim();
            }
        } else if (response && typeof (response as any).text === 'string') {
            jsonText = (response as any).text.trim();
        } else if (response && typeof (response as any).completion === 'string') {
            jsonText = (response as any).completion.trim();
        } else if (typeof response === 'string') {
            jsonText = response.trim();
        }

        if (!jsonText) {
            throw new Error("No text content in response");
        }
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        return JSON.parse(jsonText);
    } catch (e) {
        console.error("chatWithDepositionCoach error:", e);
        // Return a structured fallback
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
 * Uses SONNET for intelligent report editing
 */
export const suggestReportEdit = async (content: string, instruction: string) => {
    const systemPrompt = `You are a thoroughly trained Medical-Legal Report Editor.
You MUST respond with valid JSON matching this structure:
{
  "newContent": "string",
  "explanation": "string"
}`;

    const userPrompt = `Report Content: ${content}\nInstruction: ${instruction}`;

    try {
        return await callClaudeJSON<{ newContent: string; explanation: string }>(systemPrompt, userPrompt, {
            model: getModelForTask('critical'),
            timeoutMs: REQUEST_TIMEOUT_MS // Use standard timeout for report edits
        });
    } catch (e) {
        console.error("suggestReportEdit error:", e);
        return { newContent: content, explanation: "Edit failed." };
    }
};

/**
 * Search medical research using AI to generate realistic, relevant research articles
 * This simulates a medical literature database search with contextually appropriate results
 */
export const searchMedicalResearch = async (query: string, context: string) => {
    try {
        console.log('🔍 Searching medical literature for:', query);
        
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
            model: getModelForTask('critical'), // Use OPUS for best quality research generation
            maxTokens: 8192,
            temperature: 0.7, // Balanced for realistic variety
            timeoutMs: LONG_REQUEST_TIMEOUT_MS
        });

        console.log(`✅ Found ${result.length} research articles`);
        if (result.length) aiCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('searchMedicalResearch error:', error);
        // Fallback to a single generic result if AI fails
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
 * Analyze research gaps.
 * Uses OPUS for complex research gap analysis with automatic retry on truncation
 */
export const analyzeReportForResearchGaps = async (content: string) => {
    // Truncate content if extremely large to avoid token overflow
    const maxContentLength = 50000; // ~12k tokens for input
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
        // First attempt with high token budget
        console.log('🔍 Analyzing report for research gaps (attempt 1/2)...');
        return await callClaudeJSON<Array<{ topic: string; reason: string }>>(systemPrompt, userPrompt, {
            model: getModelForTask('critical'), // Use OPUS for best quality
            maxTokens: 16384, // Maximum for most models
            timeoutMs: LONG_REQUEST_TIMEOUT_MS,
            temperature: 0.1 // Lower temperature for more focused output
        });
    } catch (e: any) {
        // If truncation error, retry with even more aggressive constraints
        if (e?.message?.includes('truncated') || e?.message?.includes('JSON')) {
            console.warn('⚠️ First attempt truncated, retrying with smaller content...');
            try {
                // Retry with much shorter content
                const shorterContent = content.substring(0, 20000);
                const retryPrompt = `Analyze this report excerpt and identify the TOP 5 most critical research gaps:

${shorterContent}

Return ONLY a JSON array with max 5 items. Keep "topic" and "reason" extremely brief.`;
                
                return await callClaudeJSON<Array<{ topic: string; reason: string }>>(systemPrompt, retryPrompt, {
                    model: getModelForTask('critical'),
                    maxTokens: 8192, // Smaller response window
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
 * Uses SONNET for intelligent citation placement
 */
export const insertSmartCitation = async (content: string, article: any) => {
    const systemPrompt = `You are a medical-legal citation expert.
You MUST respond with valid JSON matching this structure:
{
  "newContent": "string",
  "explanation": "string"
}`;

    const userPrompt = `Propose citation insertion. Article: ${JSON.stringify(article)}\nReport: ${content}`;

    try {
        return await callClaudeJSON<{ newContent: string; explanation: string }>(systemPrompt, userPrompt, {
            model: getModelForTask('critical')
        });
    } catch (e) {
        console.error("insertSmartCitation error:", e);
        return { newContent: content, explanation: "Citation addition failed." };
    }
};

/**
 * Finalizes the report into a client-ready format.
 * Uses SONNET for professional report finalization
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
