import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ZoomInIcon, RotateCcwIcon,
  SunIcon, RulerIcon, Loader2Icon,
  MoveIcon, InfoIcon, FolderOpenIcon,
  LayersIcon, XIcon, ChevronRightIcon, ChevronDownIcon,
  FolderIcon, FileIcon, ImageIcon, Undo2Icon,
  CircleIcon, SquareIcon, HandIcon,
  MaximizeIcon, GridIcon
} from 'lucide-react';
import {
  App as DwvApp, AppOptions, ViewConfig,
  WindowLevel as DwvWindowLevel,
  ScrollWheel
} from 'dwv';

// ============================================================
// DICOM file filtering
// ============================================================
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

function isDicomFileByName(file: File): boolean {
  const name = file.name;
  if (name.startsWith('.') || name === 'Thumbs.db' || name === 'desktop.ini') return false;
  if (name.toUpperCase() === 'DICOMDIR') return false;
  if (file.size < 200) return false;
  const parts = name.split('.');
  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i++) {
      if (NON_DICOM_EXT.has(parts[i].toLowerCase())) return false;
    }
    const lastExt = parts[parts.length - 1].toLowerCase();
    if (lastExt === 'dcm' || lastExt === 'dicom' || lastExt === 'dic') return true;
  }
  return true;
}

async function hasDicomMagic(file: File): Promise<boolean> {
  try {
    const buf = await file.slice(0, 132).arrayBuffer();
    const b = new Uint8Array(buf);
    return b.length >= 132 && b[128] === 0x44 && b[129] === 0x49 && b[130] === 0x43 && b[131] === 0x4D;
  } catch { return false; }
}

async function filterDicomFiles(files: File[]): Promise<File[]> {
  const candidates = files.filter(isDicomFileByName);
  if (candidates.length === 0) return [];
  const sampleSize = Math.min(5, candidates.length);
  let magicCount = 0;
  for (let i = 0; i < sampleSize; i++) {
    if (await hasDicomMagic(candidates[i])) magicCount++;
  }
  if (magicCount >= sampleSize * 0.5) {
    const results = await Promise.all(candidates.map(async f => ({ f, ok: await hasDicomMagic(f) })));
    return results.filter(r => r.ok).map(r => r.f);
  }
  return candidates;
}

// ============================================================
// Folder parsing
// ============================================================
interface DicomSeries {
  id: string; folderPath: string; displayName: string; files: File[]; fileCount: number;
}
interface DicomStudy {
  id: string; folderPath: string; displayName: string; series: DicomSeries[]; totalFiles: number; isExpanded: boolean;
}

function parseFilesToStudies(files: File[]): DicomStudy[] {
  if (files.length === 0) return [];
  const folderMap = new Map<string, File[]>();
  for (const file of files) {
    const relPath = (file as any).webkitRelativePath || file.name;
    const parts = relPath.split('/');
    const folderPath = parts.length >= 2 ? parts.slice(0, -1).join('/') : 'Root';
    if (!folderMap.has(folderPath)) folderMap.set(folderPath, []);
    folderMap.get(folderPath)!.push(file);
  }
  const studyMap = new Map<string, Map<string, File[]>>();
  for (const [fp, ff] of folderMap) {
    const parts = fp.split('/');
    const studyKey = parts.length >= 2 ? parts.slice(0, 2).join('/') : parts[0];
    if (!studyMap.has(studyKey)) studyMap.set(studyKey, new Map());
    const sm = studyMap.get(studyKey)!;
    const ex = sm.get(fp);
    if (ex) ex.push(...ff); else sm.set(fp, ff);
  }
  const studies: DicomStudy[] = [];
  let idx = 0;
  for (const [sp, sm] of studyMap) {
    const seriesList: DicomSeries[] = [];
    let total = 0; let si = 0;
    for (const [serPath, serFiles] of sm) {
      serFiles.sort((a, b) => {
        const ap = (a as any).webkitRelativePath || a.name;
        const bp = (b as any).webkitRelativePath || b.name;
        return ap.localeCompare(bp, undefined, { numeric: true });
      });
      const pp = serPath.split('/');
      seriesList.push({ id: `s${idx}-${si}`, folderPath: serPath, displayName: pp[pp.length - 1], files: serFiles, fileCount: serFiles.length });
      total += serFiles.length; si++;
    }
    const pp = sp.split('/');
    studies.push({ id: `st${idx}`, folderPath: sp, displayName: pp[pp.length - 1] || pp[0], series: seriesList, totalFiles: total, isExpanded: idx === 0 });
    idx++;
  }
  return studies;
}

