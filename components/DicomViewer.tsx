import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ZoomInIcon, ZoomOutIcon, RotateCcwIcon,
  SunIcon, MoveIcon, MaximizeIcon, Loader2Icon,
  MousePointerIcon, RulerIcon, DownloadIcon, InfoIcon,
  ChevronLeftIcon, ChevronRightIcon
} from 'lucide-react';
import { App as DwvApp, AppOptions, ViewConfig, toolList } from 'dwv';

interface DicomViewerProps {
  fileUrl: string;
  fileName: string;
}

type ToolName = 'WindowLevel' | 'ZoomAndPan' | 'Scroll' | 'Draw';

const TOOL_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  WindowLevel: { icon: <SunIcon className="w-4 h-4" />, label: 'Window/Level' },
  ZoomAndPan: { icon: <ZoomInIcon className="w-4 h-4" />, label: 'Zoom & Pan' },
  Scroll: { icon: <MousePointerIcon className="w-4 h-4" />, label: 'Scroll' },
  Draw: { icon: <RulerIcon className="w-4 h-4" />, label: 'Measure' },
};

const DicomViewer: React.FC<DicomViewerProps> = ({ fileUrl, fileName }) => {
  const dwvAppRef = useRef<DwvApp | null>(null);
  const containerIdRef = useRef(`dwv-container-${Math.random().toString(36).substr(2, 9)}`);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolName>('WindowLevel');
  const [loadProgress, setLoadProgress] = useState(0);
  const [dicomInfo, setDicomInfo] = useState<{ patient?: string; modality?: string; description?: string } | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const mountedRef = useRef(true);

  // Initialize dwv and load the DICOM file
  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    setLoadError(null);
    setLoadProgress(0);
    setDicomInfo(null);

    const app = new DwvApp();
    dwvAppRef.current = app;

    // Configure view
    const viewConfig = new ViewConfig(containerIdRef.current);
    const options = new AppOptions({ '*': [viewConfig] });

    // Configure available tools
    options.tools = {
      WindowLevel: {},
      ZoomAndPan: {},
      Scroll: {},
      Draw: { options: ['Ruler'] }
    };

    // Event handlers
    const handleLoadProgress = (event: any) => {
      if (mountedRef.current && event.loaded && event.total) {
        setLoadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    const handleLoad = (event: any) => {
      if (!mountedRef.current) return;
      setIsLoading(false);
      setLoadProgress(100);

      // Try to set initial tool
      try {
        app.setTool('WindowLevel');
        setActiveTool('WindowLevel');
      } catch (e) {
        // Tool may not be available for all image types
      }

      // Extract DICOM metadata
      try {
        const dataIds = app.getDataIds();
        if (dataIds.length > 0) {
          const metaData = app.getMetaData(dataIds[0]);
          if (metaData) {
            const getTag = (group: string, element: string) => {
              const key = `${group}${element}`;
              const tag = metaData[key];
              if (tag && tag.value && tag.value.length > 0) {
                return String(tag.value[0]);
              }
              return undefined;
            };
            setDicomInfo({
              patient: getTag('0010', '0010'),  // Patient Name
              modality: getTag('0008', '0060'),  // Modality
              description: getTag('0008', '1030'), // Study Description
            });
          }
        }
      } catch (e) {
        // Metadata extraction is optional
      }
    };

    const handleLoadEnd = () => {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    };

    const handleError = (event: any) => {
      if (mountedRef.current) {
        setIsLoading(false);
        setLoadError(event.error?.message || event.message || 'Failed to load DICOM file');
      }
    };

    app.addEventListener('loadprogress', handleLoadProgress);
    app.addEventListener('load', handleLoad);
    app.addEventListener('loadend', handleLoadEnd);
    app.addEventListener('error', handleError);

    // Initialize and load
    try {
      app.init(options);
      app.loadURLs([fileUrl]);
    } catch (e: any) {
      if (mountedRef.current) {
        setIsLoading(false);
        setLoadError(e.message || 'Failed to initialize DICOM viewer');
      }
    }

    return () => {
      mountedRef.current = false;
      try {
        app.removeEventListener('loadprogress', handleLoadProgress);
        app.removeEventListener('load', handleLoad);
        app.removeEventListener('loadend', handleLoadEnd);
        app.removeEventListener('error', handleError);
        app.reset();
      } catch (e) {
        // Cleanup errors are non-critical
      }
      dwvAppRef.current = null;
    };
  }, [fileUrl]);

  const handleSetTool = useCallback((toolName: ToolName) => {
    if (!dwvAppRef.current || isLoading) return;
    try {
      dwvAppRef.current.setTool(toolName);
      if (toolName === 'Draw') {
        dwvAppRef.current.setToolFeatures({ shapeName: 'Ruler' });
      }
      setActiveTool(toolName);
    } catch (e) {
      // Tool may not be available
    }
  }, [isLoading]);

  const handleZoom = useCallback((step: number) => {
    if (!dwvAppRef.current || isLoading) return;
    try {
      const layerGroup = dwvAppRef.current.getLayerGroupByDivId(containerIdRef.current);
      if (layerGroup) {
        const divEl = document.getElementById(containerIdRef.current);
        if (divEl) {
          const rect = divEl.getBoundingClientRect();
          dwvAppRef.current.zoom(step, rect.width / 2, rect.height / 2);
        }
      }
    } catch (e) {
      // Zoom error
    }
  }, [isLoading]);

  const handleReset = useCallback(() => {
    if (!dwvAppRef.current || isLoading) return;
    try {
      dwvAppRef.current.resetZoomPan();
    } catch (e) {
      // Reset error
    }
  }, [isLoading]);

  return (
    <div className="w-full h-full flex flex-col bg-black rounded-2xl overflow-hidden shadow-2xl">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        {/* Tool buttons */}
        <div className="flex items-center gap-1 mr-3">
          {Object.entries(TOOL_CONFIG).map(([name, config]) => (
            <button
              key={name}
              onClick={() => handleSetTool(name as ToolName)}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTool === name
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={config.label}
            >
              {config.icon}
              <span className="hidden sm:inline">{config.label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-600 mx-1" />

        {/* Zoom controls */}
        <button
          onClick={() => handleZoom(1)}
          disabled={isLoading}
          className="p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-all disabled:opacity-40"
          title="Zoom In"
        >
          <ZoomInIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(-1)}
          disabled={isLoading}
          className="p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-all disabled:opacity-40"
          title="Zoom Out"
        >
          <ZoomOutIcon className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          disabled={isLoading}
          className="p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-all disabled:opacity-40"
          title="Reset View"
        >
          <RotateCcwIcon className="w-4 h-4" />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Info toggle */}
        {dicomInfo && (
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-1.5 rounded-lg transition-all ${
              showInfo ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            title="DICOM Info"
          >
            <InfoIcon className="w-4 h-4" />
          </button>
        )}

        {/* Download link */}
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-all"
          title="Download DICOM"
        >
          <DownloadIcon className="w-4 h-4" />
        </a>

        {/* File name */}
        <span className="text-xs text-slate-400 ml-2 truncate max-w-[200px]" title={fileName}>
          {fileName}
        </span>
      </div>

      {/* DICOM Info overlay */}
      {showInfo && dicomInfo && (
        <div className="absolute top-14 left-4 z-10 bg-slate-900/90 backdrop-blur-sm text-white rounded-xl p-4 text-xs border border-slate-700 shadow-xl">
          {dicomInfo.patient && (
            <div className="mb-1"><span className="text-slate-400">Patient:</span> {dicomInfo.patient}</div>
          )}
          {dicomInfo.modality && (
            <div className="mb-1"><span className="text-slate-400">Modality:</span> {dicomInfo.modality}</div>
          )}
          {dicomInfo.description && (
            <div><span className="text-slate-400">Study:</span> {dicomInfo.description}</div>
          )}
        </div>
      )}

      {/* Viewer container */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: '400px' }}>
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/80">
            <Loader2Icon className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
            <p className="text-sm text-slate-300 font-medium">Loading DICOM image...</p>
            {loadProgress > 0 && loadProgress < 100 && (
              <div className="mt-3 w-48">
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                    style={{ width: `${loadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 text-center mt-1">{loadProgress}%</p>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {loadError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900">
            <div className="bg-red-900/30 text-red-300 rounded-xl p-6 max-w-md text-center border border-red-800/50">
              <p className="font-bold mb-2">Failed to load DICOM file</p>
              <p className="text-sm text-red-400 mb-4">{loadError}</p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all"
              >
                <DownloadIcon className="w-4 h-4" /> Download Instead
              </a>
            </div>
          </div>
        )}

        {/* dwv render target */}
        <div
          id={containerIdRef.current}
          className="w-full h-full"
          style={{ background: '#000' }}
        />
      </div>

      {/* Bottom bar with instructions */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-t border-slate-700 flex-shrink-0">
        <span className="text-[10px] text-slate-500">
          {activeTool === 'WindowLevel' && 'Drag to adjust brightness/contrast'}
          {activeTool === 'ZoomAndPan' && 'Scroll to zoom, drag to pan'}
          {activeTool === 'Scroll' && 'Drag up/down to scroll through slices'}
          {activeTool === 'Draw' && 'Click two points to measure distance'}
        </span>
        <span className="text-[10px] text-cyan-600 font-medium">Built-in DICOM Viewer</span>
      </div>
    </div>
  );
};

export default DicomViewer;
