import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  XIcon, MaximizeIcon, MinimizeIcon, CameraIcon,
  SunIcon, MoveIcon, LayersIcon, InfoIcon,
  ChevronRightIcon, ChevronDownIcon, FolderIcon,
  ImageIcon, Loader2Icon, RotateCcwIcon,
  CheckIcon, SaveIcon
} from 'lucide-react';

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
// DICOM file filtering (shared logic)
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

function isProbablyDicom(file: File): boolean {
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

async function isDicomFile(file: File): Promise<boolean> {
  if (!isProbablyDicom(file)) return false;
  try {
    const header = await file.slice(0, 132).arrayBuffer();
    const view = new Uint8Array(header);
    return view[128] === 0x44 && view[129] === 0x49 && view[130] === 0x43 && view[131] === 0x4D;
  } catch { return false; }
}

// ============================================================
// Study/Series types
// ============================================================
interface ViewerSeries {
  id: string;
  folderPath: string;
  displayName: string;
  files: File[];
  imageIds: string[];
  fileCount: number;
}

interface ViewerStudy {
  id: string;
  folderPath: string;
  displayName: string;
  series: ViewerSeries[];
  totalFiles: number;
  isExpanded: boolean;
}

interface StudyMetadata {
  patientName?: string;
  patientId?: string;
  patientBirthDate?: string;
  patientSex?: string;
  studyDescription?: string;
  studyDate?: string;
  studyTime?: string;
  accessionNumber?: string;
  referringPhysician?: string;
  studyInstanceUID?: string;
  seriesDescription?: string;
  seriesNumber?: string;
  modality?: string;
  seriesInstanceUID?: string;
  instanceNumber?: number;
  rows?: number;
  columns?: number;
  pixelSpacing?: string;
  sliceThickness?: string;
  windowCenter?: string;
  windowWidth?: string;
  institution?: string;
  manufacturer?: string;
}

// ============================================================
// Singleton init — shared with Cornerstone3DViewer via window flag
// ============================================================
const _win = window as any;

function ensureInit(): Promise<void> {
  if (_win.__cs3d_init_done__) return Promise.resolve();
  if (_win.__cs3d_init_promise__) return _win.__cs3d_init_promise__;

  _win.__cs3d_init_promise__ = (async () => {
    await csInit();
    await csDicomInit({ maxWebWorkers: navigator.hardwareConcurrency || 1 });
    await csToolsInit();
    try { addTool(StackScrollTool); } catch {}
    try { addTool(WindowLevelTool); } catch {}
    try { addTool(ZoomTool); } catch {}
    try { addTool(PanTool); } catch {}
    _win.__cs3d_init_done__ = true;
  })();

  return _win.__cs3d_init_promise__;
}

// ============================================================
// Props
// ============================================================
export interface DicomAnnotationData {
  imageUrl: string;
  text: string;
  studyName: string;
  studyDate: string;
  patientInfo: string;
}

interface DicomStudyViewerProps {
  files: File[];
  onClose: () => void;
  onSaveAnnotation?: (data: DicomAnnotationData) => void;
  caseId: string;
  authorName: string;
}

// ============================================================
// Component
// ============================================================
let instanceCounter = 0;

const DicomStudyViewer: React.FC<DicomStudyViewerProps> = ({
  files, onClose, onSaveAnnotation, caseId, authorName
}) => {
  const idsRef = useRef(() => {
    const id = ++instanceCounter;
    return {
      engineId: `dsvw-engine-${id}`,
      viewportId: `dsvw-vp-${id}`,
      toolGroupId: `dsvw-tg-${id}`,
    };
  });
  const ids = useRef(idsRef.current()).current;

  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [studies, setStudies] = useState<ViewerStudy[]>([]);
  const [activeSeries, setActiveSeries] = useState<ViewerSeries | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);
  const [currentSlice, setCurrentSlice] = useState(0);
  const [totalSlices, setTotalSlices] = useState(0);
  const [studyMeta, setStudyMeta] = useState<StudyMetadata | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [wlDisplay, setWlDisplay] = useState({ w: 0, l: 0 });
  const [viewportReady, setViewportReady] = useState(false);

  // Screenshot/annotation state
  const [showAnnotationDialog, setShowAnnotationDialog] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');

  const viewportDivRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RenderingEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  // ===== Init Cornerstone3D =====
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    ensureInit()
      .then(() => { if (!cancelled) setIsInitialized(true); })
      .catch((err) => { if (!cancelled) setInitError(err?.message || 'Init failed'); });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      try { ToolGroupManager.destroyToolGroup(ids.toolGroupId); } catch {}
      try { engineRef.current?.destroy(); } catch {}
      engineRef.current = null;
    };
  }, []);

  // ===== Create engine + viewport =====
  useEffect(() => {
    if (!isInitialized || !viewportDivRef.current || engineRef.current) return;

    const el = viewportDivRef.current;

    const engine = new RenderingEngine(ids.engineId);
    engineRef.current = engine;

    engine.enableElement({
      viewportId: ids.viewportId,
      type: csEnums.ViewportType.STACK,
      element: el,
      defaultOptions: { background: [0, 0, 0] as Types.Point3 },
    });

    let tg = ToolGroupManager.getToolGroup(ids.toolGroupId);
    if (!tg) tg = ToolGroupManager.createToolGroup(ids.toolGroupId);
    if (tg) {
      tg.addTool(WindowLevelTool.toolName);
      tg.addTool(StackScrollTool.toolName);
      tg.addTool(ZoomTool.toolName);
      tg.addTool(PanTool.toolName);
      tg.addViewport(ids.viewportId, ids.engineId);

      tg.setToolActive(WindowLevelTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      });
      tg.setToolActive(ZoomTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
      });
      tg.setToolActive(PanTool.toolName, {
        bindings: [{
          mouseButton: csToolsEnums.MouseBindings.Primary,
          modifierKey: csToolsEnums.KeyboardBindings.Shift,
        }],
      });
      tg.setToolActive(StackScrollTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
      });
    }

    // Suppress wheel on empty viewport
    const suppress = (e: WheelEvent) => {
      try {
        const vp = engine.getViewport(ids.viewportId) as Types.IStackViewport;
        if (!vp || !vp.getImageIds || vp.getImageIds().length === 0) e.stopPropagation();
      } catch { e.stopPropagation(); }
    };
    el.addEventListener('wheel', suppress, { capture: true });

    // Resize engine whenever the viewport div changes size
    const resizeObserver = new ResizeObserver(() => {
      try { engine.resize(); } catch {}
    });
    resizeObserver.observe(el);

    // Multiple resize passes to handle layout settling
    setTimeout(() => { try { engine.resize(); } catch {} }, 50);
    setTimeout(() => { try { engine.resize(); } catch {} }, 200);
    setTimeout(() => { try { engine.resize(); } catch {} }, 500);

    setViewportReady(true);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isInitialized]);

  // ===== Smooth scroll (1 slice per tick) =====
  useEffect(() => {
    const el = viewportDivRef.current;
    if (!el || !viewportReady) return;

    const handler = (e: WheelEvent) => {
      if (!engineRef.current) return;
      try {
        const vp = engineRef.current.getViewport(ids.viewportId) as Types.IStackViewport;
        if (!vp) return;
        const imgIds = vp.getImageIds();
        if (!imgIds || imgIds.length <= 1) return;
        const direction = e.deltaY > 0 ? 1 : -1;
        const currentIdx = vp.getCurrentImageIdIndex();
        const newIdx = Math.max(0, Math.min(imgIds.length - 1, currentIdx + direction));
        if (newIdx !== currentIdx) vp.setImageIdIndex(newIdx);
        e.stopPropagation();
        e.preventDefault();
      } catch {}
    };

    el.addEventListener('wheel', handler, { capture: true, passive: false });
    return () => el.removeEventListener('wheel', handler, { capture: true } as any);
  }, [viewportReady]);

  // ===== Listen for slice changes =====
  useEffect(() => {
    const el = viewportDivRef.current;
    if (!el || !viewportReady) return;

    const handler = () => {
      if (!engineRef.current) return;
      try {
        const vp = engineRef.current.getViewport(ids.viewportId) as Types.IStackViewport;
        if (vp) {
          const idx = vp.getCurrentImageIdIndex();
          setCurrentSlice(idx + 1);
          // Update metadata for current slice
          extractMetadata(vp.getImageIds()[idx]);
        }
      } catch {}
    };

    el.addEventListener(csEnums.Events.STACK_NEW_IMAGE, handler);
    return () => el.removeEventListener(csEnums.Events.STACK_NEW_IMAGE, handler);
  }, [viewportReady]);

  // ===== Process files on mount =====
  useEffect(() => {
    if (!viewportReady || files.length === 0) return;
    processFiles(files);
  }, [viewportReady, files, processFiles]);

  // ===== Keyboard shortcuts =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAnnotationDialog) {
          setShowAnnotationDialog(false);
          setScreenshotDataUrl(null);
        } else if (isBrowserFullscreen) {
          document.exitFullscreen?.();
        } else {
          onClose();
        }
      }
      if (e.key === 'f' || e.key === 'F') {
        if (!showAnnotationDialog) toggleFullscreen();
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        captureScreenshot();
      }
      // Arrow key navigation through slices
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!engineRef.current) return;
        try {
          const vp = engineRef.current.getViewport(ids.viewportId) as Types.IStackViewport;
          if (!vp) return;
          const imgIds = vp.getImageIds();
          if (!imgIds || imgIds.length <= 1) return;
          const direction = e.key === 'ArrowDown' ? 1 : -1;
          const currentIdx = vp.getCurrentImageIdIndex();
          const newIdx = Math.max(0, Math.min(imgIds.length - 1, currentIdx + direction));
          if (newIdx !== currentIdx) vp.setImageIdIndex(newIdx);
          e.preventDefault();
        } catch {}
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showAnnotationDialog, isBrowserFullscreen]);

  // ===== Fullscreen change listener =====
  useEffect(() => {
    const handler = () => setIsBrowserFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ===== Extract comprehensive DICOM metadata =====
  const extractMetadata = useCallback((imageId?: string) => {
    if (!imageId) return;
    try {
      const patient = metaData.get('patientModule', imageId) || {};
      const study = metaData.get('generalStudyModule', imageId) || {};
      const series = metaData.get('generalSeriesModule', imageId) || {};
      const img = metaData.get('generalImageModule', imageId) || {};
      const plane = metaData.get('imagePlaneModule', imageId) || {};

      const meta: StudyMetadata = {
        patientName: patient.patientName?.Alphabetic || patient.patientName || undefined,
        patientId: patient.patientId || undefined,
        patientBirthDate: patient.patientBirthDate || undefined,
        patientSex: patient.patientSex || undefined,
        studyDescription: study.studyDescription || undefined,
        studyDate: study.studyDate || undefined,
        studyTime: study.studyTime || undefined,
        accessionNumber: study.accessionNumber || undefined,
        referringPhysician: study.referringPhysicianName?.Alphabetic || study.referringPhysicianName || undefined,
        studyInstanceUID: study.studyInstanceUID || undefined,
        seriesDescription: series.seriesDescription || undefined,
        seriesNumber: series.seriesNumber?.toString() || undefined,
        modality: series.modality || undefined,
        seriesInstanceUID: series.seriesInstanceUID || undefined,
        instanceNumber: img.instanceNumber || undefined,
        rows: plane.rows || img.rows || undefined,
        columns: plane.columns || img.columns || undefined,
        pixelSpacing: plane.pixelSpacing ? `${plane.pixelSpacing[0]?.toFixed(2)} × ${plane.pixelSpacing[1]?.toFixed(2)} mm` : undefined,
        sliceThickness: plane.sliceThickness ? `${plane.sliceThickness.toFixed(2)} mm` : undefined,
      };

      // Get W/L from viewport
      if (engineRef.current) {
        try {
          const vp = engineRef.current.getViewport(ids.viewportId) as Types.IStackViewport;
          if (vp) {
            const props = vp.getProperties();
            if (props.voiRange) {
              const ww = props.voiRange.upper - props.voiRange.lower;
              const wc = (props.voiRange.upper + props.voiRange.lower) / 2;
              meta.windowWidth = Math.round(ww).toString();
              meta.windowCenter = Math.round(wc).toString();
              setWlDisplay({ w: Math.round(ww), l: Math.round(wc) });
            }
          }
        } catch {}
      }

      setStudyMeta(meta);
    } catch {}
  }, []);

  // ===== Load a series into viewport =====
  const loadSeries = useCallback(async (series: ViewerSeries) => {
    if (!engineRef.current || series.imageIds.length === 0) return;

    setIsLoading(true);
    setActiveSeries(series);

    try {
      // Ensure viewport is properly sized before loading
      try { engineRef.current.resize(); } catch {}

      const vp = engineRef.current.getViewport(ids.viewportId) as Types.IStackViewport;
      if (!vp) {
        console.error('[DicomStudyViewer] Viewport not found');
        setIsLoading(false);
        return;
      }

      await vp.setStack(series.imageIds, 0);

      // Resize again after stack is set then render
      try { engineRef.current.resize(); } catch {}
      vp.render();

      setTotalSlices(series.imageIds.length);
      setCurrentSlice(1);

      // Extract metadata after image loads
      setTimeout(() => {
        extractMetadata(series.imageIds[0]);
        // One more render pass to ensure image is displayed
        try {
          vp.render();
          engineRef.current?.resize();
        } catch {}
      }, 300);
    } catch (err: any) {
      console.error('[DicomStudyViewer] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [extractMetadata]);

  // ===== Process and validate DICOM files =====
  const processFiles = useCallback(async (fileList: File[]) => {
    setIsProcessing(true);
    const arr = Array.from(fileList);
    const BATCH = 50;
    const validFiles: { file: File; imageId: string }[] = [];

    for (let i = 0; i < arr.length; i += BATCH) {
      const batch = arr.slice(i, i + BATCH);
      const checks = await Promise.all(batch.map(f => isDicomFile(f)));
      for (let j = 0; j < batch.length; j++) {
        if (checks[j]) {
          try {
            const imageId = wadouri.fileManager.add(batch[j]);
            validFiles.push({ file: batch[j], imageId });
          } catch {}
        }
      }
    }

    if (validFiles.length === 0) {
      setIsProcessing(false);
      return;
    }

    // Parse into study/series hierarchy
    const folderMap = new Map<string, { file: File; imageId: string }[]>();
    for (const vf of validFiles) {
      const relPath = (vf.file as any).webkitRelativePath || vf.file.name;
      const parts = relPath.split('/');
      const folderPath = parts.length >= 2 ? parts.slice(0, -1).join('/') : 'Root';
      if (!folderMap.has(folderPath)) folderMap.set(folderPath, []);
      folderMap.get(folderPath)!.push(vf);
    }

    const studyMap = new Map<string, Map<string, { file: File; imageId: string }[]>>();
    for (const [fp, ff] of folderMap) {
      const parts = fp.split('/');
      const studyKey = parts.length >= 2 ? parts.slice(0, 2).join('/') : parts[0];
      if (!studyMap.has(studyKey)) studyMap.set(studyKey, new Map());
      const sm = studyMap.get(studyKey)!;
      const ex = sm.get(fp);
      if (ex) ex.push(...ff); else sm.set(fp, ff);
    }

    const parsedStudies: ViewerStudy[] = [];
    let idx = 0;
    for (const [sp, sm] of studyMap) {
      const seriesList: ViewerSeries[] = [];
      let total = 0;
      let si = 0;
      for (const [serPath, serFiles] of sm) {
        serFiles.sort((a, b) => {
          const ap = (a.file as any).webkitRelativePath || a.file.name;
          const bp = (b.file as any).webkitRelativePath || b.file.name;
          return ap.localeCompare(bp, undefined, { numeric: true });
        });
        const pp = serPath.split('/');
        seriesList.push({
          id: `s${idx}-${si}`,
          folderPath: serPath,
          displayName: pp[pp.length - 1],
          files: serFiles.map(sf => sf.file),
          imageIds: serFiles.map(sf => sf.imageId),
          fileCount: serFiles.length,
        });
        total += serFiles.length;
        si++;
      }
      const pp = sp.split('/');
      parsedStudies.push({
        id: `st${idx}`,
        folderPath: sp,
        displayName: pp[pp.length - 1] || pp[0],
        series: seriesList,
        totalFiles: total,
        isExpanded: true,
      });
      idx++;
    }

    setStudies(parsedStudies);
    setIsProcessing(false);

    // Auto-load the largest series (delay to ensure viewport is fully sized)
    if (parsedStudies.length > 0) {
      const best = parsedStudies[0].series.reduce((a, b) => a.fileCount > b.fileCount ? a : b);
      setTimeout(() => loadSeries(best), 150);
    }
  }, [viewportReady, loadSeries]);

  // ===== Reset view =====
  const handleResetView = useCallback(() => {
    if (!engineRef.current) return;
    try {
      const vp = engineRef.current.getViewport(ids.viewportId) as Types.IStackViewport;
      if (vp) { vp.resetCamera(); vp.resetProperties(); vp.render(); }
    } catch {}
  }, []);

  // ===== Toggle browser fullscreen =====
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      containerRef.current?.requestFullscreen?.();
    }
  }, []);

  // ===== Screenshot capture =====
  const captureScreenshot = useCallback(() => {
    if (!engineRef.current) return;
    try {
      const vp = engineRef.current.getViewport(ids.viewportId);
      if (!vp) return;
      const canvas = vp.getCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      setScreenshotDataUrl(dataUrl);
      setAnnotationText(
        `Key Image: ${studyMeta?.studyDescription || activeSeries?.displayName || 'DICOM Study'}`
      );
      setShowAnnotationDialog(true);
    } catch (err) {
      console.error('[DicomStudyViewer] Screenshot failed:', err);
    }
  }, [studyMeta, activeSeries]);

  // ===== Save annotation =====
  const handleSaveAnnotation = useCallback(() => {
    if (!screenshotDataUrl || !onSaveAnnotation) return;
    onSaveAnnotation({
      imageUrl: screenshotDataUrl,
      text: annotationText || 'DICOM Key Image',
      studyName: studyMeta?.studyDescription || activeSeries?.displayName || 'Unknown Study',
      studyDate: formatDicomDate(studyMeta?.studyDate) || new Date().toISOString().split('T')[0],
      patientInfo: [
        studyMeta?.patientName,
        studyMeta?.patientId ? `ID: ${studyMeta.patientId}` : null,
        studyMeta?.modality,
      ].filter(Boolean).join(' | ') || 'Unknown Patient',
    });
    setShowAnnotationDialog(false);
    setScreenshotDataUrl(null);
    setAnnotationText('');
  }, [screenshotDataUrl, annotationText, studyMeta, activeSeries, onSaveAnnotation]);

  // ===== Toggle study expansion =====
  const toggleStudy = (id: string) => {
    setStudies(prev => prev.map(s => s.id === id ? { ...s, isExpanded: !s.isExpanded } : s));
  };

  // ===== Format DICOM date =====
  function formatDicomDate(d?: string): string {
    if (!d) return '';
    // DICOM dates are YYYYMMDD
    if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    return d;
  }

  function formatDicomTime(t?: string): string {
    if (!t) return '';
    // DICOM times are HHMMSS.ffffff
    if (t.length >= 6) return `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
    return t;
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* ===== TOP BAR ===== */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            title="Close Viewer (Esc)"
          >
            <XIcon className="w-5 h-5" />
          </button>
          <div className="h-5 w-px bg-slate-700" />
          <LayersIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-bold text-white">DICOM Study Viewer</span>
          {studyMeta?.patientName && (
            <span className="text-xs text-slate-400 ml-2">
              — {studyMeta.patientName}
              {studyMeta.modality && <span className="ml-2 px-1.5 py-0.5 bg-cyan-900/40 text-cyan-300 rounded text-[10px] font-bold">{studyMeta.modality}</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Slice counter */}
          {totalSlices > 1 && (
            <span className="text-[11px] text-slate-400 font-mono mr-2">
              Image {currentSlice}/{totalSlices}
            </span>
          )}
          {/* W/L display */}
          {wlDisplay.w !== 0 && (
            <span className="text-[11px] text-cyan-400 font-mono mr-2">
              W:{wlDisplay.w} L:{wlDisplay.l}
            </span>
          )}
          <button
            onClick={handleResetView}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            title="Reset View"
          >
            <RotateCcwIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            className={`p-1.5 rounded-lg transition-all ${showInfoPanel ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
            title="Study Info Panel"
          >
            <InfoIcon className="w-4 h-4" />
          </button>
          <button
            onClick={captureScreenshot}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded-lg transition-all"
            title="Screenshot & Annotate (Ctrl+S)"
          >
            <CameraIcon className="w-3.5 h-3.5" /> Screenshot
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            title="Toggle Fullscreen (F)"
          >
            {isBrowserFullscreen ? <MinimizeIcon className="w-4 h-4" /> : <MaximizeIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: Study Tree */}
        <div className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700/50">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Studies & Series</span>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2Icon className="w-6 h-6 text-cyan-400 animate-spin mb-2" />
                <p className="text-[11px] text-slate-500">Scanning DICOM files...</p>
              </div>
            ) : studies.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-4">
                <p className="text-[11px] text-slate-600 text-center">No DICOM files found</p>
              </div>
            ) : (
              studies.map(study => (
                <div key={study.id}>
                  <button
                    onClick={() => toggleStudy(study.id)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-slate-800/50 border-b border-slate-700/30"
                  >
                    {study.isExpanded ? <ChevronDownIcon className="w-3 h-3 text-slate-500 shrink-0" /> : <ChevronRightIcon className="w-3 h-3 text-slate-500 shrink-0" />}
                    <FolderIcon className="w-3 h-3 text-cyan-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-slate-200 truncate">{study.displayName}</p>
                      <p className="text-[9px] text-slate-500">{study.totalFiles} images · {study.series.length} series</p>
                    </div>
                  </button>
                  {study.isExpanded && study.series.map(series => {
                    const isActive = activeSeries?.id === series.id;
                    return (
                      <button
                        key={series.id}
                        onClick={() => loadSeries(series)}
                        className={`w-full flex items-center gap-2 pl-8 pr-3 py-2.5 text-left border-l-2 transition-all ${
                          isActive ? 'bg-cyan-900/30 border-cyan-500' : 'border-transparent hover:bg-slate-800/30'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-cyan-900/50 border border-cyan-600' : 'bg-slate-800 border border-slate-700'
                        }`}>
                          <ImageIcon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-medium truncate ${isActive ? 'text-cyan-300' : 'text-slate-300'}`}>
                            {series.displayName}
                          </p>
                          <p className="text-[9px] text-slate-500">{series.fileCount} images</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="px-3 py-1.5 border-t border-slate-700/50">
            <p className="text-[9px] text-slate-600 text-center">
              {studies.reduce((a, s) => a + s.totalFiles, 0)} DICOM images
            </p>
          </div>
        </div>

        {/* CENTER: Viewport */}
        <div className="flex-1 relative bg-black overflow-hidden">
          {/* Init/loading overlays */}
          {!isInitialized && !initError && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950">
              <Loader2Icon className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
              <p className="text-sm text-slate-400">Initializing DICOM engine...</p>
            </div>
          )}
          {initError && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950">
              <div className="bg-red-900/20 text-red-300 rounded-xl p-6 max-w-md text-center border border-red-800/30">
                <p className="text-sm font-bold mb-2">Initialization Failed</p>
                <p className="text-xs text-red-400">{initError}</p>
              </div>
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
              <Loader2Icon className="w-10 h-10 text-cyan-400 animate-spin" />
            </div>
          )}

          {/* DICOM metadata overlay (top-left, Horos-style) */}
          {studyMeta && viewportReady && !isLoading && (
            <div className="absolute top-3 left-3 z-10 text-white text-[11px] font-mono leading-relaxed pointer-events-none select-none" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              {studyMeta.patientName && <div>{studyMeta.patientName}</div>}
              {studyMeta.patientId && <div>ID: {studyMeta.patientId}</div>}
              {(studyMeta.patientBirthDate || studyMeta.patientSex) && (
                <div>
                  {studyMeta.patientSex && <span>{studyMeta.patientSex} </span>}
                  {studyMeta.patientBirthDate && <span>DOB: {formatDicomDate(studyMeta.patientBirthDate)}</span>}
                </div>
              )}
              <div className="mt-1" />
              {studyMeta.studyDescription && <div>{studyMeta.studyDescription}</div>}
              {studyMeta.studyDate && <div>{formatDicomDate(studyMeta.studyDate)} {formatDicomTime(studyMeta.studyTime)}</div>}
              {studyMeta.accessionNumber && <div>Acc#: {studyMeta.accessionNumber}</div>}
              {studyMeta.referringPhysician && <div>Ref: {studyMeta.referringPhysician}</div>}
            </div>
          )}

          {/* Series/image info overlay (top-right) */}
          {studyMeta && viewportReady && !isLoading && (
            <div className="absolute top-3 right-3 z-10 text-white text-[11px] font-mono leading-relaxed text-right pointer-events-none select-none" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              {studyMeta.seriesDescription && <div>{studyMeta.seriesDescription}</div>}
              {studyMeta.modality && <div>{studyMeta.modality}{studyMeta.seriesNumber ? ` · Series ${studyMeta.seriesNumber}` : ''}</div>}
              {studyMeta.instanceNumber && <div>Im: {studyMeta.instanceNumber}</div>}
            </div>
          )}

          {/* Bottom-left: technical info */}
          {studyMeta && viewportReady && !isLoading && (
            <div className="absolute bottom-3 left-3 z-10 text-white text-[10px] font-mono leading-relaxed pointer-events-none select-none" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              {(studyMeta.rows && studyMeta.columns) && <div>{studyMeta.columns} × {studyMeta.rows}</div>}
              {studyMeta.pixelSpacing && <div>Spacing: {studyMeta.pixelSpacing}</div>}
              {studyMeta.sliceThickness && <div>Thickness: {studyMeta.sliceThickness}</div>}
              {wlDisplay.w !== 0 && <div>W: {wlDisplay.w} L: {wlDisplay.l}</div>}
            </div>
          )}

          {/* Bottom-right: slice indicator */}
          {totalSlices > 1 && viewportReady && !isLoading && (
            <div className="absolute bottom-3 right-3 z-10 text-white text-[11px] font-mono pointer-events-none select-none" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              {currentSlice} / {totalSlices}
            </div>
          )}

          {/* Cornerstone3D viewport */}
          <div
            ref={viewportDivRef}
            className="w-full h-full"
            style={{ background: '#000' }}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        {/* RIGHT SIDEBAR: Study Details Panel */}
        {showInfoPanel && studyMeta && (
          <div className="w-72 flex-shrink-0 bg-slate-900 border-l border-slate-700 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
            <div className="px-4 py-3 border-b border-slate-700/50">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Study Details</h4>
            </div>

            {/* Patient Information */}
            <div className="px-4 py-3 border-b border-slate-700/30">
              <h5 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">Patient</h5>
              <MetaRow label="Name" value={studyMeta.patientName} />
              <MetaRow label="Patient ID" value={studyMeta.patientId} />
              <MetaRow label="Date of Birth" value={formatDicomDate(studyMeta.patientBirthDate)} />
              <MetaRow label="Sex" value={studyMeta.patientSex} />
            </div>

            {/* Study Information */}
            <div className="px-4 py-3 border-b border-slate-700/30">
              <h5 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">Study</h5>
              <MetaRow label="Description" value={studyMeta.studyDescription} />
              <MetaRow label="Date" value={formatDicomDate(studyMeta.studyDate)} />
              <MetaRow label="Time" value={formatDicomTime(studyMeta.studyTime)} />
              <MetaRow label="Accession #" value={studyMeta.accessionNumber} />
              <MetaRow label="Referring" value={studyMeta.referringPhysician} />
              <MetaRow label="Study UID" value={studyMeta.studyInstanceUID} truncate />
            </div>

            {/* Series Information */}
            <div className="px-4 py-3 border-b border-slate-700/30">
              <h5 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">Series</h5>
              <MetaRow label="Description" value={studyMeta.seriesDescription} />
              <MetaRow label="Modality" value={studyMeta.modality} />
              <MetaRow label="Series #" value={studyMeta.seriesNumber} />
              <MetaRow label="Series UID" value={studyMeta.seriesInstanceUID} truncate />
            </div>

            {/* Image Information */}
            <div className="px-4 py-3 border-b border-slate-700/30">
              <h5 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">Image</h5>
              <MetaRow label="Instance #" value={studyMeta.instanceNumber?.toString()} />
              <MetaRow label="Dimensions" value={studyMeta.rows && studyMeta.columns ? `${studyMeta.columns} × ${studyMeta.rows}` : undefined} />
              <MetaRow label="Pixel Spacing" value={studyMeta.pixelSpacing} />
              <MetaRow label="Slice Thickness" value={studyMeta.sliceThickness} />
              <MetaRow label="Window Width" value={studyMeta.windowWidth || (wlDisplay.w ? wlDisplay.w.toString() : undefined)} />
              <MetaRow label="Window Center" value={studyMeta.windowCenter || (wlDisplay.l ? wlDisplay.l.toString() : undefined)} />
            </div>

            {/* Equipment */}
            {(studyMeta.institution || studyMeta.manufacturer) && (
              <div className="px-4 py-3">
                <h5 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">Equipment</h5>
                <MetaRow label="Institution" value={studyMeta.institution} />
                <MetaRow label="Manufacturer" value={studyMeta.manufacturer} />
              </div>
            )}

            {/* Controls hint */}
            <div className="px-4 py-3 border-t border-slate-700/30 mt-auto">
              <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Controls</h5>
              <div className="space-y-1 text-[10px] text-slate-500">
                <div><strong className="text-slate-400">Left Drag</strong> — Window/Level</div>
                <div><strong className="text-slate-400">Right Drag</strong> — Zoom</div>
                <div><strong className="text-slate-400">Shift+Drag</strong> — Pan</div>
                <div><strong className="text-slate-400">Scroll / Arrows</strong> — Change Slice</div>
                <div><strong className="text-slate-400">F</strong> — Fullscreen</div>
                <div><strong className="text-slate-400">Ctrl+S</strong> — Screenshot</div>
                <div><strong className="text-slate-400">Esc</strong> — Close</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM BAR ===== */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900 border-t border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><SunIcon className="w-3 h-3" /> Left Drag: W/L</span>
          <span>|</span>
          <span className="flex items-center gap-1"><MoveIcon className="w-3 h-3" /> Right Drag: Zoom · Shift+Drag: Pan</span>
          <span>|</span>
          <span className="flex items-center gap-1"><LayersIcon className="w-3 h-3" /> Scroll / Arrow Keys: Change Slice</span>
        </div>
        <span className="text-[10px] text-cyan-600 font-medium">DICOM Study Viewer</span>
      </div>

      {/* ===== ANNOTATION DIALOG ===== */}
      {showAnnotationDialog && screenshotDataUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <CameraIcon className="w-4 h-4 text-amber-400" />
                Save Key Image Annotation
              </h4>
              <button
                onClick={() => { setShowAnnotationDialog(false); setScreenshotDataUrl(null); }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              {/* Preview */}
              <div className="mb-4 rounded-lg overflow-hidden border border-slate-700 bg-black">
                <img src={screenshotDataUrl} alt="Screenshot" className="w-full max-h-64 object-contain" />
              </div>
              {/* Study info summary */}
              <div className="mb-4 p-3 bg-slate-800 rounded-lg text-[11px] text-slate-300 space-y-0.5">
                {studyMeta?.patientName && <div><span className="text-slate-500">Patient:</span> {studyMeta.patientName}</div>}
                {studyMeta?.studyDescription && <div><span className="text-slate-500">Study:</span> {studyMeta.studyDescription}</div>}
                {studyMeta?.studyDate && <div><span className="text-slate-500">Date:</span> {formatDicomDate(studyMeta.studyDate)}</div>}
                {studyMeta?.modality && <div><span className="text-slate-500">Modality:</span> {studyMeta.modality}</div>}
                {totalSlices > 1 && <div><span className="text-slate-500">Slice:</span> {currentSlice} of {totalSlices}</div>}
              </div>
              {/* Annotation text */}
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Annotation Note</label>
              <textarea
                value={annotationText}
                onChange={(e) => setAnnotationText(e.target.value)}
                placeholder="Describe this key finding..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                rows={3}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-700 bg-slate-900/50">
              <button
                onClick={() => { setShowAnnotationDialog(false); setScreenshotDataUrl(null); }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAnnotation}
                className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg transition-all"
              >
                <SaveIcon className="w-4 h-4" /> Save Annotation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== Metadata row helper =====
const MetaRow: React.FC<{ label: string; value?: string; truncate?: boolean }> = ({ label, value, truncate }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 mb-1">
      <span className="text-[10px] text-slate-500 shrink-0 w-20">{label}</span>
      <span className={`text-[11px] text-slate-200 ${truncate ? 'truncate max-w-[150px]' : ''}`} title={truncate ? value : undefined}>
        {value}
      </span>
    </div>
  );
};

export default DicomStudyViewer;
