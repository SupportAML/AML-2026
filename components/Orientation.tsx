
import React from 'react';
import {
    LayoutDashboardIcon,
    MessageSquareIcon,
    BrainCircuitIcon,
    CheckCircle2Icon,
    ArrowRightIcon,
    FilesIcon
} from 'lucide-react';

const Orientation: React.FC = () => {
    return (
        <div className="flex-1 overflow-auto bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-12 text-center">
                    <h1 className="text-4xl font-serif font-black text-slate-900 mb-4">ApexMedLaw Workflow</h1>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                        A simplified guide to managing your medical-legal cases.
                    </p>
                </header>

                {/* Workflow Diagram */}
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-16 relative">
                    <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 -translate-y-1/2 rounded-full"></div>

                    {/* Step 1 */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center text-center w-full md:w-64 relative z-10">
                        <div className="w-12 h-12 bg-cyan-100 text-cyan-600 rounded-full flex items-center justify-center mb-4 font-bold text-lg">1</div>
                        <h3 className="font-bold text-slate-800 mb-2">Create & Sync</h3>
                        <p className="text-xs text-slate-500">Create a case and link a Google Drive folder. Files auto-sync for review.</p>
                        <FilesIcon className="w-8 h-8 text-cyan-200 mt-4" />
                    </div>

                    <ArrowRightIcon className="w-8 h-8 text-slate-300 hidden md:block" />

                    {/* Step 2 */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center text-center w-full md:w-64 relative z-10">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 font-bold text-lg">2</div>
                        <h3 className="font-bold text-slate-800 mb-2">Review & Strategize</h3>
                        <p className="text-xs text-slate-500">Use "Deposition Prep" to analyze liability and prepare for tough questions.</p>
                        <BrainCircuitIcon className="w-8 h-8 text-indigo-200 mt-4" />
                    </div>

                    <ArrowRightIcon className="w-8 h-8 text-slate-300 hidden md:block" />

                    {/* Step 3 */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center text-center w-full md:w-64 relative z-10">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 font-bold text-lg">3</div>
                        <h3 className="font-bold text-slate-800 mb-2">Draft & Finalize</h3>
                        <p className="text-xs text-slate-500">Use "Legal Writer" to draft the opinion, cite research, and sign the report.</p>
                        <MessageSquareIcon className="w-8 h-8 text-emerald-200 mt-4" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-xl font-serif font-black text-slate-800 mb-4 flex items-center gap-2">
                            <CheckCircle2Icon className="w-6 h-6 text-green-500" />
                            Key Capabilities
                        </h3>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                                <div>
                                    <span className="font-bold text-slate-700 block">AI Strategy Analysis</span>
                                    <span className="text-sm text-slate-500">Automatically detects Plaintiff vs. Defense arguments. Use thumbs up/down to refine strategies.</span>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                                <div>
                                    <span className="font-bold text-slate-700 block">Deposition Coaching</span>
                                    <span className="text-sm text-slate-500">Practice answering questions with an AI coach that acts as opposing counsel.</span>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                                <div>
                                    <span className="font-bold text-slate-700 block">Medical Research</span>
                                    <span className="text-sm text-slate-500">Search for medical literature and instantly incorporate citations into your report.</span>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl font-serif font-black mb-4 text-cyan-400">Pro Tips</h3>
                            <ul className="space-y-4 text-slate-300 text-sm">
                                <li className="flex gap-3 items-center">
                                    <span className="bg-white/10 w-6 h-6 rounded flex items-center justify-center font-bold text-xs">1</span>
                                    Use the <strong className="text-white">Refresh Button</strong> on the case page to verify new Drive files.
                                </li>
                                <li className="flex gap-3 items-center">
                                    <span className="bg-white/10 w-6 h-6 rounded flex items-center justify-center font-bold text-xs">2</span>
                                    Upload your CV in <strong className="text-white">Profile</strong> to auto-generate qualification statements.
                                </li>
                                <li className="flex gap-3 items-center">
                                    <span className="bg-white/10 w-6 h-6 rounded flex items-center justify-center font-bold text-xs">3</span>
                                    Mark files as <strong className="text-white">"Reviewed"</strong> to track your progress.
                                </li>
                            </ul>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-cyan-600/20 rounded-full blur-3xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Orientation;
