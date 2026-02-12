import React from 'react';
import { UploadIcon } from 'lucide-react';

interface UploadProgressProps {
  progress: number;
  fileName: string;
  isUploading: boolean;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  progress,
  fileName,
  isUploading
}) => {
  if (!isUploading) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-5 min-w-[280px] max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <UploadIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-sm truncate">{fileName}</h3>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              Uploading…
            </p>
          </div>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-slate-600">{progress.toFixed(1)}% complete</span>
          {progress < 100 && (
            <span className="text-slate-400 text-[10px]">You can continue working</span>
          )}
        </div>
      </div>
    </div>
  );
};