// ============================================================
// W/L Presets — medically accurate values (center, width)
// ============================================================
const WL_PRESETS = [
  { name: 'Default (Auto)', center: 0, width: 0, auto: true },
  { name: 'Soft Tissue', center: 40, width: 400 },
  { name: 'Lung', center: -600, width: 1500 },
  { name: 'Liver', center: 60, width: 150 },
  { name: 'Bone', center: 300, width: 1500 },
  { name: 'Brain', center: 40, width: 80 },
  { name: 'Abdomen', center: 50, width: 350 },
  { name: 'Chest', center: 40, width: 350 },
  { name: 'Angio', center: 300, width: 600 },
];

// Draw shapes available in dwv
const DRAW_SHAPES = ['Ruler', 'Arrow', 'Circle', 'Ellipse', 'Rectangle', 'Protractor', 'Roi'] as const;
const DRAW_SHAPE_LABELS: Record<string, string> = {
  Ruler: 'Ruler (Distance)', Arrow: 'Arrow', Circle: 'Circle', Ellipse: 'Ellipse',
  Rectangle: 'Rectangle', Protractor: 'Angle', Roi: 'Freehand ROI',
};

type ToolName = 'WindowLevel' | 'ZoomAndPan' | 'Scroll' | 'Draw';

// ============================================================
// Helper: get view controller from dwv app
// ============================================================
function getViewController(app: DwvApp, containerId: string): any {
  try {
    const lg = app.getLayerGroupByDivId(containerId);
    if (!lg) return null;
    const vl = (lg as any).getActiveViewLayer?.();
    if (!vl) return null;
    return vl.getViewController?.() || null;
  } catch { return null; }
}

// ============================================================
// DicomViewer Component
// ============================================================
interface DicomViewerProps {
  /** Blob URL or remote URL to a single DICOM file (from Google Drive) */
  fileUrl?: string;
  /** Display name for the file */
  fileName?: string;
}

