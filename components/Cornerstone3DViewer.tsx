import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  UploadIcon, RotateCcwIcon, Loader2Icon,
  FileIcon, ScanIcon, InfoIcon, FolderOpenIcon,
  ChevronDownIcon, ChevronRightIcon, LayersIcon
} from 'lucide-react';

// ============================================================
// Static imports — component is already lazy-loaded via React.lazy()
// This prevents module duplication that breaks instanceof checks
// ============================================================
import {
  RenderingEngine,
  Enums as csEnums,
  metaData,
  init as csInit,
  type Types,
} from '@cornerstonejs/core';

import {
  init as csToolsInit,
  addTool,
  ToolGroupManager,
  StackScrollTool,
  WindowLevelTool,
  ZoomTool,
  PanTool,
  Enums as csToolsEnums,
} from '@cornerstonejs/tools';

import {
  init as csDicomInit,
  wadouri,
} from '@cornerstonejs/dicom-image-loader';

// ============================================================
// Types
// ============================================================
interface UploadedFile {
  file: File;
  name: string;
  path: string;
  isDicom: boolean;
  imageId: string | null;
}

interface DicomMeta {
  patientName?: string;
  studyDescription?: string;
  seriesDescription?: string;
  modality?: string;
  instanceNumber?: number;
}

/** Per-file DICOM metadata extracted from standard tags */
interface FileDicomMeta {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  studyDescription?: string;
  seriesDescription?: string;
  seriesNumber?: number;
  instanceNumber?: number;
  modality?: string;
  patientName?: string;
}

/** Sidebar grouping: Series within a Study */
interface SeriesGroup {
  seriesUID: string;
  seriesDescription: string;
  seriesNumber: number;
  modality: string;
  files: UploadedFile[];
  representativeImageId: string | null;
}

/** Sidebar grouping: Study */
interface StudyGroup {
  studyUID: string;
  studyDescription: string;
  patientName: string;
  series: SeriesGroup[];
  totalFiles: number;
}

// Non-DICOM extensions to skip
const NON_DICOM_EXT = new Set([
  'inf', 'ini', 'txt', 'exe', 'dll', 'sys', 'bat', 'cmd', 'com', 'msi',
  'config', 'cfg', 'conf', 'reg', 'manifest', 'pdb', 'plist',
  'html', 'htm', 'css', 'js', 'json', 'xml', 'log', 'yaml', 'yml', 'csv',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'svg', 'ico', 'webp',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'cab',
  'mp3', 'mp4', 'avi', 'mov', 'wmv', 'wav', 'flac', 'mkv', 'webm',
  'db', 'sqlite', 'mdb', 'lnk', 'url', 'desktop', 'iso',
  'ds_store', 'thumbs', 'tmp', 'bak', 'old', 'swp',
]);

function isProbablyDicomByName(file: File): boolean {
  const name = file.name;
  if (name.startsWith('.') || name === 'Thumbs.db' || name === 'desktop.ini') return false;
  if (name.toUpperCase() === 'DICOMDIR') return false;
  if (file.size < 200) return false;
  const parts = name.split('.');
  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i++) {
      if (NON_DICOM_EXT.has(parts[i].toLowerCase())) return false;
    }
  }
  return true;
}

/** Read first 132 bytes and check for DICM magic at offset 128 */
async function isDicomFile(file: File): Promise<boolean> {
  if (!isProbablyDicomByName(file)) return false;
  try {
    const header = await file.slice(0, 132).arrayBuffer();
    const view = new Uint8Array(header);
    // DICM magic bytes at offset 128
    return view[128] === 0x44 && view[129] === 0x49 && view[130] === 0x43 && view[131] === 0x4D;
  } catch {
    return false;
  }
}

// ============================================================
// Singleton init — ensures Cornerstone3D libraries init exactly once
// ============================================================
let csInitDone = false;
let csInitPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (csInitDone) return Promise.resolve();
  if (!csInitPromise) {
    csInitPromise = (async () => {
      console.log('[CS3D] Initializing...');
      await csInit();
      await csDicomInit({ maxWebWorkers: navigator.hardwareConcurrency || 1 });
      await csToolsInit();

      // Register tools globally once
      addTool(StackScrollTool);
      addTool(WindowLevelTool);
      addTool(ZoomTool);
      addTool(PanTool);

      csInitDone = true;
      console.log('[CS3D] Init complete');
    })();
  }
  return csInitPromise;
}

