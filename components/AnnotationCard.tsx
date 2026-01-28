import React from 'react';
import { Annotation } from '../types';
import { Edit3Icon, Trash2Icon, ArrowRightIcon } from 'lucide-react';

interface AnnotationCardProps {
    annotation: Annotation;
    onEdit: (annotation: Annotation) => void;
    onDelete: (id: string) => void;
    onJumpToSource?: (documentId: string, page: number) => void;
}

export const AnnotationCard: React.FC<AnnotationCardProps> = ({
    annotation,
    onEdit,
    onDelete,
    onJumpToSource
}) => {
    const handleEdit = () => {
        const newText = prompt('Edit annotation text:', annotation.text);
        if (newText !== null && newText.trim()) {
            onEdit({ ...annotation, text: newText.trim() });
        }
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this annotation?')) {
            onDelete(annotation.id);
        }
    };

    return (
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    {annotation.eventDate ? (
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded font-mono">
                            {annotation.eventDate}
                        </span>
                    ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                            UNDATED
                        </span>
                    )}
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                        {annotation.category}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {annotation.documentId !== 'manual-notes' && onJumpToSource && (
                        <button
                            title="Jump to Document"
                            onClick={() => onJumpToSource(annotation.documentId, annotation.page)}
                            className="text-slate-300 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                        >
                            <ArrowRightIcon className="w-4 h-4" />
                        </button>
                    )}
                    {/* Edit and Delete buttons - shown on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                            title="Edit Annotation"
                            onClick={(e) => { e.stopPropagation(); handleEdit(); }}
                            className="p-1 px-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md font-bold flex items-center gap-1 shadow-sm border border-indigo-100 text-[10px]"
                        >
                            <Edit3Icon className="w-2.5 h-2.5" />
                            Edit
                        </button>
                        <button
                            title="Delete Annotation"
                            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                            className="p-1 px-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-md font-bold flex items-center"
                        >
                            <Trash2Icon className="w-2.5 h-2.5" />
                        </button>
                    </div>
                </div>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">
                "{annotation.text}"
            </p>
            <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400">
                <span>Author: {annotation.author}</span>
                <span>
                    {annotation.documentId === 'manual-notes'
                        ? 'Manual Note'
                        : `Page ${annotation.page}`}
                </span>
            </div>
        </div>
    );
};
