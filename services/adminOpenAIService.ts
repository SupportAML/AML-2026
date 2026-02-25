import OpenAI from 'openai';
import { Case, AuthorizedUser, Annotation, Document as DocType } from '../types';

// ============================================================================
// OPENAI API CONFIGURATION FOR ADMIN SERVICES
// ============================================================================

const API_KEY = (import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '') as string;

// Default model for admin queries
const DEFAULT_ADMIN_MODEL = import.meta.env.VITE_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o';

interface PlatformData {
    cases: Case[];
    users: AuthorizedUser[];
    documents: DocType[];
    annotations: Annotation[];
}

/**
 * Analyzes platform data using OpenAI to answer admin queries
 */
export async function analyzeDataWithAI(query: string, data: PlatformData): Promise<string> {
    try {
        // Check if API key is configured
        if (!API_KEY) {
            return 'AI features are currently unavailable. Please configure the OpenAI API key in your environment variables. Add VITE_OPENAI_API_KEY to your .env.local file and restart the dev server.';
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

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: API_KEY,
            dangerouslyAllowBrowser: true // Required for client-side usage
        });

        const systemPrompt = `You are an intelligent admin assistant for ApexMedLaw, a medical-legal platform. 
You have access to platform data and should provide clear, concise, and helpful answers.
If the question asks for specific numbers or lists, provide them. 
Format your response in a friendly, professional manner. 
Use bullet points or numbered lists for clarity when showing lists.`;

        const userPrompt = `Platform Data:
${JSON.stringify(dataSummary, null, 2)}

User Question: ${query}

Please provide a clear and helpful answer based on the data above.`;

        // Call OpenAI
        const response = await openai.chat.completions.create({
            model: DEFAULT_ADMIN_MODEL,
            max_tokens: 2048,
            temperature: 0.7,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        });

        return response.choices[0]?.message?.content ?? "I apologize, but I couldn't generate a response.";

    } catch (error: any) {
        console.error('Admin AI Service Error:', error);

        if (error?.message?.includes('api_key') || error?.status === 401) {
            return 'I apologize, but the API key is invalid. Please check your OpenAI API configuration in Settings.';
        }
        if (error?.status === 429) {
            return 'I apologize, but the API rate limit has been exceeded. Please try again in a moment.';
        }
        if (error?.status === 503) {
            return 'I apologize, but the AI service is temporarily overloaded. Please try again shortly.';
        }

        return 'I apologize, but I encountered an error processing your request. Please try again or check your API configuration in Settings.';
    }
}

/**
 * Get quick platform statistics (unchanged — no AI involved)
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