// ============================================================
// Component
// ============================================================
let instanceCounter = 0;

const Cornerstone3DViewer: React.FC = () => {
  // Generate unique IDs per component instance
  const idsRef = useRef(() => {
    const id = ++instanceCounter;
    return {
      engineId: `cs3d-engine-${id}`,
      viewportId: `cs3d-vp-${id}`,
      toolGroupId: `cs3d-tg-${id}`,
    };
  });
  const ids = useRef(idsRef.current()).current;

  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);
  const [currentSlice, setCurrentSlice] = useState(0);
  const [totalSlices, setTotalSlices] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showMeta, setShowMeta] = useState(false);
  const [activeMeta, setActiveMeta] = useState<DicomMeta | null>(null);
  const [viewportReady, setViewportReady] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [fileMeta, setFileMeta] = useState<Record<string, FileDicomMeta>>({});
  const [expandedStudies, setExpandedStudies] = useState<Set<string>>(new Set());
  const [activeSeriesUID, setActiveSeriesUID] = useState<string | null>(null);

  const viewportDivRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RenderingEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  // ===== STEP 1: Init libraries =====
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    ensureInit()
      .then(() => {
        if (cancelled) return;
        setIsInitialized(true);
      })
      .catch((err) => {
        console.error('[CS3D] Init failed:', err);
        if (!cancelled) setInitError(err?.message || 'Init failed');
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      try { ToolGroupManager.destroyToolGroup(ids.toolGroupId); } catch {}
      try { engineRef.current?.destroy(); } catch {}
      engineRef.current = null;
    };
  }, []);

  // ===== STEP 2: Create engine + viewport + tools once init is done and div is mounted =====
  useEffect(() => {
    if (!isInitialized || !viewportDivRef.current || engineRef.current) return;

    console.log('[CS3D] Creating rendering engine and viewport...');

    const engine = new RenderingEngine(ids.engineId);
    engineRef.current = engine;

    // Enable the stack viewport
    engine.enableElement({
      viewportId: ids.viewportId,
      type: csEnums.ViewportType.STACK,
      element: viewportDivRef.current,
      defaultOptions: {
        background: [0, 0, 0] as Types.Point3,
      },
    });

    // Verify the viewport was created
    const vp = engine.getViewport(ids.viewportId);
    console.log('[CS3D] Viewport created:', !!vp, 'type:', vp?.type);

    // Create tool group
    let tg = ToolGroupManager.getToolGroup(ids.toolGroupId);
    if (!tg) {
      tg = ToolGroupManager.createToolGroup(ids.toolGroupId);
    }
    if (tg) {
      tg.addTool(WindowLevelTool.toolName);
      tg.addTool(StackScrollTool.toolName);
      tg.addTool(ZoomTool.toolName);
      tg.addTool(PanTool.toolName);
      tg.addViewport(ids.viewportId, ids.engineId);

      // Left-drag: Window/Level (brightness & contrast)
      tg.setToolActive(WindowLevelTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      });
      // Right-drag: Zoom in/out
      tg.setToolActive(ZoomTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
      });
      // Shift + Left-drag: Pan (instead of middle button)
      tg.setToolActive(PanTool.toolName, {
        bindings: [
          {
            mouseButton: csToolsEnums.MouseBindings.Primary,
            modifierKey: csToolsEnums.KeyboardBindings.Shift,
          },
        ],
      });
      // Mouse wheel: Stack scroll through slices
      tg.setToolActive(StackScrollTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
      });

      console.log('[CS3D] Tools configured');
    }

    // Suppress wheel events when viewport has no images (prevents "has no images" error)
    const el = viewportDivRef.current;
    if (el) {
      const suppressEmptyScroll = (e: WheelEvent) => {
        try {
          const vpCheck = engine.getViewport(ids.viewportId) as Types.IStackViewport;
          if (!vpCheck || !vpCheck.getImageIds || vpCheck.getImageIds().length === 0) {
            e.stopPropagation();
          }
        } catch {
          e.stopPropagation();
        }
      };
      el.addEventListener('wheel', suppressEmptyScroll, { capture: true });
    }

    setViewportReady(true);
  }, [isInitialized]);

  // ===== Listen for slice changes =====
  useEffect(() => {
    const el = viewportDivRef.current;
    if (!el || !viewportReady) return;

    const handler = () => {
      if (!engineRef.current) return;
      try {
        const vp = engineRef.current.getViewport(ids.viewportId) as Types.IStackViewport;
        if (vp) setCurrentSlice(vp.getCurrentImageIdIndex() + 1);
      } catch {}
    };

    el.addEventListener(csEnums.Events.STACK_NEW_IMAGE, handler);
    return () => el.removeEventListener(csEnums.Events.STACK_NEW_IMAGE, handler);
  }, [viewportReady]);

  // ===== Custom scroll handler — exactly 1 slice per wheel tick =====
  useEffect(() => {
    const el = viewportDivRef.current;
    if (!el || !viewportReady) return;

    const smoothScrollHandler = (e: WheelEvent) => {
      if (!engineRef.current) return;
      try {
        const vp = engineRef.current.getViewport(ids.viewportId) as Types.IStackViewport;
        if (!vp) return;
        const imgIds = vp.getImageIds();
        if (!imgIds || imgIds.length <= 1) return;

        // Exactly 1 slice per scroll tick — direction only
        const direction = e.deltaY > 0 ? 1 : -1;
        const currentIdx = vp.getCurrentImageIdIndex();
        const newIdx = Math.max(0, Math.min(imgIds.length - 1, currentIdx + direction));
        if (newIdx !== currentIdx) {
          vp.setImageIdIndex(newIdx);
        }

        // Prevent the event from reaching StackScrollTool
        e.stopPropagation();
        e.preventDefault();
      } catch {}
    };

    // Use capture phase to intercept before Cornerstone's wheel listener
    el.addEventListener('wheel', smoothScrollHandler, { capture: true, passive: false });
    return () => {
      el.removeEventListener('wheel', smoothScrollHandler, { capture: true } as any);
    };
  }, [viewportReady]);

  // ===== Process uploaded files =====
  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    if (!viewportReady) {
      console.warn('[CS3D] Not ready yet');
      return;
    }

    const arr = Array.from(fileList);
    console.log(`[CS3D] Processing ${arr.length} files...`);
    const processed: UploadedFile[] = [];

    // Validate DICOM magic bytes in parallel batches for speed
    const VALIDATE_BATCH = 50;
    for (let i = 0; i < arr.length; i += VALIDATE_BATCH) {
      const batch = arr.slice(i, i + VALIDATE_BATCH);
      const validations = await Promise.all(batch.map(f => isDicomFile(f)));

      for (let j = 0; j < batch.length; j++) {
        const file = batch[j];
        const relPath = (file as any).webkitRelativePath || file.name;
        const isValidDicom = validations[j];

        let imageId: string | null = null;
        if (isValidDicom) {
          try {
            imageId = wadouri.fileManager.add(file);
          } catch {
            // silently skip
          }
        }

        processed.push({
          file,
          name: file.name,
          path: relPath,
          isDicom: isValidDicom && imageId !== null,
          imageId,
        });
      }
    }

    const dicomCount = processed.filter(f => f.isDicom).length;
    console.log(`[CS3D] Found ${dicomCount} DICOM / ${processed.length} total`);

    setFiles(prev => {
      const newFiles = [...prev, ...processed];
      // Auto-load stack
      const allDicom = newFiles.filter(f => f.isDicom && f.imageId);
      if (allDicom.length > 0) {
        setTimeout(() => loadStackDirect(allDicom, 0, newFiles), 100);
      }
      return newFiles;
    });
  }, [viewportReady]);

  // ===== Load DICOM stack =====
  const loadStackDirect = async (
    dicomFiles: UploadedFile[],
    targetIndex: number,
    allFiles: UploadedFile[]
  ) => {
    if (!engineRef.current) {
      console.warn('[CS3D] Engine not ready');
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const imageIds = dicomFiles.map(f => f.imageId!);
      console.log(`[CS3D] Loading ${imageIds.length} images, target=${targetIndex}`);

      const vp = engineRef.current.getViewport(ids.viewportId) as Types.IStackViewport;
      if (!vp) {
        console.error('[CS3D] Viewport not found');
        setLoadError('Viewport not created. Reload the page.');
        setIsLoading(false);
        return;
      }

      // Set the stack and wait for it to load
      await vp.setStack(imageIds, targetIndex);
      vp.render();

      setTotalSlices(imageIds.length);
      setCurrentSlice(targetIndex + 1);

      // Highlight active file
      const targetDicom = dicomFiles[targetIndex];
      const globalIdx = allFiles.findIndex(f => f === targetDicom);
      if (globalIdx !== -1) setActiveFileIndex(globalIdx);

      // Extract metadata after image loads
      setTimeout(() => {
        try {
          const patient = metaData.get('patientModule', imageIds[targetIndex]);
          const study = metaData.get('generalStudyModule', imageIds[targetIndex]);
          const series = metaData.get('generalSeriesModule', imageIds[targetIndex]);
          const img = metaData.get('generalImageModule', imageIds[targetIndex]);

          setActiveMeta({
            patientName: patient?.patientName?.Alphabetic || patient?.patientName || undefined,
            studyDescription: study?.studyDescription || undefined,
            seriesDescription: series?.seriesDescription || undefined,
            modality: series?.modality || undefined,
            instanceNumber: img?.instanceNumber || undefined,
          });
        } catch {
          setActiveMeta(null);
        }
      }, 500);

      // Generate thumbnails in background
      generateThumbnails(dicomFiles);

      console.log('[CS3D] Stack loaded and rendered');
    } catch (err: any) {
      console.error('[CS3D] Load error:', err);
      setLoadError(err?.message || 'Failed to load DICOM');
    } finally {
      setIsLoading(false);
    }
  };

  // ===== Compute study/series grouping from extracted metadata =====
  const studyGroups: StudyGroup[] = React.useMemo(() => {
    const dicom = files.filter(f => f.isDicom && f.imageId);
    if (dicom.length === 0 || Object.keys(fileMeta).length === 0) return [];

    // Group by Study UID → Series UID
    const studyMap = new Map<string, { meta: FileDicomMeta; seriesMap: Map<string, UploadedFile[]> }>();
    for (const f of dicom) {
      const meta = f.imageId ? fileMeta[f.imageId] : null;
      const studyUID = meta?.studyInstanceUID || 'unknown-study';
      const seriesUID = meta?.seriesInstanceUID || 'unknown-series';

      if (!studyMap.has(studyUID)) {
        studyMap.set(studyUID, { meta: meta || { studyInstanceUID: studyUID, seriesInstanceUID: seriesUID }, seriesMap: new Map() });
      }
      const entry = studyMap.get(studyUID)!;
      if (!entry.seriesMap.has(seriesUID)) {
        entry.seriesMap.set(seriesUID, []);
      }
      entry.seriesMap.get(seriesUID)!.push(f);
    }

    const groups: StudyGroup[] = [];
    for (const [studyUID, { meta: studyMeta, seriesMap }] of studyMap) {
      const seriesList: SeriesGroup[] = [];
      for (const [seriesUID, seriesFiles] of seriesMap) {
        // Sort instances within series by Instance Number
        seriesFiles.sort((a, b) => {
          const ma = a.imageId ? fileMeta[a.imageId] : null;
          const mb = b.imageId ? fileMeta[b.imageId] : null;
          const na = ma?.instanceNumber ?? 9999;
          const nb = mb?.instanceNumber ?? 9999;
          return na - nb;
        });
        const firstMeta = seriesFiles[0]?.imageId ? fileMeta[seriesFiles[0].imageId] : null;
        // Representative thumbnail = middle instance
        const midIdx = Math.floor(seriesFiles.length / 2);
        seriesList.push({
          seriesUID,
          seriesDescription: firstMeta?.seriesDescription || 'Series',
          seriesNumber: firstMeta?.seriesNumber ?? 0,
          modality: firstMeta?.modality || '??',
          files: seriesFiles,
          representativeImageId: seriesFiles[midIdx]?.imageId || null,
        });
      }
      // Sort series by Series Number
      seriesList.sort((a, b) => a.seriesNumber - b.seriesNumber);

      groups.push({
        studyUID,
        studyDescription: studyMeta.studyDescription || 'Study',
        patientName: studyMeta.patientName || 'Unknown Patient',
        series: seriesList,
        totalFiles: seriesList.reduce((sum, s) => sum + s.files.length, 0),
      });
    }
    return groups;
  }, [files, fileMeta]);

  // ===== Click on a series to load its instances as a stack =====
  const handleSeriesClick = useCallback((seriesFiles: UploadedFile[], seriesUID: string) => {
    // Sort by instance number before loading
    const sorted = [...seriesFiles].sort((a, b) => {
      const ma = a.imageId ? fileMeta[a.imageId] : null;
      const mb = b.imageId ? fileMeta[b.imageId] : null;
      return (ma?.instanceNumber ?? 0) - (mb?.instanceNumber ?? 0);
    });
    setActiveSeriesUID(seriesUID);
    loadStackDirect(sorted, 0, files);
  }, [files, fileMeta]);

  // ===== Click on file in list (fallback for flat mode) =====
  const handleFileClick = useCallback((index: number) => {
    const f = files[index];
    if (!f.isDicom || !f.imageId) return;
    const dicomFiles = files.filter(ff => ff.isDicom && ff.imageId);
    const dicomIdx = dicomFiles.findIndex(ff => ff === f);
    if (dicomIdx === -1) return;
    loadStackDirect(dicomFiles, dicomIdx, files);
  }, [files]);

  // ===== Extract DICOM metadata for a single imageId =====
  const extractFileMeta = useCallback((imageId: string): FileDicomMeta | null => {
    try {
      const patient = metaData.get('patientModule', imageId);
      const study = metaData.get('generalStudyModule', imageId);
      const series = metaData.get('generalSeriesModule', imageId);
      const img = metaData.get('generalImageModule', imageId);
      return {
        studyInstanceUID: study?.studyInstanceUID || 'unknown-study',
        seriesInstanceUID: series?.seriesInstanceUID || 'unknown-series',
        studyDescription: study?.studyDescription || undefined,
        seriesDescription: series?.seriesDescription || undefined,
        seriesNumber: series?.seriesNumber != null ? Number(series.seriesNumber) : undefined,
        instanceNumber: img?.instanceNumber != null ? Number(img.instanceNumber) : undefined,
        modality: series?.modality || undefined,
        patientName: patient?.patientName?.Alphabetic || patient?.patientName || undefined,
      };
    } catch {
      return null;
    }
  }, []);

  // ===== Generate thumbnails AND extract metadata for DICOM files =====
  const generateThumbnails = useCallback(async (dicomFiles: UploadedFile[]) => {
    const THUMB_SIZE = 128;
    const BATCH_SIZE = 8;

    const { imageLoader } = await import('@cornerstonejs/core');

    const processOne = async (imageId: string): Promise<{ thumb: string | null; meta: FileDicomMeta | null }> => {
      try {
        const image = await imageLoader.loadAndCacheImage(imageId);
        if (!image) return { thumb: null, meta: null };

        // Extract metadata now that image is loaded
        const meta = extractFileMeta(imageId);

        // Render thumbnail
        const { rows, columns } = image;
        const pixelData = image.getPixelData();
        if (!pixelData || !rows || !columns) return { thumb: null, meta };

        let ww = image.windowWidth;
        let wc = image.windowCenter;
        if (Array.isArray(ww)) ww = ww[0];
        if (Array.isArray(wc)) wc = wc[0];
        if (!ww || !wc) {
          let min = Infinity, max = -Infinity;
          const step = pixelData.length > 65536 ? 4 : 1;
          for (let k = 0; k < pixelData.length; k += step) {
            if (pixelData[k] < min) min = pixelData[k];
            if (pixelData[k] > max) max = pixelData[k];
          }
          ww = max - min || 1;
          wc = (max + min) / 2;
        }

        const lower = (wc as number) - (ww as number) / 2;
        const range = (wc as number) + (ww as number) / 2 - lower || 1;
        const slope = image.slope || 1;
        const intercept = image.intercept || 0;

        const canvas = document.createElement('canvas');
        canvas.width = THUMB_SIZE;
        canvas.height = THUMB_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return { thumb: null, meta };

        const imgData = ctx.createImageData(THUMB_SIZE, THUMB_SIZE);
        const scaleX = columns / THUMB_SIZE;
        const scaleY = rows / THUMB_SIZE;
        const data = imgData.data;

        for (let y = 0; y < THUMB_SIZE; y++) {
          const srcY = Math.floor(y * scaleY) * columns;
          for (let x = 0; x < THUMB_SIZE; x++) {
            const raw = pixelData[srcY + Math.floor(x * scaleX)] || 0;
            const val = Math.max(0, Math.min(255, ((raw * slope + intercept - lower) / range) * 255));
            const idx = (y * THUMB_SIZE + x) * 4;
            data[idx] = val;
            data[idx + 1] = val;
            data[idx + 2] = val;
            data[idx + 3] = 255;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        return { thumb: canvas.toDataURL('image/jpeg', 0.6), meta };
      } catch {
        return { thumb: null, meta: null };
      }
    };

    // Process in parallel batches — extract thumbnails + metadata together
    const toProcess = dicomFiles.filter(f => f.imageId);
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(f => processOne(f.imageId!).then(r => ({ imageId: f.imageId!, ...r })))
      );

      const batchThumbs: Record<string, string> = {};
      const batchMeta: Record<string, FileDicomMeta> = {};
      for (const r of results) {
        if (r.thumb) batchThumbs[r.imageId] = r.thumb;
        if (r.meta) batchMeta[r.imageId] = r.meta;
      }
      if (Object.keys(batchThumbs).length > 0) {
        setThumbnails(prev => ({ ...prev, ...batchThumbs }));
      }
      if (Object.keys(batchMeta).length > 0) {
        setFileMeta(prev => {
          const next = { ...prev, ...batchMeta };
          // Auto-expand all studies on first metadata load
          const studyUIDs = new Set(Object.values(next).map(m => m.studyInstanceUID));
          setExpandedStudies(studyUIDs);
          return next;
        });
      }
    }
  }, [extractFileMeta]);

  // ===== Reset view =====
  const handleResetView = useCallback(() => {
    if (!engineRef.current) return;
    try {
      const vp = engineRef.current.getViewport(ids.viewportId) as Types.IStackViewport;
      if (vp) {
        vp.resetCamera();
        vp.resetProperties();
        vp.render();
      }
    } catch {}
  }, []);

  // ===== File input =====
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
    e.target.value = '';
  };

  // ===== Only show DICOM files in sidebar =====
  const dicomFiles = files.filter(f => f.isDicom);
  const nonDicomCount = files.length - dicomFiles.length;

  // ===== RENDER — viewport div ALWAYS in DOM =====
  return (
    <div className="w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700" style={{ minHeight: '580px' }}>
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <ScanIcon className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Cornerstone3D Viewer</h3>
          {files.length > 0 && (
            <span className="text-[10px] text-slate-500 ml-1">
              {dicomFiles.length} DICOM{nonDicomCount > 0 ? ` · ${nonDicomCount} skipped` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!viewportReady}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-all disabled:opacity-40"
          >
            <UploadIcon className="w-3.5 h-3.5" /> Files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={!viewportReady}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-[11px] font-bold rounded-lg transition-all disabled:opacity-40"
          >
            <FolderOpenIcon className="w-3.5 h-3.5" /> Folder
          </button>
          <input ref={fileInputRef} type="file" multiple accept=".dcm,.dicom,*/*" onChange={handleFileSelect} className="hidden" />
          {/* @ts-expect-error — webkitdirectory is a non-standard attribute for folder selection */}
          <input ref={folderInputRef} type="file" multiple webkitdirectory="" onChange={handleFileSelect} className="hidden" />
        </div>
      </div>

      {/* MAIN */}
      <div className="flex" style={{ height: '510px' }}>
        {/* LEFT: Study/Series sidebar — OHIF-style hierarchy */}
        <div className="w-[220px] border-r border-slate-700 flex flex-col overflow-hidden flex-shrink-0" style={{ backgroundColor: '#0d1117' }}>
          <div className="px-3 py-2 border-b border-slate-700/50">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Studies</span>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
            {dicomFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <UploadIcon className="w-8 h-8 text-slate-800 mb-3" />
                <p className="text-[11px] text-slate-600 leading-relaxed">Upload DICOM files<br />or a folder to begin</p>
              </div>
            ) : studyGroups.length > 0 ? (
              /* === Grouped by Study → Series using DICOM metadata === */
              <div className="py-1">
                {studyGroups.map((study) => {
                  const isExpanded = expandedStudies.has(study.studyUID);
                  return (
                    <div key={study.studyUID} className="mb-1">
                      {/* Study header */}
                      <button
                        onClick={() => setExpandedStudies(prev => {
                          const next = new Set(prev);
                          if (next.has(study.studyUID)) next.delete(study.studyUID);
                          else next.add(study.studyUID);
                          return next;
                        })}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-slate-800/60 transition-colors text-left"
                      >
                        {isExpanded
                          ? <ChevronDownIcon className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          : <ChevronRightIcon className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        }
                        <LayersIcon className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-slate-300 truncate">{study.studyDescription}</p>
                          <p className="text-[9px] text-slate-500 truncate">{study.patientName} &middot; {study.totalFiles} images</p>
                        </div>
                      </button>

                      {/* Series list */}
                      {isExpanded && study.series.map((series) => {
                        const isActiveSeries = activeSeriesUID === series.seriesUID;
                        const repThumb = series.representativeImageId ? thumbnails[series.representativeImageId] : null;
                        return (
                          <button
                            key={series.seriesUID}
                            onClick={() => handleSeriesClick(series.files, series.seriesUID)}
                            className={`w-full flex items-start gap-2 px-2 pl-6 py-1.5 transition-all text-left ${
                              isActiveSeries
                                ? 'bg-cyan-950/40 border-l-2 border-cyan-500'
                                : 'hover:bg-slate-800/40 border-l-2 border-transparent'
                            }`}
                          >
                            {/* Series thumbnail */}
                            <div className={`w-12 h-12 rounded flex-shrink-0 overflow-hidden border ${
                              isActiveSeries ? 'border-cyan-500' : 'border-slate-700'
                            }`}>
                              {repThumb ? (
                                <img src={repThumb} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                  <ScanIcon className="w-5 h-5 text-slate-700" />
                                </div>
                              )}
                            </div>
                            {/* Series info */}
                            <div className="min-w-0 flex-1 py-0.5">
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-[8px] font-bold bg-emerald-900/50 text-emerald-400 px-1 py-px rounded">
                                  {series.modality}
                                </span>
                                {series.seriesNumber > 0 && (
                                  <span className="text-[8px] text-slate-600">#{series.seriesNumber}</span>
                                )}
                              </div>
                              <p className={`text-[10px] truncate ${isActiveSeries ? 'text-cyan-300 font-semibold' : 'text-slate-400'}`}>
                                {series.seriesDescription}
                              </p>
                              <p className="text-[9px] text-slate-600">{series.files.length} images</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* === Flat fallback while metadata is loading === */
              <div className="p-2 space-y-2">
                {dicomFiles.map((f, dicomIdx) => {
                  const globalIdx = files.indexOf(f);
                  const isActive = globalIdx === activeFileIndex;
                  const thumb = f.imageId ? thumbnails[f.imageId] : null;
                  return (
                    <button
                      key={`${f.name}-${dicomIdx}`}
                      onClick={() => handleFileClick(globalIdx)}
                      className={`w-full rounded-lg overflow-hidden transition-all border-2 ${
                        isActive
                          ? 'border-cyan-500 shadow-lg shadow-cyan-500/20'
                          : 'border-transparent hover:border-slate-600'
                      }`}
                    >
                      <div className="relative w-full aspect-square bg-black">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-900/80">
                            <ScanIcon className={`w-8 h-8 ${isActive ? 'text-cyan-400' : 'text-slate-700'}`} />
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1">
                          <span className="text-[9px] font-bold text-cyan-400 bg-black/70 px-1.5 py-0.5 rounded">
                            {dicomIdx + 1}
                          </span>
                        </div>
                      </div>
                      <div className={`px-1.5 py-1 text-[9px] truncate text-center ${
                        isActive ? 'text-cyan-300 bg-cyan-950/40' : 'text-slate-500 bg-slate-900/60'
                      }`}>
                        {f.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {dicomFiles.length > 0 && (
            <div className="px-3 py-1.5 border-t border-slate-700/50">
              <p className="text-[9px] text-slate-600 text-center">
                {dicomFiles.length} images &middot; {studyGroups.length > 0
                  ? `${studyGroups.length} ${studyGroups.length === 1 ? 'study' : 'studies'}, ${studyGroups.reduce((s, g) => s + g.series.length, 0)} series`
                  : 'loading metadata...'
                }
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Viewport (ALWAYS in DOM) */}
        <div className="flex-1 relative bg-black overflow-hidden">
          {/* Init overlay */}
          {!isInitialized && !initError && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900">
              <Loader2Icon className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
              <p className="text-sm text-slate-400">Initializing Cornerstone3D...</p>
            </div>
          )}

          {/* Init error */}
          {initError && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900">
              <div className="bg-red-900/20 text-red-300 rounded-xl p-6 max-w-md text-center border border-red-800/30">
                <p className="text-sm font-bold mb-2">Initialization Failed</p>
                <p className="text-xs text-red-400">{initError}</p>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
              <Loader2Icon className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          )}

          {/* Load error */}
          {loadError && !isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80">
              <div className="bg-red-900/30 text-red-300 rounded-xl p-5 max-w-sm text-center border border-red-800/30">
                <p className="text-sm font-bold mb-1">Load Failed</p>
                <p className="text-xs text-red-400">{loadError}</p>
              </div>
            </div>
          )}

          {/* Slice indicator */}
          {totalSlices > 1 && !isLoading && (
            <div className="absolute top-3 right-3 z-10 bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg font-mono border border-slate-700/50">
              Slice {currentSlice} / {totalSlices}
            </div>
          )}

          {/* Metadata overlay */}
          {showMeta && activeMeta && (
            <div className="absolute top-3 left-3 z-10 bg-slate-900/90 backdrop-blur-sm text-white rounded-xl p-3 text-[10px] border border-slate-700 max-w-xs">
              {activeMeta.patientName && <div className="mb-0.5"><span className="text-slate-400">Patient:</span> {activeMeta.patientName}</div>}
              {activeMeta.modality && <div className="mb-0.5"><span className="text-slate-400">Modality:</span> {activeMeta.modality}</div>}
              {activeMeta.studyDescription && <div className="mb-0.5"><span className="text-slate-400">Study:</span> {activeMeta.studyDescription}</div>}
              {activeMeta.seriesDescription && <div><span className="text-slate-400">Series:</span> {activeMeta.seriesDescription}</div>}
            </div>
          )}

          {/* Empty state */}
          {viewportReady && files.length === 0 && !loadError && (
            <div className="absolute inset-0 z-5 flex flex-col items-center justify-center pointer-events-none">
              <ScanIcon className="w-12 h-12 text-slate-800 mb-3" />
              <p className="text-sm text-slate-600 font-medium">No DICOM images loaded</p>
              <p className="text-xs text-slate-700 mt-1">Upload files or a folder to begin</p>
            </div>
          )}

          {/* Cornerstone3D viewport div — ALWAYS present */}
          <div
            ref={viewportDivRef}
            className="w-full h-full"
            style={{ background: '#000' }}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetView}
            disabled={!viewportReady || files.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RotateCcwIcon className="w-3.5 h-3.5" /> Reset View
          </button>
          {activeMeta && (
            <button
              onClick={() => setShowMeta(!showMeta)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg transition-all ${
                showMeta ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <InfoIcon className="w-3.5 h-3.5" /> Metadata
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400/60" />
            <strong className="text-slate-300">Left Click</strong> + Drag → Brightness / Contrast
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-orange-400/60" />
            <strong className="text-slate-300">Right Click</strong> + Drag → Zoom
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-400/60" />
            <strong className="text-slate-300">Shift</strong> + Left Drag → Pan
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400/60" />
            <strong className="text-slate-300">Scroll Wheel</strong> → Change Slices
          </span>
        </div>
      </div>
    </div>
  );
};

export default Cornerstone3DViewer;
