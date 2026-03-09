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
  CalendarIcon,
  AlertTriangleIcon,
  FlagIcon,
} from 'lucide-react';
import { TodoItem, TodoPriority, TODO_PRIORITY_CONFIG, UserProfile } from '../types';

interface CaseTodoListProps {
  todoItems: TodoItem[];
  currentUser: UserProfile;
  onUpdate: (items: TodoItem[]) => void;
}

// ── Helpers ──────────────────────────────────────────────

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
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
};

/** Days until due. Negative = overdue. null = no due date */
export const daysUntilDue = (dueDate?: string): number | null => {
  if (!dueDate) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00'); due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
};

const dueDateLabel = (dueDate?: string): { text: string; className: string } | null => {
  const days = daysUntilDue(dueDate);
  if (days === null) return null;
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, className: 'text-red-600 font-bold' };
  if (days === 0) return { text: 'Due today', className: 'text-amber-600 font-bold' };
  if (days === 1) return { text: 'Due tomorrow', className: 'text-amber-500' };
  if (days <= 3) return { text: `Due in ${days}d`, className: 'text-amber-500' };
  if (days <= 7) return { text: `Due in ${days}d`, className: 'text-slate-500' };
  return { text: new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), className: 'text-slate-400' };
};

const PRIORITY_ORDER: Record<TodoPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/** Sort: overdue first, then by priority, then by due date (soonest first), then newest */
export const sortTodos = (items: TodoItem[]): TodoItem[] => {
  return [...items].sort((a, b) => {
    const aDays = daysUntilDue(a.dueDate);
    const bDays = daysUntilDue(b.dueDate);
    const aOverdue = aDays !== null && aDays < 0;
    const bOverdue = bDays !== null && bDays < 0;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    const aPri = PRIORITY_ORDER[a.priority || 'normal'];
    const bPri = PRIORITY_ORDER[b.priority || 'normal'];
    if (aPri !== bPri) return aPri - bPri;
    if (aDays !== null && bDays !== null) return aDays - bDays;
    if (aDays !== null) return -1;
    if (bDays !== null) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

// ── Priority dropdown ────────────────────────────────────

const PriorityPicker: React.FC<{ current: TodoPriority; onChange: (p: TodoPriority) => void }> = ({ current, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const cfg = TODO_PRIORITY_CONFIG[current];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors" title="Set priority">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[120px] animate-in fade-in zoom-in-95 duration-100">
          {(Object.keys(TODO_PRIORITY_CONFIG) as TodoPriority[]).map(p => {
            const c = TODO_PRIORITY_CONFIG[p];
            return (
              <button key={p} onClick={() => { onChange(p); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors ${p === current ? 'bg-slate-50 font-semibold' : ''}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-slate-700">{c.label}</span>
                {p === current && <CheckIcon className="w-3 h-3 text-indigo-600 ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────

const CaseTodoList: React.FC<CaseTodoListProps> = ({ todoItems, currentUser, onUpdate }) => {
  const [newText, setNewText] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('normal');
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editingId && editInputRef.current) editInputRef.current.focus(); }, [editingId]);
  useEffect(() => { if (editingNoteId && noteInputRef.current) noteInputRef.current.focus(); }, [editingNoteId]);

  const pending = sortTodos(todoItems.filter(t => !t.completed));
  const completed = todoItems.filter(t => t.completed);
  const overdueCount = pending.filter(t => { const d = daysUntilDue(t.dueDate); return d !== null && d < 0; }).length;

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const item: TodoItem = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      notes: '',
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate: newDueDate || undefined,
      priority: newPriority,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
    };
    onUpdate([item, ...todoItems]);
    setNewText('');
    setNewDueDate('');
    setNewPriority('normal');
    setShowAddOptions(false);
    inputRef.current?.focus();
  };

  const handleToggle = (id: string) => {
    onUpdate(todoItems.map(t => t.id !== id ? t : { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }));
  };

  const handleDelete = (id: string) => onUpdate(todoItems.filter(t => t.id !== id));

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

  const handleSetDueDate = (id: string, date: string) => {
    onUpdate(todoItems.map(t => t.id === id ? { ...t, dueDate: date || undefined } : t));
  };

  const handleSetPriority = (id: string, priority: TodoPriority) => {
    onUpdate(todoItems.map(t => t.id === id ? { ...t, priority } : t));
  };

  const renderItem = (item: TodoItem) => {
    const isEditing = editingId === item.id;
    const isEditingNote = editingNoteId === item.id;
    const hasNote = !!item.notes?.trim();
    const due = dueDateLabel(item.dueDate);
    const days = daysUntilDue(item.dueDate);
    const isOverdue = days !== null && days < 0 && !item.completed;
    const priCfg = TODO_PRIORITY_CONFIG[item.priority || 'normal'];

    return (
      <div key={item.id} className="group/item">
        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg transition-colors ${isOverdue ? 'bg-red-50/50' : item.completed ? 'opacity-60' : 'hover:bg-slate-50'}`}>
          {/* Checkbox */}
          <button onClick={() => handleToggle(item.id)}
            className={`mt-0.5 shrink-0 transition-colors ${item.completed ? 'text-emerald-500' : isOverdue ? 'text-red-400 hover:text-red-600' : 'text-slate-300 hover:text-indigo-500'}`}>
            {item.completed ? <CheckSquareIcon className="w-4 h-4" /> : <SquareIcon className="w-4 h-4" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex gap-1">
                <input ref={editInputRef} className="flex-1 text-xs p-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  value={editText} onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(item.id); if (e.key === 'Escape') setEditingId(null); }} />
                <button onClick={() => handleEditSave(item.id)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><CheckIcon className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><XIcon className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div>
                <p className={`text-xs leading-relaxed ${item.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                  {isOverdue && <AlertTriangleIcon className="w-3 h-3 text-red-500 inline mr-1 -mt-0.5" />}
                  {item.text}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {/* Priority badge */}
                  {item.priority && item.priority !== 'normal' && (
                    <span className={`text-[10px] font-bold px-1.5 py-0 rounded ${priCfg.bgColor} ${priCfg.textColor}`}>
                      {priCfg.label}
                    </span>
                  )}
                  {/* Due date */}
                  {due && (
                    <span className={`text-[10px] flex items-center gap-0.5 ${due.className}`}>
                      <CalendarIcon className="w-2.5 h-2.5" /> {due.text}
                    </span>
                  )}
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
            {(hasNote || expandedNotes.has(item.id)) && !isEditing && (
              <div className="mt-1">
                {isEditingNote ? (
                  <div className="mt-1">
                    <textarea ref={noteInputRef} className="w-full text-[11px] p-2 border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
                      rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setEditingNoteId(null); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleNoteSave(item.id); }}
                      placeholder="Add notes..." />
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => handleNoteSave(item.id)} className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700">Save</button>
                      <button onClick={() => setEditingNoteId(null)} className="text-[10px] px-2 py-0.5 text-slate-400 hover:text-slate-600">Cancel</button>
                    </div>
                  </div>
                ) : hasNote ? (
                  <p className="text-[11px] text-slate-500 bg-slate-50 px-2 py-1.5 rounded-lg mt-1 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
                ) : null}
              </div>
            )}
          </div>

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
              <PriorityPicker current={item.priority || 'normal'} onChange={(p) => handleSetPriority(item.id, p)} />
              <input type="date" className="w-[18px] h-[18px] opacity-0 absolute" title="Set due date"
                value={item.dueDate || ''} onChange={(e) => handleSetDueDate(item.id, e.target.value)} />
              <button onClick={() => {
                const el = document.createElement('input');
                el.type = 'date';
                el.value = item.dueDate || '';
                el.onchange = () => handleSetDueDate(item.id, el.value);
                el.showPicker?.();
              }} className="p-1 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors" title="Set due date">
                <CalendarIcon className="w-3 h-3" />
              </button>
              <button onClick={() => {
                if (hasNote || expandedNotes.has(item.id)) { setEditingNoteId(item.id); setNoteText(item.notes || ''); }
                else { setExpandedNotes(prev => new Set(prev).add(item.id)); setEditingNoteId(item.id); setNoteText(''); }
              }} className="p-1 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors" title="Add/edit note">
                <StickyNoteIcon className="w-3 h-3" />
              </button>
              <button onClick={() => { setEditingId(item.id); setEditText(item.text); }}
                className="p-1 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors" title="Edit">
                <PencilIcon className="w-3 h-3" />
              </button>
              <button onClick={() => handleDelete(item.id)}
                className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete">
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
          {overdueCount > 0 && (
            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangleIcon className="w-3 h-3" /> {overdueCount} overdue
            </span>
          )}
          {completed.length > 0 && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{completed.length} done</span>
          )}
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{pending.length} open</span>
        </div>
      </div>

      {/* Add new item */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex gap-2">
          <input ref={inputRef}
            className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all"
            placeholder="Add a task..."
            value={newText} onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !showAddOptions) handleAdd(); }}
            onFocus={() => setShowAddOptions(true)}
          />
          <button onClick={handleAdd} disabled={!newText.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
            <PlusIcon className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {showAddOptions && newText.trim() && (
          <div className="flex items-center gap-3 mt-2 animate-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-3 h-3 text-slate-400" />
              <input type="date" className="text-[11px] p-1 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white"
                value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-1.5">
              <FlagIcon className="w-3 h-3 text-slate-400" />
              <select className="text-[11px] p-1 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white"
                value={newPriority} onChange={(e) => setNewPriority(e.target.value as TodoPriority)}>
                {(Object.keys(TODO_PRIORITY_CONFIG) as TodoPriority[]).map(p => (
                  <option key={p} value={p}>{TODO_PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Pending items */}
      <div className="max-h-80 overflow-y-auto">
        {pending.length === 0 && completed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-300">
            <CheckSquareIcon className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs italic">No tasks yet. Add one above!</p>
          </div>
        ) : (
          <div className="py-1">{pending.map(renderItem)}</div>
        )}
      </div>

      {/* Completed section */}
      {completed.length > 0 && (
        <div className="border-t border-slate-100">
          <button onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-50 transition-colors">
            {showCompleted ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
            {completed.length} completed task{completed.length !== 1 ? 's' : ''}
          </button>
          {showCompleted && <div className="pb-1">{completed.map(renderItem)}</div>}
        </div>
      )}
    </div>
  );
};

export default CaseTodoList;
