import { Case, AuthorizedUser, Annotation, Document as DocType } from '../types';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

interface PlatformData {
    cases: Case[];
    users: AuthorizedUser[];
    documents: DocType[];
    annotations: Annotation[];
}

/**
 * Analyzes platform data using AI to answer admin queries
 */
export async function analyzeDataWithAI(query: string, data: PlatformData): Promise<string> {
    try {
        // Check if API key is configured
        if (!API_KEY) {
            return 'AI features are currently unavailable. Please configure the Gemini API key in your environment variables (VITE_GEMINI_API_KEY).';
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

        // Create AI prompt
        const prompt = `You are an intelligent admin assistant for ApexMedLaw, a medical-legal platform. 
You have access to the following platform data:

${JSON.stringify(dataSummary, null, 2)}

User Question: ${query}

Please provide a clear, concise, and helpful answer based on the data above. If the question asks for specific numbers or lists, provide them. Format your response in a friendly, professional manner. If you need to show lists, use bullet points or numbered lists for clarity.`;

        // Call Gemini AI
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('AI API error:', response.status, errorData);
            return `I apologize, but I encountered an error (${response.status}) while processing your request. Please check that your Gemini API key is valid and has sufficient quota.`;
        }

        const result = await response.json();
        const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || 'I apologize, but I couldn\'t generate a response.';

        return aiResponse;

    } catch (error) {
        console.error('Admin AI Service Error:', error);
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
