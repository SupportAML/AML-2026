import React, { useState, useRef, useEffect } from 'react';
import {
  PlusIcon,
  XIcon,
  CheckIcon,
  Trash2Icon,
  ClockIcon,
  CheckSquareIcon,
  SquareIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListTodoIcon,
  PencilIcon,
  StickyNoteIcon,
} from 'lucide-react';
import { TodoItem, UserProfile } from '../types';

interface CaseTodoListProps {
  todoItems: TodoItem[];
  currentUser: UserProfile;
  onUpdate: (items: TodoItem[]) => void;
}

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

const formatFullTimestamp = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const CaseTodoList: React.FC<CaseTodoListProps> = ({ todoItems, currentUser, onUpdate }) => {
  const [newText, setNewText] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

  useEffect(() => {
    if (editingNoteId && noteInputRef.current) noteInputRef.current.focus();
  }, [editingNoteId]);

  const pending = todoItems.filter(t => !t.completed);
  const completed = todoItems.filter(t => t.completed);

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const item: TodoItem = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      notes: '',
      completed: false,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
      createdByName: currentUser.name,
    };
    onUpdate([item, ...todoItems]);
    setNewText('');
    inputRef.current?.focus();
  };

  const handleToggle = (id: string) => {
    const updated = todoItems.map(t => {
      if (t.id !== id) return t;
      return {
        ...t,
        completed: !t.completed,
        completedAt: !t.completed ? new Date().toISOString() : undefined,
      };
    });
    onUpdate(updated);
  };

  const handleDelete = (id: string) => {
    onUpdate(todoItems.filter(t => t.id !== id));
  };

  const handleEditSave = (id: string) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    onUpdate(todoItems.map(t => t.id === id ? { ...t, text: trimmed } : t));
    setEditingId(null);
  };

  const handleNoteSave = (id: string) => {
    onUpdate(todoItems.map(t => t.id === id ? { ...t, notes: noteText } : t));
    setEditingNoteId(null);
  };

  const toggleNoteExpand = (id: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderItem = (item: TodoItem) => {
    const isEditing = editingId === item.id;
    const isEditingNote = editingNoteId === item.id;
    const isExpanded = expandedNotes.has(item.id);
    const hasNote = !!item.notes?.trim();

    return (
      <div key={item.id} className="group/item">
        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg transition-colors ${item.completed ? 'opacity-60' : 'hover:bg-slate-50'}`}>
          {/* Checkbox */}
          <button
            onClick={() => handleToggle(item.id)}
            className={`mt-0.5 shrink-0 transition-colors ${item.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}
          >
            {item.completed ? <CheckSquareIcon className="w-4 h-4" /> : <SquareIcon className="w-4 h-4" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex gap-1">
                <input
                  ref={editInputRef}
                  className="flex-1 text-xs p-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditSave(item.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <button onClick={() => handleEditSave(item.id)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded">
                  <CheckIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div>
                <p className={`text-xs leading-relaxed ${item.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                  {item.text}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1" title={formatFullTimestamp(item.createdAt)}>
                    <ClockIcon className="w-2.5 h-2.5" /> {formatTimestamp(item.createdAt)}
                  </span>
                  {item.completedAt && (
                    <span className="text-[10px] text-emerald-500 flex items-center gap-1" title={formatFullTimestamp(item.completedAt)}>
                      <CheckIcon className="w-2.5 h-2.5" /> {formatTimestamp(item.completedAt)}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-300">{item.createdByName}</span>
                </div>
              </div>
            )}

            {/* Note area */}
            {(hasNote || isExpanded) && !isEditing && (
              <div className="mt-1">
                {isEditingNote ? (
                  <div className="mt-1">
                    <textarea
                      ref={noteInputRef}
                      className="w-full text-[11px] p-2 border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
                      rows={3}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingNoteId(null);
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleNoteSave(item.id);
                      }}
                      placeholder="Add notes..."
                    />
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => handleNoteSave(item.id)} className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700">
                        Save
                      </button>
                      <button onClick={() => setEditingNoteId(null)} className="text-[10px] px-2 py-0.5 text-slate-400 hover:text-slate-600">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : hasNote ? (
                  <p className="text-[11px] text-slate-500 bg-slate-50 px-2 py-1.5 rounded-lg mt-1 whitespace-pre-wrap leading-relaxed">
                    {item.notes}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  if (hasNote || expandedNotes.has(item.id)) {
                    setEditingNoteId(item.id);
                    setNoteText(item.notes || '');
                  } else {
                    setExpandedNotes(prev => new Set(prev).add(item.id));
                    setEditingNoteId(item.id);
                    setNoteText('');
                  }
                }}
                className="p-1 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors"
                title="Add/edit note"
              >
                <StickyNoteIcon className="w-3 h-3" />
              </button>
              <button
                onClick={() => { setEditingId(item.id); setEditText(item.text); }}
                className="p-1 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                title="Edit"
              >
                <PencilIcon className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <Trash2Icon className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <ListTodoIcon className="w-4 h-4" /> Case To-Do List
        </h3>
        <div className="flex items-center gap-2">
          {completed.length > 0 && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {completed.length} done
            </span>
          )}
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {pending.length} open
          </span>
        </div>
      </div>

      {/* Add new item */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all"
            placeholder="Add a task..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <PlusIcon className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Pending items */}
      <div className="max-h-80 overflow-y-auto">
        {pending.length === 0 && completed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-300">
            <CheckSquareIcon className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs italic">No tasks yet. Add one above!</p>
          </div>
        ) : (
          <div className="py-1">
            {pending.map(renderItem)}
          </div>
        )}
      </div>

      {/* Completed section */}
      {completed.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-50 transition-colors"
          >
            {showCompleted ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
            {completed.length} completed task{completed.length !== 1 ? 's' : ''}
          </button>
          {showCompleted && (
            <div className="pb-1">
              {completed.map(renderItem)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CaseTodoList;
