
import React, { useState, useEffect } from 'react';
import { 
  XIcon, 
  FolderIcon, 
  FileTextIcon, 
  ChevronRightIcon, 
  ArrowLeftIcon,
  Loader2Icon,
  CloudIcon,
  AlertCircleIcon,
  CheckIcon,
  PlusIcon,
  FolderPlusIcon,
  FolderDownIcon,
  CheckSquareIcon,
  SquareIcon,
  SaveIcon
} from 'lucide-react';
import { listDriveFiles, createDriveFolder, getRecursiveFiles, DriveImportCandidate } from '../services/googleDriveService';

interface DriveBrowserModalProps {
  accessToken: string;
  mode?: 'FILE' | 'FOLDER' | 'SAVE_DESTINATION';
  onSelectFile?: (files: DriveImportCandidate[]) => void;
  onSelectFolder?: (folder: any) => void;
  onClose: () => void;
  initialFolderStack?: {id: string, name: string}[];
  onStackChange?: (stack: {id: string, name: string}[]) => void;
}

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

const DriveBrowserModal: React.FC<DriveBrowserModalProps> = ({ 
  accessToken, 
  mode = 'FILE', 
  onSelectFile, 
  onSelectFolder, 
  onClose,
  initialFolderStack,
  onStackChange
}) => {
  const [folderStack, setFolderStack] = useState<{id: string, name: string}[]>(
    initialFolderStack && initialFolderStack.length > 0 
      ? initialFolderStack 
      : [{ id: 'root', name: 'My Drive' }]
  );
  const [items, setItems] = useState<DriveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Multi-Select State
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  
  // Folder Import State
  const [isScanning, setIsScanning] = useState(false);
  const [importStats, setImportStats] = useState<{count: number, candidates: DriveImportCandidate[], sourceName?: string} | null>(null);

  // New Folder Creation State
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);

  const currentFolder = folderStack[folderStack.length - 1];

  // Notify parent of navigation changes
  useEffect(() => {
    if (onStackChange) {
      onStackChange(folderStack);
    }
  }, [folderStack, onStackChange]);

  useEffect(() => {
    loadFolder(currentFolder.id);
    setSelectedFileIds(new Set()); // Reset selections on navigation
    setImportStats(null);
  }, [currentFolder.id]);

  const loadFolder = async (folderId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const files = await listDriveFiles(accessToken, folderId);
      setItems(files);
    } catch (err) {
      setError("Failed to load folder content.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsSubmittingFolder(true);
    try {
      await createDriveFolder(newFolderName, accessToken, currentFolder.id);
      setNewFolderName('');
      setIsCreatingFolder(false);
      // Reload current folder to show new item
      await loadFolder(currentFolder.id);
    } catch (e) {
      console.error(e);
      alert("Failed to create folder");
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  const toggleSelection = (itemId: string) => {
    const newSet = new Set(selectedFileIds);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedFileIds(newSet);
  };

  const handleItemClick = (item: DriveItem) => {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      // Always navigate into folders on main click, regardless of mode
      setFolderStack([...folderStack, { id: item.id, name: item.name }]);
    } else if (mode === 'FILE' && item.mimeType === 'application/pdf') {
      toggleSelection(item.id);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent, item: DriveItem) => {
    e.stopPropagation(); // Prevent navigation when clicking checkbox
    toggleSelection(item.id);
  };

  const handleSelectCurrentFolderAsCaseLink = () => {
    if (onSelectFolder) {
      onSelectFolder({
        id: currentFolder.id,
        name: currentFolder.name,
        url: `https://drive.google.com/drive/folders/${currentFolder.id}`
      });
      onClose();
    }
  };
  
  // 1. Logic to recursively scan CURRENT folder (Folder Mode)
  const handleScanCurrentFolderForImport = async () => {
    setIsScanning(true);
    try {
      const candidates = await getRecursiveFiles(accessToken, currentFolder.id, '/');
      setImportStats({
        count: candidates.length,
        candidates,
        sourceName: currentFolder.name
      });
    } catch (e) {
      console.error(e);
      alert("Failed to scan folder.");
      setIsScanning(false);
    }
  };

  // 2. Logic to recursively scan SELECTED folders (File Mode)
  const handleConfirmMultiFileImport = async () => {
    if (!onSelectFile) return;

    const selectedItems = items.filter(i => selectedFileIds.has(i.id));
    const files = selectedItems.filter(i => i.mimeType === 'application/pdf');
    const folders = selectedItems.filter(i => i.mimeType === 'application/vnd.google-apps.folder');

    // If only files are selected, import immediately
    if (folders.length === 0) {
      const candidates: DriveImportCandidate[] = files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        relativePath: '/' // Files from current view are at root of import
      }));
      onSelectFile(candidates);
      onClose();
      return;
    }

    // If folders are selected, we must scan recursively
    setIsScanning(true);
    try {
      let allCandidates: DriveImportCandidate[] = files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        relativePath: '/'
      }));

      for (const folder of folders) {
        // Fetch sub-files, preserving the folder name in path
        const subFiles = await getRecursiveFiles(accessToken, folder.id, `/${folder.name}/`);
        allCandidates = [...allCandidates, ...subFiles];
      }

      setImportStats({
        count: allCandidates.length,
        candidates: allCandidates,
        sourceName: `${selectedItems.length} selected items`
      });

    } catch (e) {
      console.error(e);
      alert("Failed to scan selected folders.");
      setIsScanning(false);
    }
  };

  // 3. Commit the import from Preview
  const handleConfirmImport = () => {
    if (importStats && onSelectFile) {
      onSelectFile(importStats.candidates);
      onClose();
    }
  };

  const handleBack = () => {
    if (folderStack.length > 1) {
      setFolderStack(folderStack.slice(0, -1));
    }
  };

  // Render Preview for Recursive Import
  if (isScanning && importStats) {
     return (
       <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
             <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                  <FolderDownIcon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Recursive Import Ready</h3>
                <p className="text-slate-500 text-sm mt-2">
                   Scanned <strong className="text-slate-800">{importStats.sourceName}</strong> and found <strong className="text-indigo-600">{importStats.count}</strong> document(s) across all subfolders.
                </p>
                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-400 text-left max-h-32 overflow-auto border border-slate-100">
                   <p className="font-bold mb-1 uppercase tracking-wider">Preview (Structure Preserved):</p>
                   {importStats.candidates.length === 0 ? (
                      <p className="italic text-slate-400">No PDF files found in selection.</p>
                   ) : (
                     importStats.candidates.slice(0, 5).map(c => (
                       <div key={c.id} className="truncate">• {c.relativePath}{c.name}</div>
                     ))
                   )}
                   {importStats.candidates.length > 5 && <div>• ... and {importStats.candidates.length - 5} more</div>}
                </div>
             </div>
             <div className="flex gap-3">
               <button 
                 onClick={() => { setIsScanning(false); setImportStats(null); }}
                 className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleConfirmImport}
                 disabled={importStats.candidates.length === 0}
                 className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none"
               >
                 Import All
               </button>
             </div>
          </div>
       </div>
     );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'FOLDER' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>
              {mode === 'FOLDER' ? <FolderPlusIcon className="w-6 h-6" /> : mode === 'SAVE_DESTINATION' ? <SaveIcon className="w-6 h-6 text-green-600" /> : <CloudIcon className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {mode === 'FOLDER' ? 'Select Case Folder' : mode === 'SAVE_DESTINATION' ? 'Select Destination' : 'Import Documents'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'FOLDER' ? 'Navigate to folder to Link or Import' : mode === 'SAVE_DESTINATION' ? 'Choose where to save the file' : 'Select files or folders to import recursively'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb / Navigation */}
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center gap-2 text-sm overflow-x-auto whitespace-nowrap">
           <button 
             onClick={handleBack} 
             disabled={folderStack.length <= 1}
             className="p-1.5 hover:bg-slate-200 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent mr-2 text-slate-600"
           >
             <ArrowLeftIcon className="w-4 h-4" />
           </button>
           <span className="font-semibold text-slate-600 flex items-center">
             {folderStack.map((folder, index) => (
               <React.Fragment key={folder.id}>
                 {index > 0 && <ChevronRightIcon className="w-3 h-3 mx-1 text-slate-400" />}
                 <span className="text-indigo-600 font-bold">
                   {folder.name}
                 </span>
               </React.Fragment>
             ))}
           </span>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
          {/* Create Folder Inline Form */}
          {isCreatingFolder && (
            <div className="p-3 mb-2 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-500 shrink-0">
                <FolderIcon className="w-5 h-5" />
              </div>
              <input 
                autoFocus
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New Folder Name..."
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
              <div className="flex gap-1">
                <button 
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || isSubmittingFolder}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmittingFolder ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsCreatingFolder(false)}
                  className="p-2 bg-white text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {isLoading || (isScanning && !importStats) ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Loader2Icon className="w-8 h-8 animate-spin mb-2 text-indigo-500" />
              <p className="text-xs font-medium">{isScanning ? 'Scanning structure recursively...' : 'Loading contents...'}</p>
            </div>
          ) : error ? (
             <div className="flex flex-col items-center justify-center h-48 text-red-400 p-4 text-center">
              <AlertCircleIcon className="w-8 h-8 mb-2" />
              <p className="text-sm font-medium text-slate-800 mb-1">Access Error</p>
              <p className="text-xs">{error}</p>
            </div>
          ) : items.length === 0 && !isCreatingFolder ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <FolderIcon className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-xs font-medium">This folder is empty.</p>
              <button onClick={() => setIsCreatingFolder(true)} className="mt-4 text-indigo-600 text-xs font-bold hover:underline">
                Create New Folder Here
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map(item => {
                const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
                const isSelected = selectedFileIds.has(item.id);
                // In FOLDER mode, disable file interactions. In SAVE mode, only allow folder navigation
                const isDisabled = (mode === 'FOLDER' || mode === 'SAVE_DESTINATION') && !isFolder;

                return (
                  <button
                    key={item.id}
                    onClick={() => !isDisabled && handleItemClick(item)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group text-left border ${
                      isSelected 
                        ? 'bg-indigo-50 border-indigo-200' 
                        : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'
                    } ${isDisabled ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
                  >
                    {/* Checkbox for FILE Mode */}
                    {mode === 'FILE' && (
                       <div 
                         onClick={(e) => handleCheckboxClick(e, item)}
                         className={`shrink-0 cursor-pointer p-1 -ml-1 ${isSelected ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-400 hover:text-indigo-400'}`}
                       >
                         {isSelected ? <CheckSquareIcon className="w-5 h-5" /> : <SquareIcon className="w-5 h-5" />}
                       </div>
                    )}

                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isFolder
                        ? 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600' 
                        : 'bg-red-50 text-red-500'
                    }`}>
                      {isFolder ? (
                        <FolderIcon className="w-5 h-5" />
                      ) : (
                        <FileTextIcon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${
                         isFolder ? 'text-slate-700' : 'text-slate-900'
                      }`}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        {isFolder ? 'Folder' : `${(parseInt(item.size || '0') / 1024 / 1024).toFixed(2)} MB PDF`}
                      </p>
                    </div>
                    {isFolder && (
                      <ChevronRightIcon className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between gap-4">
          
          {mode === 'FOLDER' ? (
             // FOLDER MODE ACTIONS
             <>
               <div className="flex gap-2">
                 <button 
                   onClick={() => setIsCreatingFolder(true)}
                   className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                 >
                   <PlusIcon className="w-4 h-4" />
                   New Folder
                 </button>
                 <button 
                   onClick={handleScanCurrentFolderForImport}
                   className="flex items-center gap-2 px-3 py-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors"
                 >
                   <FolderDownIcon className="w-4 h-4" />
                   Import Folder Content
                 </button>
               </div>
               <button 
                 onClick={handleSelectCurrentFolderAsCaseLink}
                 className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-colors"
               >
                 <CheckIcon className="w-4 h-4" />
                 Link As Case Root
               </button>
             </>
          ) : mode === 'SAVE_DESTINATION' ? (
             // SAVE DESTINATION MODE (Reduced options)
             <>
                <button 
                   onClick={() => setIsCreatingFolder(true)}
                   className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                 >
                   <PlusIcon className="w-4 h-4" />
                   New Folder
                 </button>
                 <button 
                   onClick={handleSelectCurrentFolderAsCaseLink}
                   className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 shadow-md shadow-green-100 transition-colors"
                 >
                   <SaveIcon className="w-4 h-4" />
                   Save Here
                 </button>
             </>
          ) : (
             // FILE MODE ACTIONS
             <>
                <div className="text-xs font-bold text-slate-500">
                  {selectedFileIds.size} item(s) selected
                </div>
                <button 
                  onClick={handleConfirmMultiFileImport}
                  disabled={selectedFileIds.size === 0}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100 disabled:opacity-50 disabled:shadow-none transition-all"
                >
                  Import Selected
                </button>
             </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriveBrowserModal;
