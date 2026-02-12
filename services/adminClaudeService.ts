import Anthropic from '@anthropic-ai/sdk';
import { Case, AuthorizedUser, Annotation, Document as DocType } from '../types';

// ============================================================================
// CLAUDE API CONFIGURATION FOR ADMIN SERVICES
// ============================================================================

// Use the same API key pattern as main service
const API_KEY = (process.env.CLAUDE_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY || '') as string;

// Valid Anthropic model names
const CLAUDE_HAIKU = "claude-3-5-haiku-20241022";  // Fast, simple queries
const CLAUDE_SONNET = "claude-3-5-sonnet-20241022"; // Complex admin analysis

// Default model for admin queries (use OPUS fallback which is known to be available for this account)
const DEFAULT_ADMIN_MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-6";

interface PlatformData {
    cases: Case[];
    users: AuthorizedUser[];
    documents: DocType[];
    annotations: Annotation[];
}

/**
 * Analyzes platform data using Claude AI to answer admin queries
 */
export async function analyzeDataWithAI(query: string, data: PlatformData): Promise<string> {
    try {
        // Check if API key is configured
        if (!API_KEY) {
            return 'AI features are currently unavailable. Please configure the Anthropic API key in your environment variables. Add VITE_ANTHROPIC_API_KEY to your .env.local file and restart the dev server.';
        }

        // Prepare data summary for AI
        const dataSummary = {
            users: {
                total: data.users.length,
                active: data.users.filter(u => u.status === 'active').length,
                admins: data.users.filter(u => u.role === 'ADMIN').length,
                regularUsers: data.users.filter(u => u.role === 'USER').length,
                list: data.users.map(u => ({
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    status: u.status,
                    addedAt: u.addedAt
                }))
            },
            cases: {
                total: data.cases.length,
                byStatus: {
                    planning: data.cases.filter(c => c.status === 'planning').length,
                    active: data.cases.filter(c => c.status === 'active').length,
                    onHold: data.cases.filter(c => c.status === 'on_hold').length,
                    cancelled: data.cases.filter(c => c.status === 'cancelled').length,
                    archived: data.cases.filter(c => c.status === 'archived').length
                },
                list: data.cases.map(c => ({
                    id: c.id,
                    title: c.title,
                    status: c.status,
                    primaryLawyer: c.primaryLawyer,
                    createdAt: c.createdAt,
                    documentCount: data.documents.filter(d => d.caseId === c.id).length,
                    annotationCount: data.annotations.filter(a => a.caseId === c.id).length
                }))
            },
            documents: {
                total: data.documents.length,
                byCase: data.cases.map(c => ({
                    caseTitle: c.title,
                    count: data.documents.filter(d => d.caseId === c.id).length
                }))
            },
            annotations: {
                total: data.annotations.length,
                byCategory: {
                    medical: data.annotations.filter(a => a.category === 'Medical').length,
                    legal: data.annotations.filter(a => a.category === 'Legal').length,
                    review: data.annotations.filter(a => a.category === 'Review').length,
                    urgent: data.annotations.filter(a => a.category === 'Urgent').length
                },
                byCase: data.cases.map(c => ({
                    caseTitle: c.title,
                    count: data.annotations.filter(a => a.caseId === c.id).length
                }))
            }
        };

        // Initialize Claude client
        const anthropic = new Anthropic({
            apiKey: API_KEY,
            dangerouslyAllowBrowser: true // Required for client-side usage
        });

// Minimal flexible request helper (mirror of services/claudeService behavior)
const sendAnthropicRequestAdmin = async (opts: { model: string; max_tokens?: number; temperature?: number; system?: string; messages?: { role: string; content: string }[]; input?: string; }) => {
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
        if ((anthropic as any).responses && typeof (anthropic as any).responses.create === 'function') {
            const inputText = opts.input ?? `${opts.system || ''}\n\n${(opts.messages || []).map(m => m.content).join('\n')}`;
            return await (anthropic as any).responses.create({
                model: opts.model,
                input: inputText,
                temperature: opts.temperature
            });
        }
        throw new Error("No compatible Anthropic client methods found on SDK instance.");
    } catch (e) {
        (e as any).message = `Anthropic request failed: ${(e as any).message || e}`;
        throw e;
    }
};
        // Create AI prompt
        const systemPrompt = `You are an intelligent admin assistant for ApexMedLaw, a medical-legal platform. 
You have access to platform data and should provide clear, concise, and helpful answers.
If the question asks for specific numbers or lists, provide them. 
Format your response in a friendly, professional manner. 
Use bullet points or numbered lists for clarity when showing lists.`;

        const userPrompt = `Platform Data:
${JSON.stringify(dataSummary, null, 2)}

User Question: ${query}

Please provide a clear and helpful answer based on the data above.`;

        // Call Claude AI using Sonnet for intelligent admin analysis
        const response = await sendAnthropicRequestAdmin({
            model: DEFAULT_ADMIN_MODEL,
            max_tokens: 2048,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            input: `${systemPrompt}\n\n${userPrompt}`
        });

        // Parse common response shapes
        if (response && Array.isArray((response as any).content)) {
            const textBlock = (response as any).content.find((b: any) => b.type === 'text');
            if (textBlock && typeof textBlock.text === 'string') return textBlock.text;
        }
        if ((response as any).output_text && typeof (response as any).output_text === 'string') {
            return (response as any).output_text;
        }
        if (Array.isArray((response as any).output)) {
            const firstOutput = (response as any).output[0];
            if (firstOutput && Array.isArray(firstOutput.content)) {
                const textPart = firstOutput.content.find((c: any) => c.type === 'output_text' || c.type === 'text');
                if (textPart && (textPart.text || textPart.content)) {
                    return textPart.text || textPart.content;
                }
            }
        }

        return "I apologize, but I couldn't generate a response.";

    } catch (error: any) {
        console.error('Admin AI Service Error:', error);

        // Provide specific error messages
        if (error?.message?.includes('api_key') || error?.status === 401) {
            return 'I apologize, but the API key is invalid. Please check your Claude API configuration in Settings.';
        }
        if (error?.status === 429) {
            return 'I apologize, but the API rate limit has been exceeded. Please try again in a moment.';
        }
        if (error?.status === 529) {
            return 'I apologize, but the AI service is temporarily overloaded. Please try again shortly.';
        }

        return 'I apologize, but I encountered an error processing your request. Please try again or check your API configuration in Settings.';
    }
}

/**
 * Get quick platform statistics
 */
export function getPlatformStats(data: PlatformData) {
    return {
        users: {
            total: data.users.length,
            active: data.users.filter(u => u.status === 'active').length,
            admins: data.users.filter(u => u.role === 'ADMIN').length
        },
        cases: {
            total: data.cases.length,
            planning: data.cases.filter(c => c.status === 'planning').length,
            active: data.cases.filter(c => c.status === 'active').length,
            archived: data.cases.filter(c => c.status === 'archived').length
        },
        documents: {
            total: data.documents.length,
            averagePerCase: data.cases.length > 0
                ? Math.round(data.documents.length / data.cases.length)
                : 0
        },
        annotations: {
            total: data.annotations.length,
            averagePerCase: data.cases.length > 0
                ? Math.round(data.annotations.length / data.cases.length)
                : 0
        }
    };
}