const DicomViewer: React.FC<DicomViewerProps> = ({ fileUrl, fileName }) => {
  const [studies, setStudies] = useState<DicomStudy[]>([]);
  const [activeSeries, setActiveSeries] = useState<DicomSeries | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolName>('Scroll');
  const [activeShape, setActiveShape] = useState<string>('Ruler');
  const [loadProgress, setLoadProgress] = useState(0);
  const [dicomInfo, setDicomInfo] = useState<{
    patient?: string; modality?: string; description?: string; sliceInfo?: string;
  } | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showWLPresets, setShowWLPresets] = useState(false);
  const [showDrawMenu, setShowDrawMenu] = useState(false);
  const [wlDisplay, setWlDisplay] = useState({ w: 0, l: 0 });
  const [sliceDisplay, setSliceDisplay] = useState({ current: 0, total: 0 });
  const [showGrid, setShowGrid] = useState(false);
  const [gridThumbnails, setGridThumbnails] = useState<string[]>([]);

  const dwvAppRef = useRef<DwvApp | null>(null);
  const scrollWheelRef = useRef<ScrollWheel | null>(null);
  const containerIdRef = useRef(`dwv-${Math.random().toString(36).substr(2, 9)}`);
  const mountedRef = useRef(true);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const defaultWLRef = useRef<{ center: number; width: number } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (dwvAppRef.current) { try { dwvAppRef.current.reset(); } catch {} }
    };
  }, []);

  // ===== SCROLL WHEEL — uses dwv's built-in ScrollWheel =====
  useEffect(() => {
    const container = document.getElementById(containerIdRef.current);
    if (!container || !isReady || !dwvAppRef.current) return;

    // Create dwv's ScrollWheel instance - this handles all scroll logic internally
    const sw = new ScrollWheel(dwvAppRef.current);
    scrollWheelRef.current = sw;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Delegate to dwv's built-in scroll handler
      try {
        sw.wheel(e);
      } catch (err) {
        console.warn('[DicomViewer] scroll error:', err);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      scrollWheelRef.current = null;
    };
  }, [isReady]);

  // ===== Load from a blob/remote URL (for Drive-stored single DICOMs) =====
  const loadFromUrl = useCallback((url: string, name?: string) => {
    if (dwvAppRef.current) {
      try { dwvAppRef.current.abortLoad(); dwvAppRef.current.reset(); } catch {}
      dwvAppRef.current = null;
    }
    const container = document.getElementById(containerIdRef.current);
    if (container) container.innerHTML = '';

    // Create a synthetic series for UI consistency
    const syntheticSeries: DicomSeries = {
      id: 'url-0', folderPath: '', displayName: name || 'DICOM File',
      files: [], fileCount: 1,
    };
    setStudies([{
      id: 'st-url', folderPath: '', displayName: name || 'DICOM File',
      series: [syntheticSeries], totalFiles: 1, isExpanded: true,
    }]);
    setActiveSeries(syntheticSeries);
    setIsLoading(true);
    setLoadError(null);
    setLoadProgress(0);
    setDicomInfo(null);
    setIsReady(false);
    setWlDisplay({ w: 0, l: 0 });
    setSliceDisplay({ current: 0, total: 1 });
    defaultWLRef.current = null;
    setShowGrid(false);
    setGridThumbnails([]);

    setTimeout(() => {
      if (!mountedRef.current) return;

      const app = new DwvApp();
      dwvAppRef.current = app;

      const viewConfig = new ViewConfig(containerIdRef.current);
      const options = new AppOptions({ '*': [viewConfig] });
      options.tools = {
        WindowLevel: {},
        ZoomAndPan: {},
        Scroll: {},
        Draw: { options: ['Ruler', 'Arrow', 'Circle', 'Ellipse', 'Rectangle', 'Protractor', 'Roi'] }
      };

      let hasLoaded = false;

      app.addEventListener('loadprogress', (ev: any) => {
        if (mountedRef.current && ev.loaded && ev.total) setLoadProgress(Math.round((ev.loaded / ev.total) * 100));
      });

      app.addEventListener('load', () => {
        if (!mountedRef.current) return;
        hasLoaded = true;
        setIsLoading(false);
        setLoadProgress(100);
        setIsReady(true);
        try { app.setTool('WindowLevel'); setActiveTool('WindowLevel'); } catch {}

        const vc = getViewController(app, containerIdRef.current);
        if (vc) {
          try {
            const wl = vc.getWindowLevel?.();
            if (wl) {
              defaultWLRef.current = { center: wl.center, width: wl.width };
              setWlDisplay({ w: Math.round(wl.width), l: Math.round(wl.center) });
            }
          } catch {}
        }

        try {
          const ids = app.getDataIds();
          if (ids.length > 0) {
            const md = app.getMetaData(ids[0]);
            if (md) {
              const gt = (g: string, e: string) => { const t = md[`${g}${e}`]; return t?.value?.length > 0 ? String(t.value[0]) : undefined; };
              setDicomInfo({
                patient: gt('0010', '0010'),
                modality: gt('0008', '0060'),
                description: gt('0008', '1030'),
                sliceInfo: name || 'Single file',
              });
            }
          }
        } catch {}
      });

      app.addEventListener('wlchange', (ev: any) => {
        if (mountedRef.current && ev.value) {
          setWlDisplay({ w: Math.round(ev.value[0] || 0), l: Math.round(ev.value[1] || 0) });
        }
      });

      app.addEventListener('loadend', () => {
        if (mountedRef.current) {
          setIsLoading(false);
          if (!hasLoaded) setLoadError('Could not load DICOM file. The file may be incompatible or corrupt.');
        }
      });

      app.addEventListener('error', (ev: any) => {
        console.warn('[DicomViewer] dwv URL load:', ev.error?.message || ev.message || '');
      });

      try {
        app.init(options);
        app.loadURLs([url]);
      } catch (e: any) {
        if (mountedRef.current) { setIsLoading(false); setLoadError(e.message); }
      }
    }, 100);
  }, []);

  // ===== Auto-load when fileUrl prop is provided =====
  useEffect(() => {
    if (fileUrl) {
      loadFromUrl(fileUrl, fileName);
    }
  }, [fileUrl, fileName, loadFromUrl]);

  // ===== Folder upload =====
  const handleFolderSelected = async (fileList: FileList | File[]) => {
    const all = Array.from(fileList);
    if (all.length === 0) return;
    setIsFiltering(true);
    setLoadError(null);
    try {
      const dicom = await filterDicomFiles(all);
      if (dicom.length === 0) {
        alert(`No DICOM files found among ${all.length} scanned files.`);
        setIsFiltering(false); return;
      }
      const parsed = parseFilesToStudies(dicom);
      setStudies(parsed);
      setActiveSeries(null);
      setIsReady(false);
      setDicomInfo(null);
      setShowGrid(false);
      setGridThumbnails([]);
      if (parsed.length > 0) {
        const best = parsed[0].series.reduce((a, b) => a.fileCount > b.fileCount ? a : b);
        loadSeries(best);
      }
    } catch (e) { console.error('[DicomViewer]', e); }
    setIsFiltering(false);
  };

  // ===== Load series =====
  const loadSeries = useCallback((series: DicomSeries) => {
    if (series.files.length === 0) return;

    if (dwvAppRef.current) {
      try { dwvAppRef.current.abortLoad(); dwvAppRef.current.reset(); } catch {}
      dwvAppRef.current = null;
    }
    const container = document.getElementById(containerIdRef.current);
    if (container) container.innerHTML = '';

    setActiveSeries(series);
    setIsLoading(true);
    setLoadError(null);
    setLoadProgress(0);
    setDicomInfo(null);
    setIsReady(false);
    setWlDisplay({ w: 0, l: 0 });
    setSliceDisplay({ current: 0, total: series.fileCount });
    defaultWLRef.current = null;
    setShowGrid(false);
    setGridThumbnails([]);

    setTimeout(() => {
      if (!mountedRef.current) return;

      const app = new DwvApp();
      dwvAppRef.current = app;

      const viewConfig = new ViewConfig(containerIdRef.current);
      const options = new AppOptions({ '*': [viewConfig] });
      options.tools = {
        WindowLevel: {},
        ZoomAndPan: {},
        Scroll: {},
        Draw: { options: ['Ruler', 'Arrow', 'Circle', 'Ellipse', 'Rectangle', 'Protractor', 'Roi'] }
      };

      let hasLoaded = false;

      app.addEventListener('loadprogress', (ev: any) => {
        if (mountedRef.current && ev.loaded && ev.total) setLoadProgress(Math.round((ev.loaded / ev.total) * 100));
      });

      app.addEventListener('load', () => {
        if (!mountedRef.current) return;
        hasLoaded = true;
        setIsLoading(false);
        setLoadProgress(100);
        setIsReady(true);

        // Set Scroll as default tool for multi-slice, WindowLevel for single
        const defaultTool: ToolName = series.fileCount > 1 ? 'Scroll' : 'WindowLevel';
        try { app.setTool(defaultTool); setActiveTool(defaultTool); } catch {}

        // Store default W/L
        const vc = getViewController(app, containerIdRef.current);
        if (vc) {
          try {
            const wl = vc.getWindowLevel?.();
            if (wl) {
              defaultWLRef.current = { center: wl.center, width: wl.width };
              setWlDisplay({ w: Math.round(wl.width), l: Math.round(wl.center) });
            }
          } catch {}
        }

        // Extract metadata
        try {
          const ids = app.getDataIds();
          if (ids.length > 0) {
            const md = app.getMetaData(ids[0]);
            if (md) {
              const gt = (g: string, e: string) => { const t = md[`${g}${e}`]; return t?.value?.length > 0 ? String(t.value[0]) : undefined; };
              setDicomInfo({
                patient: gt('0010', '0010'),
                modality: gt('0008', '0060'),
                description: gt('0008', '1030'),
                sliceInfo: `${series.fileCount} slice${series.fileCount !== 1 ? 's' : ''}`,
              });
            }
          }
        } catch {}
      });

      // Track W/L changes
      app.addEventListener('wlchange', (ev: any) => {
        if (mountedRef.current && ev.value) {
          setWlDisplay({ w: Math.round(ev.value[0] || 0), l: Math.round(ev.value[1] || 0) });
        }
      });

      // Track position changes (slice index)
      app.addEventListener('positionchange', (ev: any) => {
        if (mountedRef.current && ev.value) {
          try {
            const vals = ev.value;
            // Index position includes the Z value which is the slice
            if (Array.isArray(vals) && vals.length > 2) {
              setSliceDisplay(prev => ({ ...prev, current: vals[2] + 1 }));
            }
          } catch {}
        }
      });

      app.addEventListener('loadend', () => {
        if (mountedRef.current) {
          setIsLoading(false);
          if (!hasLoaded) setLoadError('Could not load DICOM images. Files may be incompatible.');
        }
      });

      app.addEventListener('error', (ev: any) => {
        console.warn('[DicomViewer] dwv:', ev.error?.message || ev.message || '');
      });

      try {
        app.init(options);
        app.loadFiles(series.files);
      } catch (e: any) {
        if (mountedRef.current) { setIsLoading(false); setLoadError(e.message); }
      }
    }, 100);
  }, []);

  // ===== Tool handlers =====
  const handleSetTool = useCallback((tool: ToolName) => {
    if (!dwvAppRef.current || !isReady) return;
    try {
      dwvAppRef.current.setTool(tool);
      if (tool === 'Draw') dwvAppRef.current.setToolFeatures({ shapeName: activeShape });
      setActiveTool(tool);
      setShowWLPresets(false);
      setShowDrawMenu(false);
    } catch {}
  }, [isReady, activeShape]);

  const handleSetShape = useCallback((shape: string) => {
    if (!dwvAppRef.current || !isReady) return;
    try {
      dwvAppRef.current.setTool('Draw');
      dwvAppRef.current.setToolFeatures({ shapeName: shape });
      setActiveTool('Draw');
      setActiveShape(shape);
      setShowDrawMenu(false);
    } catch {}
  }, [isReady]);

  const handleSetWLPreset = useCallback((preset: typeof WL_PRESETS[0]) => {
    if (!dwvAppRef.current || !isReady) return;
    try {
      const vc = getViewController(dwvAppRef.current, containerIdRef.current);
      if (!vc) return;

      if ((preset as any).auto) {
        // Reset to the DICOM file's default W/L
        if (defaultWLRef.current) {
          const wl = new DwvWindowLevel(defaultWLRef.current.center, defaultWLRef.current.width);
          vc.setWindowLevel(wl);
          setWlDisplay({ w: defaultWLRef.current.width, l: defaultWLRef.current.center });
        }
      } else {
        const wl = new DwvWindowLevel(preset.center, preset.width);
        vc.setWindowLevel(wl);
        setWlDisplay({ w: preset.width, l: preset.center });
      }

      // Also switch to WindowLevel tool for adjustment
      dwvAppRef.current.setTool('WindowLevel');
      setActiveTool('WindowLevel');
      setShowWLPresets(false);
    } catch (e) { console.warn('[DicomViewer] W/L preset error:', e); }
  }, [isReady]);

  const handleResetView = useCallback(() => {
    if (!dwvAppRef.current || !isReady) return;
    try {
      dwvAppRef.current.resetDisplay();
    } catch {
      try { dwvAppRef.current.resetZoomPan(); } catch {}
    }
    // Also reset W/L to default
    if (defaultWLRef.current) {
      try {
        const vc = getViewController(dwvAppRef.current, containerIdRef.current);
        if (vc) {
          const wl = new DwvWindowLevel(defaultWLRef.current.center, defaultWLRef.current.width);
          vc.setWindowLevel(wl);
          setWlDisplay({ w: defaultWLRef.current.width, l: defaultWLRef.current.center });
        }
      } catch {}
    }
  }, [isReady]);

  const handleUndo = useCallback(() => {
    if (!dwvAppRef.current || !isReady) return;
    try { dwvAppRef.current.undo(); } catch {}
  }, [isReady]);

  // ===== Grid view =====
  const generateGridThumbnails = useCallback(() => {
    if (!activeSeries || activeSeries.fileCount <= 1) return;
    setShowGrid(true);
    // Generate thumbnails by loading each file into a temporary canvas
    // For now, show a grid of the series info with clickable slices
  }, [activeSeries]);

  const goToSlice = useCallback((sliceIndex: number) => {
    if (!dwvAppRef.current || !isReady) return;
    try {
      const vc = getViewController(dwvAppRef.current, containerIdRef.current);
      if (vc) {
        const idx = vc.getCurrentIndex?.();
        if (idx) {
          const vals = idx.getValues?.();
          if (vals && vals.length > 2) {
            const newVals = [...vals];
            newVals[2] = sliceIndex;
            const IndexClass = idx.constructor;
            vc.setCurrentIndex(new IndexClass(newVals));
          }
        }
      }
      setShowGrid(false);
    } catch (e) { console.warn('[DicomViewer] goToSlice:', e); }
  }, [isReady]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => { setShowWLPresets(false); setShowDrawMenu(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length > 0) handleFolderSelected(e.dataTransfer.files);
  };

  const toggleStudy = (id: string) => {
    setStudies(p => p.map(s => s.id === id ? { ...s, isExpanded: !s.isExpanded } : s));
  };

  // ========== UPLOAD SCREEN (skip if loading from URL prop) ==========
  if (studies.length === 0 && !fileUrl) {
    return (
      <div className={`w-full rounded-2xl border-2 border-dashed transition-all ${isDragOver ? 'border-cyan-400 bg-cyan-50/50' : 'border-slate-300 bg-slate-50'}`}
        onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
        onDrop={handleDrop}>
        <div className="flex flex-col items-center justify-center py-10 px-8 text-center">
          {isFiltering ? (
            <>
              <Loader2Icon className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
              <p className="text-sm text-slate-600 font-medium">Scanning for DICOM files...</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-cyan-100 rounded-2xl flex items-center justify-center mb-4">
                <LayersIcon className="w-7 h-7 text-cyan-600" />
              </div>
              <h3 className="text-base font-bold text-slate-700 mb-1">DICOM Medical Image Viewer</h3>
              <p className="text-xs text-slate-400 mb-5">Upload CT, MRI, X-ray, Ultrasound folders — 100% local</p>
              <button onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-xl font-bold text-sm hover:bg-cyan-700 shadow-lg">
                <FolderOpenIcon className="w-4 h-4" /> Open DICOM Folder
              </button>
              <p className="text-[10px] text-slate-400 mt-3">Or drag & drop here</p>
            </>
          )}
          {/* @ts-expect-error — webkitdirectory is a non-standard attribute for folder selection */}
          <input type="file" ref={folderInputRef} onChange={(e) => { if (e.target.files) handleFolderSelected(e.target.files); e.target.value = ''; }} className="hidden" multiple webkitdirectory="" />
        </div>
      </div>
    );
  }

  // ========== VIEWER SCREEN ==========
  return (
    <div className="w-full flex bg-slate-900 rounded-2xl overflow-hidden shadow-2xl" style={{ height: '520px' }}>
      {/* LEFT SIDEBAR */}
      <div className="w-52 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-700">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Studies</span>
          <button onClick={() => { setStudies([]); setActiveSeries(null); setIsReady(false); setLoadError(null); setDicomInfo(null); setShowGrid(false); }}
            className="text-slate-400 hover:text-white text-[10px] flex items-center gap-1 hover:bg-slate-700 px-1.5 py-0.5 rounded">
            <FolderOpenIcon className="w-3 h-3" /> New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {studies.map(study => (
            <div key={study.id}>
              <button onClick={() => toggleStudy(study.id)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-slate-700/50 border-b border-slate-700/30">
                {study.isExpanded ? <ChevronDownIcon className="w-3 h-3 text-slate-500 shrink-0" /> : <ChevronRightIcon className="w-3 h-3 text-slate-500 shrink-0" />}
                <FolderIcon className="w-3 h-3 text-cyan-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-200 truncate">{study.displayName}</p>
                  <p className="text-[9px] text-slate-500">{study.totalFiles} files · {study.series.length} series</p>
                </div>
              </button>
              {study.isExpanded && study.series.map(series => {
                const isActive = activeSeries?.id === series.id;
                return (
                  <button key={series.id} onClick={() => loadSeries(series)}
                    className={`w-full flex items-center gap-2 pl-6 pr-2 py-2 text-left border-l-2 ${isActive ? 'bg-cyan-900/30 border-cyan-500' : 'border-transparent hover:bg-slate-700/30'}`}>
                    <div className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${isActive ? 'bg-cyan-900/50 border border-cyan-600' : 'bg-slate-700 border border-slate-600'}`}>
                      <ImageIcon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-medium truncate ${isActive ? 'text-cyan-300' : 'text-slate-300'}`}>{series.displayName}</p>
                      <p className="text-[9px] text-slate-500">{series.fileCount} slice{series.fileCount !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="px-2 py-1 border-t border-slate-700">
          <p className="text-[9px] text-slate-500 text-center">{studies.reduce((a, s) => a + s.totalFiles, 0)} DICOM files</p>
        </div>
      </div>

      {/* MAIN VIEWER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOOLBAR */}
        <div className="flex items-center gap-0.5 px-2 py-1 bg-slate-800 border-b border-slate-700 flex-shrink-0 relative">
          {/* W/L + presets */}
          <div className="relative">
            <div className="flex items-center">
              <button onClick={() => handleSetTool('WindowLevel')}
                className={`flex items-center gap-1 px-2 py-1 rounded-l text-[11px] font-medium ${activeTool === 'WindowLevel' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                <SunIcon className="w-3.5 h-3.5" /><span className="hidden xl:inline">W/L</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowWLPresets(!showWLPresets); setShowDrawMenu(false); }}
                className={`px-1 py-1 rounded-r border-l border-slate-600 ${activeTool === 'WindowLevel' ? 'bg-cyan-700 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                <ChevronDownIcon className="w-3 h-3" />
              </button>
            </div>
            {showWLPresets && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 min-w-[200px]" onClick={e => e.stopPropagation()}>
                <p className="text-[9px] text-slate-500 px-3 py-1 border-b border-slate-700 font-bold uppercase">Presets</p>
                {WL_PRESETS.map(p => (
                  <button key={p.name} onClick={() => handleSetWLPreset(p)}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-700 text-left">
                    <span className="text-[11px] text-slate-200">{p.name}</span>
                    {!(p as any).auto && <span className="text-[9px] text-slate-500 font-mono">C:{p.center} W:{p.width}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zoom/Pan */}
          <button onClick={() => handleSetTool('ZoomAndPan')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${activeTool === 'ZoomAndPan' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
            <MoveIcon className="w-3.5 h-3.5" /><span className="hidden xl:inline">Zoom/Pan</span>
          </button>

          {/* Scroll */}
          <button onClick={() => handleSetTool('Scroll')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${activeTool === 'Scroll' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
            <LayersIcon className="w-3.5 h-3.5" /><span className="hidden xl:inline">Scroll</span>
          </button>

          {/* Draw + dropdown */}
          <div className="relative">
            <div className="flex items-center">
              <button onClick={() => handleSetTool('Draw')}
                className={`flex items-center gap-1 px-2 py-1 rounded-l text-[11px] font-medium ${activeTool === 'Draw' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                <RulerIcon className="w-3.5 h-3.5" /><span className="hidden xl:inline">{DRAW_SHAPE_LABELS[activeShape]?.split(' ')[0] || 'Measure'}</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowDrawMenu(!showDrawMenu); setShowWLPresets(false); }}
                className={`px-1 py-1 rounded-r border-l border-slate-600 ${activeTool === 'Draw' ? 'bg-cyan-700 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                <ChevronDownIcon className="w-3 h-3" />
              </button>
            </div>
            {showDrawMenu && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 min-w-[180px]" onClick={e => e.stopPropagation()}>
                <p className="text-[9px] text-slate-500 px-3 py-1 border-b border-slate-700 font-bold uppercase">Measurements</p>
                {DRAW_SHAPES.map(shape => (
                  <button key={shape} onClick={() => handleSetShape(shape)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 ${activeShape === shape ? 'bg-cyan-900/30 text-cyan-300' : ''}`}>
                    {shape === 'Ruler' && <RulerIcon className="w-3.5 h-3.5 text-slate-400" />}
                    {shape === 'Arrow' && <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />}
                    {shape === 'Circle' && <CircleIcon className="w-3.5 h-3.5 text-slate-400" />}
                    {shape === 'Ellipse' && <CircleIcon className="w-3.5 h-3.5 text-slate-400" />}
                    {shape === 'Rectangle' && <SquareIcon className="w-3.5 h-3.5 text-slate-400" />}
                    {shape === 'Protractor' && <span className="text-slate-400 text-sm">∠</span>}
                    {shape === 'Roi' && <HandIcon className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="text-[11px] text-slate-200">{DRAW_SHAPE_LABELS[shape]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-slate-700 mx-1" />

          {/* Reset View */}
          <button onClick={handleResetView} disabled={!isReady}
            className="p-1 text-slate-400 hover:bg-slate-700 hover:text-white rounded disabled:opacity-30" title="Reset View">
            <MaximizeIcon className="w-3.5 h-3.5" />
          </button>

          {/* Undo */}
          <button onClick={handleUndo} disabled={!isReady}
            className="p-1 text-slate-400 hover:bg-slate-700 hover:text-white rounded disabled:opacity-30" title="Undo">
            <Undo2Icon className="w-3.5 h-3.5" />
          </button>

          {/* Grid view toggle */}
          {activeSeries && activeSeries.fileCount > 1 && (
            <button onClick={() => setShowGrid(!showGrid)} disabled={!isReady}
              className={`p-1 rounded disabled:opacity-30 ${showGrid ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`} title="Grid View">
              <GridIcon className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="flex-1" />

          {/* Slice counter */}
          {isReady && sliceDisplay.total > 1 && (
            <span className="text-[10px] text-slate-400 font-mono mr-2">
              I: {sliceDisplay.current}/{sliceDisplay.total}
            </span>
          )}

          {/* W/L display */}
          {isReady && wlDisplay.w !== 0 && (
            <span className="text-[10px] text-cyan-400 font-mono mr-2">
              W:{wlDisplay.w} L:{wlDisplay.l}
            </span>
          )}

          {/* Info */}
          {dicomInfo && (
            <button onClick={() => setShowInfo(!showInfo)}
              className={`p-1 rounded ${showInfo ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
              <InfoIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* VIEWER AREA */}
        <div className="flex-1 relative overflow-hidden">
          {showInfo && dicomInfo && (
            <div className="absolute top-3 left-3 z-30 bg-slate-900/90 backdrop-blur-sm text-white rounded-lg p-3 text-[10px] border border-slate-700">
              {dicomInfo.patient && <div className="mb-0.5"><span className="text-slate-400">Patient:</span> {dicomInfo.patient}</div>}
              {dicomInfo.modality && <div className="mb-0.5"><span className="text-slate-400">Modality:</span> {dicomInfo.modality}</div>}
              {dicomInfo.description && <div className="mb-0.5"><span className="text-slate-400">Study:</span> {dicomInfo.description}</div>}
              {dicomInfo.sliceInfo && <div><span className="text-slate-400">Slices:</span> {dicomInfo.sliceInfo}</div>}
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/80">
              <Loader2Icon className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
              <p className="text-xs text-slate-300">Loading {activeSeries?.fileCount || 0} slices...</p>
              {loadProgress > 0 && loadProgress < 100 && (
                <div className="mt-2 w-40"><div className="h-1 bg-slate-700 rounded-full"><div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${loadProgress}%` }} /></div></div>
              )}
            </div>
          )}

          {loadError && !isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900">
              <div className="bg-red-900/20 text-red-300 rounded-lg p-5 max-w-sm text-center border border-red-800/30">
                <p className="text-sm font-bold mb-1">Load Failed</p>
                <p className="text-xs text-red-400">{loadError}</p>
              </div>
            </div>
          )}

          {!activeSeries && !isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900">
              <LayersIcon className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-xs text-slate-500">Select a series from the left panel</p>
            </div>
          )}

          {/* Grid overlay */}
          {showGrid && activeSeries && activeSeries.fileCount > 1 && (
            <div className="absolute inset-0 z-25 bg-slate-900/95 overflow-y-auto p-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-300 font-medium">Grid View — {activeSeries.fileCount} slices — click to jump</p>
                <button onClick={() => setShowGrid(false)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700">
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: activeSeries.fileCount }, (_, i) => (
                  <button key={i} onClick={() => goToSlice(i)}
                    className={`aspect-square rounded border flex items-center justify-center text-[10px] font-mono transition-all ${
                      sliceDisplay.current === i + 1
                        ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700 hover:text-white'
                    }`}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DWV container */}
          <div id={containerIdRef.current} className="w-full h-full" style={{ background: '#000' }} />
        </div>

        {/* BOTTOM BAR */}
        <div className="flex items-center justify-between px-2 py-1 bg-slate-800 border-t border-slate-700 flex-shrink-0">
          <span className="text-[9px] text-slate-500">
            {activeTool === 'WindowLevel' && 'Click+drag: adjust brightness/contrast | Scroll wheel: change slices'}
            {activeTool === 'ZoomAndPan' && 'Click+drag: zoom & pan | Scroll wheel: change slices'}
            {activeTool === 'Scroll' && 'Click+drag or scroll wheel: move through slices'}
            {activeTool === 'Draw' && `${DRAW_SHAPE_LABELS[activeShape]} | Scroll wheel: change slices`}
          </span>
          <span className="text-[9px] text-cyan-600 font-medium">Built-in DICOM Viewer</span>
        </div>
      </div>
    </div>
  );
};

export default DicomViewer;
