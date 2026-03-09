import React, { useState, useMemo } from 'react';
import {
  ListTodoIcon,
  AlertTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CalendarIcon,
  FlagIcon,
  ArrowRightIcon,
  FilterIcon,
  BellIcon,
} from 'lucide-react';
import { Case, TodoItem, TodoPriority, TODO_PRIORITY_CONFIG, UserProfile } from '../types';
import { daysUntilDue, sortTodos } from './CaseTodoList';

interface AggregatedTodoViewProps {
  cases: Case[];
  currentUser: UserProfile;
  onSelectCase: (c: Case) => void;
  onUpdateCase: (c: Case) => void;
}

interface AugmentedTodo extends TodoItem {
  caseId: string;
  caseTitle: string;
}

type FilterTab = 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';

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

export default function AggregatedTodoView({ cases, currentUser, onSelectCase, onUpdateCase }: AggregatedTodoViewProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expanded, setExpanded] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  // Aggregate all todos across all cases
  const allTodos = useMemo<AugmentedTodo[]>(() => {
    const todos: AugmentedTodo[] = [];
    for (const c of cases) {
      if (!c.todoItems?.length) continue;
      for (const item of c.todoItems) {
        todos.push({ ...item, caseId: c.id, caseTitle: c.title });
      }
    }
    return todos;
  }, [cases]);

  const openTodos = useMemo(() => sortTodos(allTodos.filter(t => !t.completed)) as AugmentedTodo[], [allTodos]);
  const completedTodos = useMemo(() => allTodos.filter(t => t.completed).sort((a, b) =>
    new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()
  ) as AugmentedTodo[], [allTodos]);

  // Stats
  const overdueCount = openTodos.filter(t => { const d = daysUntilDue(t.dueDate); return d !== null && d < 0; }).length;
  const dueTodayCount = openTodos.filter(t => daysUntilDue(t.dueDate) === 0).length;
  const upcomingCount = openTodos.filter(t => { const d = daysUntilDue(t.dueDate); return d !== null && d > 0 && d <= 7; }).length;
  const urgentCount = openTodos.filter(t => t.priority === 'urgent').length;

  // Filtered list
  const filteredTodos = useMemo(() => {
    if (activeTab === 'completed') return completedTodos;
    return openTodos.filter(t => {
      const days = daysUntilDue(t.dueDate);
      switch (activeTab) {
        case 'overdue': return days !== null && days < 0;
        case 'today': return days === 0;
        case 'upcoming': return days !== null && days > 0 && days <= 7;
        default: return true;
      }
    });
  }, [activeTab, openTodos, completedTodos]);

  // Toggle completion from aggregated view
  const handleToggle = (todo: AugmentedTodo) => {
    const caseObj = cases.find(c => c.id === todo.caseId);
    if (!caseObj) return;
    const updatedItems = (caseObj.todoItems || []).map(t =>
      t.id === todo.id
        ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
        : t
    );
    onUpdateCase({ ...caseObj, todoItems: updatedItems });
  };

  if (allTodos.length === 0) return null; // Don't show if no todos exist

  const tabs: { key: FilterTab; label: string; count: number; icon: React.ReactNode; color: string }[] = [
    { key: 'all', label: 'All Open', count: openTodos.length, icon: <ListTodoIcon className="w-3.5 h-3.5" />, color: 'indigo' },
    { key: 'overdue', label: 'Overdue', count: overdueCount, icon: <AlertTriangleIcon className="w-3.5 h-3.5" />, color: 'red' },
    { key: 'today', label: 'Due Today', count: dueTodayCount, icon: <BellIcon className="w-3.5 h-3.5" />, color: 'amber' },
    { key: 'upcoming', label: 'This Week', count: upcomingCount, icon: <CalendarIcon className="w-3.5 h-3.5" />, color: 'blue' },
    { key: 'completed', label: 'Completed', count: completedTodos.length, icon: <CheckCircleIcon className="w-3.5 h-3.5" />, color: 'green' },
  ];

  return (
    <div className="mt-6 mx-auto max-w-6xl px-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDownIcon className="w-5 h-5 text-slate-400" /> : <ChevronRightIcon className="w-5 h-5 text-slate-400" />}
            <ListTodoIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-800">All Tasks</h2>
            <span className="text-sm text-slate-400">across {cases.filter(c => c.todoItems?.length).length} cases</span>
          </div>
          {/* Quick stats badges */}
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse">
                <AlertTriangleIcon className="w-3 h-3" /> {overdueCount} overdue
              </span>
            )}
            {dueTodayCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <BellIcon className="w-3 h-3" /> {dueTodayCount} due today
              </span>
            )}
            {urgentCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">
                <FlagIcon className="w-3 h-3" /> {urgentCount} urgent
              </span>
            )}
            <span className="text-sm text-slate-400 ml-1">{openTodos.length} open</span>
          </div>
        </button>

        {expanded && (
          <>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 px-5 pb-3 border-b border-slate-100 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? `bg-${tab.color}-100 text-${tab.color}-700 ring-1 ring-${tab.color}-200`
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  style={activeTab === tab.key ? {
                    backgroundColor: tab.color === 'indigo' ? '#e0e7ff' : tab.color === 'red' ? '#fee2e2' : tab.color === 'amber' ? '#fef3c7' : tab.color === 'blue' ? '#dbeafe' : '#dcfce7',
                    color: tab.color === 'indigo' ? '#3730a3' : tab.color === 'red' ? '#b91c1c' : tab.color === 'amber' ? '#92400e' : tab.color === 'blue' ? '#1e40af' : '#15803d',
                  } : undefined}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      activeTab === tab.key ? 'bg-white/60' : 'bg-slate-200/60'
                    }`}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Task list */}
            <div className="max-h-[400px] overflow-y-auto">
              {filteredTodos.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">
                  {activeTab === 'overdue' ? '🎉 No overdue tasks!' :
                   activeTab === 'today' ? 'Nothing due today' :
                   activeTab === 'upcoming' ? 'No upcoming deadlines this week' :
                   activeTab === 'completed' ? 'No completed tasks yet' :
                   'No open tasks across any cases'}
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {filteredTodos.map(todo => {
                    const days = daysUntilDue(todo.dueDate);
                    const isOverdue = days !== null && days < 0;
                    const isDueToday = days === 0;
                    const label = dueDateLabel(todo.dueDate);
                    const priConfig = TODO_PRIORITY_CONFIG[todo.priority || 'normal'];

                    return (
                      <div
                        key={`${todo.caseId}-${todo.id}`}
                        className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group ${
                          isOverdue ? 'bg-red-50/40' : isDueToday ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => handleToggle(todo)}
                          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            todo.completed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : isOverdue
                                ? 'border-red-400 hover:border-red-500'
                                : 'border-slate-300 hover:border-indigo-400'
                          }`}
                        >
                          {todo.completed && <CheckCircleIcon className="w-3 h-3" />}
                        </button>

                        {/* Priority dot */}
                        {todo.priority && todo.priority !== 'normal' && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: priConfig.color }} title={priConfig.label} />
                        )}

                        {/* Overdue icon */}
                        {isOverdue && !todo.completed && (
                          <AlertTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}

                        {/* Task text */}
                        <span className={`flex-1 text-sm ${todo.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {todo.text}
                        </span>

                        {/* Due date label */}
                        {label && !todo.completed && (
                          <span className={`text-xs ${label.className} flex-shrink-0`}>{label.text}</span>
                        )}

                        {/* Case badge + navigate */}
                        <button
                          onClick={() => {
                            const c = cases.find(c => c.id === todo.caseId);
                            if (c) onSelectCase(c);
                          }}
                          className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors max-w-[160px] truncate group"
                          title={`Go to ${todo.caseTitle}`}
                        >
                          <span className="truncate">{todo.caseTitle}</span>
                          <ArrowRightIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer summary */}
            {openTodos.length > 0 && (
              <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>{openTodos.length} open · {completedTodos.length} completed</span>
                {overdueCount > 0 && (
                  <span className="text-red-500 font-medium">⚠ {overdueCount} task{overdueCount > 1 ? 's' : ''} past due</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
