import React, { useState } from 'react';
import {
    MessageSquareIcon,
    XIcon,
    SparklesIcon,
    Loader2Icon,
    QuoteIcon,
    MapPinIcon,
    CheckIcon,
    Trash2Icon,
    PencilIcon,
    UserIcon
} from 'lucide-react';
import { ReportComment } from '../types';

interface WriterCommentSidebarProps {
    comments: ReportComment[];
    selectedText: string;
    commentInput: string;
    currentUserName: string;
    onCommentInputChange: (value: string) => void;
    onCancelSelection: () => void;
    onAddComment: () => void;
    onLocateComment: (context: string) => void;
    onResolveComment: (id: string) => void;
    onDeleteComment: (id: string) => void;
    onEditComment?: (id: string, newText: string) => void;
}

const getAvatarColor = (name: string) => {
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

const WriterCommentSidebar: React.FC<WriterCommentSidebarProps> = ({
    comments,
    selectedText,
    commentInput,
    currentUserName,
    onCommentInputChange,
    onCancelSelection,
    onAddComment,
    onLocateComment,
    onResolveComment,
    onDeleteComment,
    onEditComment
}) => {
    const [isRefining, setIsRefining] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    const handleRefine = async () => {
        if (!commentInput.trim()) return;
        setIsRefining(true);
        // Simulate AI refinement
        setTimeout(() => {
            const refined = commentInput.charAt(0).toUpperCase() + commentInput.slice(1);
            onCommentInputChange(refined + (refined.endsWith('.') ? '' : '.'));
            setIsRefining(false);
        }, 800);
    };

    const handleStartEdit = (comment: ReportComment) => {
        setEditingCommentId(comment.id);
        setEditText(comment.text);
    };

    const handleSaveEdit = (id: string) => {
        if (onEditComment && editText.trim()) {
            onEditComment(id, editText.trim());
            setEditingCommentId(null);
            setEditText('');
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Add Comment Box */}
            {selectedText && (
                <div className="bg-white p-4 rounded-2xl border-2 border-indigo-200 shadow-xl animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">New Comment</span>
                    </div>

                    {/* Selected Text Preview */}
                    <div className="mb-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                        <div className="flex items-center gap-2 mb-2">
                            <QuoteIcon className="w-3 h-3 text-indigo-400" />
                            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Selected Text</span>
                        </div>
                        <p className="text-xs text-slate-600 italic line-clamp-3 leading-relaxed">
                            "{selectedText}"
                        </p>
                    </div>

                    {/* Comment Input */}
                    <div className="relative mb-3">
                        <textarea
                            autoFocus
                            className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none h-24 bg-white transition-all leading-relaxed"
                            placeholder="Add your suggestion or comment..."
                            value={commentInput}
                            onChange={e => onCommentInputChange(e.target.value)}
                        />
                        <button
                            onClick={handleRefine}
                            disabled={!commentInput.trim() || isRefining}
                            title="Refine with AI"
                            className="absolute right-2 bottom-2 p-2 rounded-lg bg-white border border-slate-200 text-indigo-600 hover:text-indigo-700 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isRefining ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <SparklesIcon className="w-3.5 h-3.5" />}
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={onCancelSelection}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onAddComment}
                            disabled={!commentInput.trim() || isRefining}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <MessageSquareIcon className="w-3.5 h-3.5" />
                            Post Comment
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {comments.length === 0 && !selectedText && (
                <div className="text-center py-16 px-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageSquareIcon className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-sm font-bold text-slate-400 mb-1">No comments yet</p>
                    <p className="text-xs text-slate-400">Select text in the editor to add a comment</p>
                </div>
            )}

            {/* Comment List */}
            <div className="space-y-3">
                {comments.map((comment) => (
                    <div
                        key={comment.id}
                        className={`group bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all ${comment.resolved
                                ? 'opacity-60 border-slate-100 bg-slate-50/50'
                                : 'border-slate-200 hover:border-indigo-200'
                            }`}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${getAvatarColor(comment.author)}`}>
                                    {comment.author.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">{comment.author}</p>
                                    <p className="text-[10px] text-slate-400">
                                        {new Date(comment.timestamp).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {comment.context && (
                                    <button
                                        onClick={() => onLocateComment(comment.context!)}
                                        title="Locate in document"
                                        className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                        <MapPinIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => onResolveComment(comment.id)}
                                    title={comment.resolved ? "Unresolve" : "Mark as resolved"}
                                    className={`p-1.5 rounded-lg transition-colors ${comment.resolved
                                            ? 'text-green-600 bg-green-50'
                                            : 'text-slate-300 hover:text-green-500 hover:bg-green-50'
                                        }`}
                                >
                                    <CheckIcon className="w-3.5 h-3.5" />
                                </button>
                                {!comment.resolved && onEditComment && (
                                    <button
                                        onClick={() => handleStartEdit(comment)}
                                        title="Edit comment"
                                        className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <PencilIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => onDeleteComment(comment.id)}
                                    title="Delete comment"
                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2Icon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Context Quote */}
                        {comment.context && (
                            <div className="mb-3 pl-3 border-l-2 border-indigo-200 bg-indigo-50/30 py-2 rounded-r-lg">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <QuoteIcon className="w-2.5 h-2.5 text-indigo-400" />
                                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Referenced Text</span>
                                </div>
                                <p className="text-[11px] text-slate-500 italic line-clamp-2 leading-relaxed">
                                    "{comment.context}"
                                </p>
                            </div>
                        )}

                        {/* Comment Text */}
                        {editingCommentId === comment.id ? (
                            <div className="space-y-2">
                                <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="w-full text-sm p-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none h-20"
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setEditingCommentId(null)}
                                        className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleSaveEdit(comment.id)}
                                        className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className={`text-sm text-slate-700 leading-relaxed ${comment.resolved ? 'line-through opacity-60' : ''}`}>
                                {comment.text}
                            </p>
                        )}

                        {/* Resolved Badge */}
                        {comment.resolved && (
                            <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded-full">
                                <CheckIcon className="w-3 h-3 text-green-600" />
                                <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Resolved</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WriterCommentSidebar;
