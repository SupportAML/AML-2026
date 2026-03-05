import React, { useRef, useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { FolderOpenIcon, Loader2Icon, ScanIcon } from 'lucide-react';
import type { DicomAnnotationData } from './DicomStudyViewer';
import type { Case } from '../types';
import { filterDicomFiles } from '../services/dicomParserService';

const DicomStudyViewerComponent = lazy(() => import('./DicomStudyViewer'));

// ============================================================
// Error boundary for the viewer
// ============================================================
class DicomViewerErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
          <p className="text-sm">DICOM viewer encountered an error: {this.state.error}</p>
          <button onClick={() => { this.setState({ hasError: false, error: '' }); this.props.onReset(); }}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-bold hover:bg-cyan-700">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// Props
// ============================================================
interface DicomViewerPageProps {
  cases: Case[];
  currentUser: { id: string; name: string };
  onSaveAnnotation: (data: DicomAnnotationData) => void;
}

// ============================================================
// Component
// ============================================================
const DicomViewerPage: React.FC<DicomViewerPageProps> = ({ cases, currentUser, onSaveAnnotation }) => {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [dicomFiles, setDicomFiles] = useState<File[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(false);

  // On mount, immediately open folder picker
  useEffect(() => {
    if (!hasPrompted) {
      setHasPrompted(true);
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        folderInputRef.current?.click();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasPrompted]);

  const handleFolderSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    try {
      const allFiles = Array.from(files);
      const validated = await filterDicomFiles(allFiles);
      setDicomFiles(validated);
    } catch (err) {
      console.error('[DicomViewerPage] Error filtering DICOM files:', err);
    } finally {
      setIsParsing(false);
      // Reset input so same folder can be re-selected
      if (e.target) e.target.value = '';
    }
  }, []);

  const handleSelectNewFolder = () => {
    folderInputRef.current?.click();
  };

  const handleReset = () => {
    setDicomFiles([]);
  };

  const activeCases = cases.filter(c => c.status === 'active');

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Hidden folder input */}
      {/* @ts-expect-error — webkitdirectory is a non-standard attribute for folder selection */}
      <input type="file" ref={folderInputRef} onChange={handleFolderSelect} className="hidden" multiple webkitdirectory="" />

      {isParsing && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2Icon className="w-8 h-8 text-cyan-500 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Scanning for DICOM files...</p>
        </div>
      )}

      {!isParsing && dicomFiles.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
            <ScanIcon className="w-8 h-8 text-cyan-500" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-white mb-1">DICOM Viewer</h3>
            <p className="text-sm text-slate-400">Select a folder containing DICOM images to begin</p>
          </div>
          <button
            onClick={handleSelectNewFolder}
            className="flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white rounded-xl font-bold text-sm hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-900/30"
          >
            <FolderOpenIcon className="w-4 h-4" />
            Select DICOM Folder
          </button>
        </div>
      )}

      {!isParsing && dicomFiles.length > 0 && (
        <DicomViewerErrorBoundary onReset={handleReset}>
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <Loader2Icon className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
          }>
            <DicomStudyViewerComponent
              files={dicomFiles}
              onClose={handleReset}
              onSaveAnnotation={onSaveAnnotation}
              caseId=""
              authorName={currentUser.name}
              cases={activeCases}
              onSelectNewFolder={handleSelectNewFolder}
            />
          </Suspense>
        </DicomViewerErrorBoundary>
      )}
    </div>
  );
};

export default DicomViewerPage;
