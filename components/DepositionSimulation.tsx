
import React from 'react';
import {
    MicIcon,
    ArrowRightIcon,
    ArrowLeftIcon,
    SparklesIcon,
    RepeatIcon,
    Loader2Icon,
    AlertCircleIcon,
    SendHorizontalIcon,
    ShieldAlertIcon,
    TargetIcon,
    Trash2Icon
} from 'lucide-react';
import { ChatMessage, DepoFeedback } from '../types';

interface DepositionSimulationProps {
    chatHistory: ChatMessage[];
    isChatting: boolean;
    isListening: boolean;
    chatInput: string;
    currentFeedback: DepoFeedback | null;
    onChatInputChange: (val: string) => void;
    onMicClick: () => void;
    onSubmit: (e: React.FormEvent) => void;
    onRetry: () => void;
    onNext: () => void;
    onClearHistory?: () => void;
    onBackToAnalysis?: () => void;
    chatScrollRef: React.RefObject<HTMLDivElement>;
}

export const DepositionSimulation: React.FC<DepositionSimulationProps> = ({
    chatHistory,
    isChatting,
    isListening,
    chatInput,
    currentFeedback,
    onChatInputChange,
    onMicClick,
    onSubmit,
    onRetry,
    onNext,
    onClearHistory,
    onBackToAnalysis,
    chatScrollRef
}) => {
    return (
        <div className="flex-1 flex w-full h-full bg-[#fcfdfe]">
            {/* Left: Chat Interaction */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                {/* Header with controls */}
                {(onBackToAnalysis || onClearHistory) && (
                    <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                        {onBackToAnalysis && (
                            <button
                                onClick={onBackToAnalysis}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            >
                                <ArrowRightIcon className="w-4 h-4 rotate-180" />
                                Back to Analysis
                            </button>
                        )}
                        <div className="flex-1" />
                        {onClearHistory && chatHistory.length > 1 && (
                            <button
                                onClick={onClearHistory}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            >
                                <Trash2Icon className="w-4 h-4" />
                                Clear History
                            </button>
                        )}
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-16 space-y-12 no-scrollbar" ref={chatScrollRef} style={{ scrollBehavior: 'smooth' }}>
                    {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex flex-col w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`p-8 rounded-[1.25rem] leading-[1.8] shadow-sm max-w-[85%] ${msg.role === 'user'
                                ? 'bg-white text-slate-700 border border-slate-200 text-sm font-medium'
                                : 'bg-[#1a2130] text-white font-medium text-lg'
                                }`}>
                                {msg.text}
                            </div>
                            {/* Inline Score Badge (Matching Image) */}
                            {msg.role === 'user' && msg.coaching && (
                                <div className={`mt-3 py-1 px-3 rounded-full flex items-center gap-2 border shadow-sm text-[11px] font-bold ${msg.coaching.score >= 8 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                    msg.coaching.score >= 5 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                        'bg-rose-50 text-rose-500 border-rose-100'
                                    }`}>
                                    <ShieldAlertIcon className="w-3.5 h-3.5" />
                                    Score: {msg.coaching.score}/10
                                </div>
                            )}
                        </div>
                    ))}
                    {isChatting && (
                        <div className="flex items-center gap-3 text-slate-300 font-serif italic text-sm animate-pulse">
                            Opposing counsel is thinking...
                        </div>
                    )}
                </div>

                {/* Bottom Input Field (Matching Image) */}
                <div className="p-8 bg-white border-t border-slate-100 shrink-0">
                    <div className="max-w-5xl mx-auto mb-2 px-4 flex justify-between items-end">
                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded">
                            Action: Reply to Counsel
                        </label>
                        {isChatting && (
                            <span className="text-[10px] font-bold text-slate-400 italic">Analysis in progress...</span>
                        )}
                    </div>
                    <form onSubmit={onSubmit} className="max-w-5xl mx-auto flex items-center gap-4 bg-[#f8f9fb] rounded-2xl p-2 px-4 border border-slate-100 shadow-inner focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all">
                        <button type="button" onClick={onMicClick} className={`p-2 transition-colors ${isListening ? 'text-rose-500 animate-pulse' : 'text-slate-400 hover:text-indigo-600'}`}>
                            <MicIcon className="w-5 h-5" />
                        </button>
                        <input
                            className="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400 text-base py-3"
                            placeholder={currentFeedback ? "Review feedback before proceeding..." : "Type your professional response to the counsel's question..."}
                            value={chatInput}
                            onChange={(e) => onChatInputChange(e.target.value)}
                            disabled={!!currentFeedback || isChatting}
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={!chatInput.trim() || !!currentFeedback || isChatting}
                            className="w-10 h-10 bg-[#818cf8] text-white rounded-xl flex items-center justify-center hover:bg-indigo-600 disabled:opacity-30 transition-all shadow-lg shadow-indigo-200"
                        >
                            <SendHorizontalIcon className="w-5 h-5 rotate-0" />
                        </button>
                    </form>
                </div>
            </div>

            {/* Right: Coach's Analytics Dashboard (Matching Image) */}
            <div className="w-[440px] bg-[#f8f9fb] border-l border-slate-200 flex flex-col overflow-y-auto no-scrollbar shadow-inner">
                {currentFeedback ? (
                    <div className="p-10 space-y-6 animate-in slide-in-from-right-8 duration-500">
                        {/* Analysis Card */}
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Trap Detected</h4>
                                <p className="text-sm font-bold text-slate-800 leading-relaxed font-sans">
                                    {currentFeedback.questionIntent}
                                </p>
                            </div>
                            <div className="h-px bg-slate-100" />
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Critique</h4>
                                <p className="text-sm font-medium text-slate-500 leading-[1.8] font-sans">
                                    {currentFeedback.critique}
                                </p>
                            </div>
                        </div>

                        {/* Technique Spotlight (The Purple Box) */}
                        <div className="bg-[#4f46e5] p-8 rounded-2xl shadow-xl shadow-indigo-100 text-white group transition-all">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-1.5 bg-white/20 rounded-lg">
                                    <ShieldAlertIcon className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Technique Spotlight</span>
                            </div>
                            <h4 className="text-2xl font-serif font-black mb-3">{currentFeedback.technique || "Standard Pivot"}</h4>
                            <p className="text-sm text-indigo-100 leading-relaxed opacity-90 font-medium">Apply this specific mental model to defuse the line of questioning.</p>
                        </div>

                        {/* The Golden Answer (The Emerald Box) -- Updated to match Image green style */}
                        <div className="bg-[#f0fdf4] p-8 rounded-2xl border border-emerald-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">The Golden Answer</span>
                            </div>
                            <p className="text-[15px] font-serif font-bold text-emerald-900 leading-[1.8] italic">
                                "{currentFeedback.betterAnswer}"
                            </p>
                        </div>

                        {/* Final Actions */}
                        <div className="flex flex-col gap-3 pt-4">
                            <button
                                onClick={onNext}
                                className="w-full py-4 bg-[#1a2130] text-white rounded-2xl font-bold text-sm hover:bg-black flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
                            >
                                Next Question <ArrowRightIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onRetry}
                                className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                <RepeatIcon className="w-4 h-4" /> Try Again
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-24 h-24 bg-white rounded-full border-4 border-slate-100 flex items-center justify-center mb-8 shadow-inner relative">
                            {isChatting ? (
                                <Loader2Icon className="w-10 h-10 text-indigo-500 animate-spin" />
                            ) : (
                                <TargetIcon className="w-10 h-10 text-slate-200" />
                            )}
                            {isChatting && (
                                <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            )}
                        </div>
                        <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-[0.3em]">
                            {isChatting ? "Counsel is Analyzing..." : "Coaching Ready"}
                        </h3>
                        <p className="text-sm text-slate-500 mt-4 font-medium leading-relaxed max-w-[240px] mx-auto opacity-70">
                            {isChatting
                                ? "Opposing counsel is evaluating your response for potential clinical traps and legal weaknesses."
                                : "Respond to the counsel's line of questioning in the chat field to activate real-time cognitive coaching."}
                        </p>
                        {!isChatting && (
                            <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest animate-bounce">
                                <ArrowLeftIcon className="w-3.5 h-3.5" /> Start Typing Below
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
