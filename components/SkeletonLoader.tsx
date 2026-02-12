import React from 'react';

interface SkeletonLoaderProps {
  type?: 'text' | 'timeline' | 'strategy' | 'research';
  lines?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type = 'text', lines = 5 }) => (
  <div className="skeleton-container animate-pulse">
    {type === 'text' && (
      <div className="space-y-2">
        {[...Array(lines)].map((_, i) => (
          <div
            key={i}
            className={`h-4 rounded bg-slate-200 ${i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-4/5' : 'w-3/4'}`}
          />
        ))}
      </div>
    )}
    {type === 'timeline' && (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-6 w-20 rounded bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-full rounded bg-slate-200" />
              <div className="h-3 w-4/5 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    )}
    {type === 'strategy' && (
      <div className="space-y-4">
        <div className="h-4 w-3/4 max-w-md rounded bg-slate-200" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-3 rounded-lg border border-slate-100 space-y-2">
            <div className="h-4 w-1/3 max-w-xs rounded bg-slate-200" />
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-2/3 max-w-sm rounded bg-slate-100" />
          </div>
        ))}
      </div>
    )}
    {type === 'research' && (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-3 rounded-lg border border-slate-100 space-y-2">
            <div className="h-4 w-2/3 max-w-md rounded bg-slate-200" />
            <div className="h-3 w-1/4 max-w-[6rem] rounded bg-slate-100" />
            <div className="h-3 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>
    )}
  </div>
);
