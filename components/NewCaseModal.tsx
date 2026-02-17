
import React, { useState } from 'react';
import { XIcon, BriefcaseIcon, UserIcon, ScaleIcon, CalendarIcon, FileTextIcon, GavelIcon } from 'lucide-react';
import { Case } from '../types';

interface NewCaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (caseData: Partial<Case>, clientName: string) => void;
    initialData?: Case;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({ isOpen, onClose, onCreate, initialData }) => {
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [startDate, setStartDate] = useState(initialData?.startDate || initialData?.createdAt || new Date().toISOString().split('T')[0]);
    const [status, setStatus] = useState<string>(initialData?.status || 'active');
    const [primaryLawyer, setPrimaryLawyer] = useState(initialData?.primaryLawyer || '');

    // Reset state when modal opens/closes or initialData changes
    React.useEffect(() => {
        if (isOpen) {
            setTitle(initialData?.title || '');
            setDescription(initialData?.description || '');
            setStartDate(initialData?.startDate || initialData?.createdAt || new Date().toISOString().split('T')[0]);
            setStatus(initialData?.status || 'active');
            setPrimaryLawyer(initialData?.primaryLawyer || '');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            alert('Case title is required');
            return;
        }

        const caseData: Partial<Case> = {
            title,
            description,
            startDate: startDate,
            createdAt: startDate,
            status: status as any,
            primaryLawyer: primaryLawyer.trim() || undefined
        };

        onCreate(caseData, '');
    };

    const isEditing = !!initialData;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-100 text-cyan-700 rounded-lg">
                            <BriefcaseIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{isEditing ? 'Edit Case' : 'Create New Case'}</h3>
                            <p className="text-xs text-slate-500">{isEditing ? 'Update case details below' : 'Enter case details to get started'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Case Title */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Case Title <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <BriefcaseIcon className="w-4 h-4" />
                            </div>
                            <input
                                autoFocus
                                type="text"
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all placeholder:text-slate-400"
                                placeholder="e.g., Smith vs. Mercy Hospital"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Description / Summary
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-3 text-slate-400">
                                <FileTextIcon className="w-4 h-4" />
                            </div>
                            <textarea
                                rows={3}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all placeholder:text-slate-400 resize-none"
                                placeholder="Brief overview of the medical malpractice claim..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Attorney Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Attorney Name
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <ScaleIcon className="w-4 h-4" />
                            </div>
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all placeholder:text-slate-400"
                                placeholder="e.g., Sarah Jenkins, Esq."
                                value={primaryLawyer}
                                onChange={(e) => setPrimaryLawyer(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Case Start Date */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Case Start Date
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <CalendarIcon className="w-4 h-4" />
                                </div>
                                <input
                                    type="date"
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-cyan-500 transition-all text-slate-600"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Case Status */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Status
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <UserIcon className="w-4 h-4" />
                                </div>
                                <select
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-cyan-500 transition-all text-slate-600 appearance-none cursor-pointer"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                >
                                    <option value="planning">Planning</option>
                                    <option value="active">Active</option>
                                    <option value="on_hold">On Hold</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-cyan-600 text-white text-sm font-bold rounded-xl hover:bg-cyan-700 shadow-lg shadow-cyan-200 hover:shadow-cyan-300 transition-all translate-y-0 hover:-translate-y-0.5"
                        >
                            {isEditing ? 'Save Changes' : 'Create Case'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
