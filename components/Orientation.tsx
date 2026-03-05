import React from 'react';
import {
    LayoutDashboardIcon,
    UploadIcon,
    ScanIcon,
    SparklesIcon,
    TableIcon,
    SearchIcon,
    FolderIcon,
    FileTextIcon,
    DownloadIcon,
    SunIcon,
    MoveIcon,
    RulerIcon,
    CameraIcon,
    MessageSquareIcon,
    ArrowRightIcon,
    ClipboardListIcon,
    PenToolIcon,
    FileIcon,
    ImageIcon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Infographic: Dashboard                                             */
/* ------------------------------------------------------------------ */
const DashboardVisual: React.FC = () => {
    const statuses = [
        { label: 'Planning', bg: 'bg-indigo-100', text: 'text-indigo-700', bar: 'bg-indigo-400', w: 'w-3/5' },
        { label: 'Active', bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-400', w: 'w-full' },
        { label: 'On Hold', bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-400', w: 'w-2/5' },
        { label: 'Archived', bg: 'bg-slate-100', text: 'text-slate-600', bar: 'bg-slate-400', w: 'w-1/4' },
    ];
    return (
        <div className="bg-cyan-50 rounded-2xl p-4 flex-1 min-w-[200px]">
            {/* search bar mockup */}
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-slate-200 mb-3">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-400">Search cases…</span>
            </div>
            {/* status pills */}
            <div className="flex flex-wrap gap-1.5 mb-3">
                {statuses.map(s => (
                    <span key={s.label} className={`${s.bg} ${s.text} text-[10px] font-semibold px-2 py-0.5 rounded-full`}>
                        {s.label}
                    </span>
                ))}
            </div>
            {/* mini bar chart */}
            <div className="space-y-1.5">
                {statuses.map(s => (
                    <div key={s.label} className="flex items-center gap-2">
                        <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${s.bar} rounded-full ${s.w}`} />
                        </div>
                        <span className="text-[9px] text-slate-500 w-12 text-right">{s.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  Infographic: File Management                                       */
/* ------------------------------------------------------------------ */
const FilesVisual: React.FC = () => (
    <div className="bg-indigo-50 rounded-2xl p-4 flex-1 min-w-[200px]">
        {/* upload methods */}
        <div className="flex gap-2 mb-3">
            {[
                { icon: FileIcon, label: 'File' },
                { icon: FolderIcon, label: 'Folder' },
                { icon: DownloadIcon, label: 'Drop' },
            ].map(m => (
                <div key={m.label} className="flex items-center gap-1 bg-white rounded-md px-2 py-1 border border-indigo-200 text-[10px] text-indigo-600 font-medium">
                    <m.icon className="w-3 h-3" />
                    {m.label}
                </div>
            ))}
        </div>
        {/* file tree */}
        <div className="space-y-0.5 text-[11px] text-slate-700">
            <div className="flex items-center gap-1.5 font-semibold">
                <FolderIcon className="w-3.5 h-3.5 text-amber-500" />
                Medical Records
            </div>
            <div className="pl-5 flex items-center gap-1.5 border-l border-slate-200 ml-[7px]">
                <FolderIcon className="w-3.5 h-3.5 text-amber-400" />
                Imaging
            </div>
            <div className="pl-10 flex items-center gap-1.5 border-l border-slate-200 ml-[7px]">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                <span className="flex-1">MRI_Report.dcm</span>
                <DownloadIcon className="w-3 h-3 text-indigo-400" />
            </div>
            <div className="pl-10 flex items-center gap-1.5 border-l border-slate-200 ml-[7px]">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                CT_Scan.dcm
            </div>
            <div className="pl-5 flex items-center gap-1.5 border-l border-slate-200 ml-[7px]">
                <FileTextIcon className="w-3.5 h-3.5 text-slate-400" />
                Discharge_Summary.pdf
            </div>
            <div className="flex items-center gap-1.5 font-semibold mt-1">
                <FolderIcon className="w-3.5 h-3.5 text-amber-500" />
                Legal Documents
            </div>
            <div className="pl-5 flex items-center gap-1.5 border-l border-slate-200 ml-[7px]">
                <FileTextIcon className="w-3.5 h-3.5 text-slate-400" />
                Complaint.pdf
            </div>
        </div>
    </div>
);

/* ------------------------------------------------------------------ */
/*  Infographic: DICOM Viewer                                          */
/* ------------------------------------------------------------------ */
const DicomVisual: React.FC = () => {
    const tools = [
        { icon: SunIcon, label: 'W/L' },
        { icon: MoveIcon, label: 'Pan' },
        { icon: RulerIcon, label: 'Measure' },
        { icon: CameraIcon, label: 'Capture' },
    ];
    return (
        <div className="bg-emerald-50 rounded-2xl p-4 flex-1 min-w-[200px]">
            {/* dark toolbar */}
            <div className="bg-slate-800 rounded-xl p-2.5 flex items-center justify-center gap-2 mb-3">
                {tools.map(t => (
                    <div key={t.label} className="flex flex-col items-center gap-1">
                        <div className="bg-slate-700 rounded-lg p-1.5">
                            <t.icon className="w-3.5 h-3.5 text-slate-300" />
                        </div>
                        <span className="text-[9px] text-slate-500">{t.label}</span>
                    </div>
                ))}
            </div>
            {/* screenshot flow */}
            <div className="flex items-center justify-center gap-1.5 text-[10px]">
                <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 rounded-md px-2 py-1 font-medium">
                    <CameraIcon className="w-3 h-3" />
                    Screenshot
                </div>
                <ArrowRightIcon className="w-3.5 h-3.5 text-slate-400" />
                <div className="bg-emerald-100 text-emerald-700 rounded-md px-2 py-1 font-medium">
                    PDF
                </div>
                <ArrowRightIcon className="w-3.5 h-3.5 text-slate-400" />
                <div className="bg-emerald-100 text-emerald-700 rounded-md px-2 py-1 font-medium">
                    Fact Matrix
                </div>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  Infographic: AI Tools                                              */
/* ------------------------------------------------------------------ */
const AIVisual: React.FC = () => {
    const flow = [
        { icon: PenToolIcon, label: 'Annotate', bg: 'bg-cyan-100', text: 'text-cyan-700' },
        { icon: ClipboardListIcon, label: 'Fact Matrix', bg: 'bg-indigo-100', text: 'text-indigo-700' },
        { icon: MessageSquareIcon, label: 'AI Writer', bg: 'bg-amber-100', text: 'text-amber-700' },
    ];
    const badges = [
        { label: 'Legal Writer', bg: 'bg-amber-100', text: 'text-amber-700' },
        { label: 'Depo Prep', bg: 'bg-rose-100', text: 'text-rose-700' },
        { label: 'Research', bg: 'bg-indigo-100', text: 'text-indigo-700' },
        { label: 'Facts & Notes', bg: 'bg-cyan-100', text: 'text-cyan-700' },
    ];
    return (
        <div className="bg-amber-50 rounded-2xl p-4 flex-1 min-w-[200px]">
            {/* 3-node flow */}
            <div className="flex items-center justify-center gap-1 mb-3">
                {flow.map((n, i) => (
                    <React.Fragment key={n.label}>
                        <div className={`${n.bg} ${n.text} rounded-xl px-2.5 py-2 flex flex-col items-center gap-1`}>
                            <n.icon className="w-4 h-4" />
                            <span className="text-[9px] font-semibold leading-tight">{n.label}</span>
                        </div>
                        {i < flow.length - 1 && <ArrowRightIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    </React.Fragment>
                ))}
            </div>
            {/* tool badges */}
            <div className="flex flex-wrap gap-1.5 justify-center">
                {badges.map(b => (
                    <span key={b.label} className={`${b.bg} ${b.text} text-[10px] font-semibold px-2 py-0.5 rounded-full`}>
                        {b.label}
                    </span>
                ))}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  Infographic: Annotations & Fact Matrix                             */
/* ------------------------------------------------------------------ */
const AnnotationsVisual: React.FC = () => {
    const rows = [
        { date: '3/01', event: 'Lumbar surgery performed', cat: 'Medical', src: 'p.12' },
        { date: '3/15', event: 'Follow-up visit — pain noted', cat: 'Medical', src: 'p.24' },
        { date: '4/02', event: 'Deposition of Dr. Smith', cat: 'Legal', src: 'p.3' },
    ];
    const dots = ['3/1', '3/15', '4/2', '4/20'];
    return (
        <div className="bg-slate-100 rounded-2xl p-4 flex-1 min-w-[280px]">
            {/* mini table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-3 text-[10px]">
                <div className="grid grid-cols-4 gap-0 bg-slate-50 px-2 py-1 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <span>Date</span><span>Event</span><span>Category</span><span>Source</span>
                </div>
                {rows.map(r => (
                    <div key={r.date} className="grid grid-cols-4 gap-0 px-2 py-1 text-slate-600 border-b border-slate-100 last:border-0">
                        <span className="font-medium">{r.date}</span>
                        <span className="truncate">{r.event}</span>
                        <span>{r.cat}</span>
                        <span className="text-cyan-600">{r.src}</span>
                    </div>
                ))}
            </div>
            {/* timeline */}
            <div className="flex items-center px-2">
                {dots.map((d, i) => (
                    <React.Fragment key={d}>
                        <div className="flex flex-col items-center gap-0.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 border-2 border-white shadow-sm" />
                            <span className="text-[9px] text-slate-500">{d}</span>
                        </div>
                        {i < dots.length - 1 && <div className="h-0.5 flex-1 bg-slate-300 rounded-full -mt-2.5" />}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  Category card data                                                 */
/* ------------------------------------------------------------------ */
interface Category {
    title: string;
    icon: React.ElementType;
    iconBg: string;
    iconText: string;
    bullets: { bold: string; rest: string }[];
    Visual: React.FC;
    span?: boolean;
}

const CATEGORIES: Category[] = [
    {
        title: 'Using the Dashboard',
        icon: LayoutDashboardIcon,
        iconBg: 'bg-cyan-100',
        iconText: 'text-cyan-600',
        bullets: [
            { bold: 'Search & filter', rest: ' cases by name, attorney, or date range' },
            { bold: 'Status tabs', rest: ' — Planning, Active, On Hold, Cancelled, and Archived' },
            { bold: '+ New Case', rest: ' to create a case and assign a client' },
            { bold: 'Click any row', rest: ' to open case details, files, and annotations' },
        ],
        Visual: DashboardVisual,
    },
    {
        title: 'Uploading & Managing Files',
        icon: UploadIcon,
        iconBg: 'bg-indigo-100',
        iconText: 'text-indigo-600',
        bullets: [
            { bold: 'Upload', rest: ' single files, entire folders, or drag & drop' },
            { bold: 'Organize', rest: ' with folders — drag files between them to reorganize' },
            { bold: 'Supported', rest: ' — PDFs, images, video, DICOM, and all file types' },
            { bold: 'Hover any file', rest: ' for download, rename, or review-status controls' },
        ],
        Visual: FilesVisual,
    },
    {
        title: 'DICOM Medical Imaging',
        icon: ScanIcon,
        iconBg: 'bg-emerald-100',
        iconText: 'text-emerald-600',
        bullets: [
            { bold: 'Open a DICOM folder', rest: ' — CT, MRI, X-ray, or Ultrasound — 100% local' },
            { bold: 'Window/Level presets', rest: ' — Soft Tissue, Lung, Bone, Brain, and more' },
            { bold: 'Measure & annotate', rest: ' with Ruler, Arrow, Circle, or Protractor tools' },
            { bold: 'Screenshot', rest: ' saves as PDF and auto-creates a Fact Matrix entry' },
        ],
        Visual: DicomVisual,
    },
    {
        title: 'AI-Powered Tools',
        icon: SparklesIcon,
        iconBg: 'bg-amber-100',
        iconText: 'text-amber-600',
        bullets: [
            { bold: 'Legal Writer', rest: ' — draft reports with Claude AI chat, insert or replace sections' },
            { bold: 'Deposition Prep', rest: ' — run strategy analysis, then practice Q&A with AI coach' },
            { bold: 'Medical Research', rest: ' — find gaps in your draft, search literature, insert citations' },
            { bold: 'Facts & Notes', rest: ' — enter raw notes, AI extracts structured facts to timeline' },
        ],
        Visual: AIVisual,
    },
    {
        title: 'Annotations & Fact Matrix',
        icon: TableIcon,
        iconBg: 'bg-slate-200',
        iconText: 'text-slate-700',
        span: true,
        bullets: [
            { bold: 'Click any page', rest: ' in the document viewer to create a point annotation' },
            { bold: 'Add metadata', rest: ' — dates, categories (Medical / Legal), and notes to each entry' },
            { bold: 'Fact Matrix', rest: ' — filterable table view of all facts by date, category, and source' },
            { bold: 'Chronology Timeline', rest: ' — visual timeline organized by year and month' },
            { bold: 'Auto-context', rest: ' — all annotations feed directly into the Legal Writer' },
        ],
        Visual: AnnotationsVisual,
    },
];

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
const Orientation: React.FC = () => {
    return (
        <div className="flex-1 overflow-auto bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <header className="mb-10 text-center">
                    <h1 className="text-4xl font-serif font-black text-slate-900 mb-3">Quick-Start Guide</h1>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                        Get acquainted with ApexMedLaw — explore the tools and workflows that power your medical-legal cases.
                    </p>
                </header>

                {/* Category cards grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {CATEGORIES.map(cat => (
                        <div
                            key={cat.title}
                            className={`bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden ${cat.span ? 'lg:col-span-2' : ''}`}
                        >
                            {/* Card header */}
                            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                                <div className={`w-10 h-10 ${cat.iconBg} ${cat.iconText} rounded-xl flex items-center justify-center`}>
                                    <cat.icon className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-serif font-black text-slate-800">{cat.title}</h3>
                            </div>

                            {/* Card body: bullets + visual */}
                            <div className="p-6 flex flex-col md:flex-row gap-6">
                                {/* Bullet list */}
                                <ul className="space-y-3 flex-1 min-w-0">
                                    {cat.bullets.map((b, i) => (
                                        <li key={i} className="flex gap-3 text-sm text-slate-600">
                                            <div className={`w-1.5 h-1.5 rounded-full ${cat.iconBg} mt-1.5 shrink-0`} />
                                            <span>
                                                <strong className="text-slate-800">{b.bold}</strong>
                                                {b.rest}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                {/* Infographic */}
                                <cat.Visual />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Orientation;
