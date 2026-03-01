import React, { useState, useRef, useEffect } from 'react';
import {
    BotIcon,
    SendIcon,
    Loader2Icon,
    SparklesIcon,
    UsersIcon,
    FolderIcon,
    FileTextIcon,
    MessageSquareIcon
} from 'lucide-react';
import { Case, AuthorizedUser, Annotation, Document as DocType } from '../types';
import { analyzeDataWithAI } from '../services/adminClaudeService';
import { subscribeToDocuments, subscribeToAnnotations } from '../services/storageService';

interface AdminInsightsProps {
    cases: Case[];
    authorizedUsers: AuthorizedUser[];
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export const AdminInsights: React.FC<AdminInsightsProps> = ({
    cases,
    authorizedUsers
}) => {
    // Local state for all documents and annotations
    const [allDocuments, setAllDocuments] = useState<DocType[]>([]);
    const [allAnnotations, setAllAnnotations] = useState<Annotation[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Subscribe to all platform data when this component is mounted
    useEffect(() => {
        if (!cases || cases.length === 0) {
            setIsLoadingData(false);
            return;
        }

        setIsLoadingData(true);
        const unsubscribers: (() => void)[] = [];
        const docsMap = new Map<string, DocType>();
        const annsMap = new Map<string, Annotation>();

        // Track completion of initial load if possible, 
        // but for Firestore realtime streams, we just start listening.
        // We'll set loading to false after a short timeout or immediately since streams are async
        setIsLoadingData(false);

        cases.forEach(caseItem => {
            const unsubDocs = subscribeToDocuments(caseItem.id, (docs) => {
                docs.forEach(doc => docsMap.set(doc.id, doc));
                setAllDocuments(Array.from(docsMap.values()));
            });

            const unsubAnns = subscribeToAnnotations(caseItem.id, (anns) => {
                anns.forEach(ann => annsMap.set(ann.id, ann));
                setAllAnnotations(Array.from(annsMap.values()));
            });

            unsubscribers.push(unsubDocs, unsubAnns);
        });

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [cases]);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hello! I\'m your Admin Intelligence Assistant. I have access to all platform data and can help you with insights about users, cases, documents, and annotations. What would you like to know?',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Quick stats for display
    const stats = {
        totalUsers: authorizedUsers.length,
        activeUsers: authorizedUsers.filter(u => u.status === 'active').length,
        totalCases: cases.length,
        openCases: cases.filter(c => c.status === 'active').length,
        totalDocuments: allDocuments.length,
        totalAnnotations: allAnnotations.length
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Call AI service with platform data
            const response = await analyzeDataWithAI(
                input,
                {
                    cases,
                    users: authorizedUsers,
                    documents: allDocuments,
                    annotations: allAnnotations
                }
            );

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('AI query error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'I apologize, but I encountered an error processing your request. Please try again.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const suggestedQuestions = [
        "How many active users do we have?",
        "What's the status of all cases?",
        "Which case has the most documents?",
        "Show me annotation statistics",
        "List all admin users"
    ];

    return (
        <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-indigo-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                        <SparklesIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Admin Intelligence</h2>
                        <p className="text-sm text-slate-500">AI-powered platform insights and analytics</p>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                            <UsersIcon className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-blue-900">Users</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-700">{stats.totalUsers}</div>
                        <div className="text-xs text-blue-600">{stats.activeUsers} active</div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                        <div className="flex items-center gap-2 mb-1">
                            <FolderIcon className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-semibold text-purple-900">Cases</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-700">{stats.totalCases}</div>
                        <div className="text-xs text-purple-600">{stats.openCases} open</div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-3 border border-emerald-200">
                        <div className="flex items-center gap-2 mb-1">
                            <FileTextIcon className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-semibold text-emerald-900">Documents</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-700">{stats.totalDocuments}</div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
                        <div className="flex items-center gap-2 mb-1">
                            <MessageSquareIcon className="w-4 h-4 text-amber-600" />
                            <span className="text-xs font-semibold text-amber-900">Annotations</span>
                        </div>
                        <div className="text-2xl font-bold text-amber-700">{stats.totalAnnotations}</div>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {message.role === 'assistant' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <BotIcon className="w-5 h-5 text-white" />
                            </div>
                        )}
                        <div
                            className={`max-w-2xl rounded-2xl px-4 py-3 ${message.role === 'user'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-900'
                                }`}
                        >
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
                            <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {message.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}
                            </div>
                        </div>
                        {message.role === 'user' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                                A
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3 justify-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <BotIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                            <Loader2Icon className="w-5 h-5 text-indigo-600 animate-spin" />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Suggested Questions */}
            {messages.length === 1 && (
                <div className="px-6 pb-4">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Suggested questions:</p>
                    <div className="flex flex-wrap gap-2">
                        {suggestedQuestions.map((question, idx) => (
                            <button
                                key={idx}
                                onClick={() => setInput(question)}
                                className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-slate-700"
                            >
                                {question}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="bg-white border-t border-slate-200 p-4">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask anything about your platform data..."
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-semibold"
                    >
                        {isLoading ? (
                            <Loader2Icon className="w-5 h-5 animate-spin" />
                        ) : (
                            <SendIcon className="w-5 h-5" />
                        )}
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};
