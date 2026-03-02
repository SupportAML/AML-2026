/**
 * Lightweight DICOM metadata extraction using the `dicom-parser` library.
 * Used at upload time to extract meaningful study names, modality, dates, etc.
 * Only reads the first file per folder group — no rendering overhead.
 */
import dicomParser from 'dicom-parser';

export interface DicomMeta {
  patientName?: string;
  patientId?: string;
  patientDob?: string;
  modality?: string;
  studyDescription?: string;
  studyDate?: string;
  seriesDescription?: string;
  studyInstanceUid?: string;
  seriesInstanceUid?: string;
  institutionName?: string;
}

export interface StudyGroup {
  metadata: DicomMeta;
  files: File[];
  /** Readable display name derived from metadata */
  displayName: string;
  /** Number of distinct series UIDs found */
  seriesCount: number;
  seriesDescriptions: string[];
}

// ============================================================
// Parse a single DICOM file's metadata (header only)
// ============================================================
export async function parseDicomFile(file: File): Promise<DicomMeta | null> {
  try {
    // Read the whole file — dicom-parser needs the full buffer for tag lookup.
    // Typical DICOM headers are small; the pixel data is at the end and is
    // skipped by the tag accessor. For very large files (>50MB), read only
    // the first 512KB which covers virtually all metadata.
    const readSize = file.size > 50 * 1024 * 1024 ? 512 * 1024 : file.size;
    const buffer = await file.slice(0, readSize).arrayBuffer();
    const byteArray = new Uint8Array(buffer);
    const dataSet = dicomParser.parseDicom(byteArray, { untilTag: 'x7fe00010' }); // stop before pixel data

    const getString = (tag: string): string | undefined => {
      try {
        const val = dataSet.string(tag);
        return val ? val.trim() : undefined;
      } catch {
        return undefined;
      }
    };

    return {
      patientName: cleanPersonName(getString('x00100010')),
      patientId: getString('x00100020'),
      patientDob: formatDicomDate(getString('x00100030')),
      modality: getString('x00080060'),
      studyDescription: getString('x00081030'),
      studyDate: formatDicomDate(getString('x00080020')),
      seriesDescription: getString('x0008103e'),
      studyInstanceUid: getString('x0020000d'),
      seriesInstanceUid: getString('x0020000e'),
      institutionName: getString('x00080080'),
    };
  } catch (e) {
    console.warn('[dicomParserService] Failed to parse DICOM file:', file.name, e);
    return null;
  }
}

// ============================================================
// Group files by DICOM Study Instance UID
// ============================================================
export async function groupFilesByDicomStudy(files: File[]): Promise<Map<string, StudyGroup>> {
  // Step 1: Initial folder-based grouping (to limit how many files we parse)
  const folderGroups = new Map<string, File[]>();
  for (const file of files) {
    const relPath = ((file as any).webkitRelativePath || file.name).replace(/\\/g, '/');
    const parts = relPath.split('/').filter(Boolean);
    // Use the deepest folder before the filename
    const folderKey = parts.length >= 2 ? parts.slice(0, -1).join('/') : 'Root';
    if (!folderGroups.has(folderKey)) folderGroups.set(folderKey, []);
    folderGroups.get(folderKey)!.push(file);
  }

  // Step 2: Parse first file of each folder group to get Study Instance UID + metadata
  const folderMeta = new Map<string, DicomMeta>();
  for (const [folderKey, folderFiles] of folderGroups) {
    // Try first file, fall back to second if it fails
    for (let i = 0; i < Math.min(3, folderFiles.length); i++) {
      const meta = await parseDicomFile(folderFiles[i]);
      if (meta && meta.studyInstanceUid) {
        folderMeta.set(folderKey, meta);
        break;
      }
      if (meta && !meta.studyInstanceUid) {
        // Has some metadata but no study UID — still useful
        folderMeta.set(folderKey, meta);
        break;
      }
    }
  }

  // Step 3: Re-group files by Study Instance UID
  const studyMap = new Map<string, StudyGroup>();
  const seriesTracker = new Map<string, Set<string>>(); // studyKey → set of series UIDs

  for (const [folderKey, folderFiles] of folderGroups) {
    const meta = folderMeta.get(folderKey);
    // Use Study Instance UID as group key, fall back to folder-based key
    const studyKey = meta?.studyInstanceUid || `folder:${getFolderStudyName(folderKey)}`;

    if (!studyMap.has(studyKey)) {
      const displayName = deriveDisplayName(meta, folderKey);
      studyMap.set(studyKey, {
        metadata: meta || {},
        files: [],
        displayName,
        seriesCount: 0,
        seriesDescriptions: [],
      });
      seriesTracker.set(studyKey, new Set());
    }

    const group = studyMap.get(studyKey)!;
    group.files.push(...folderFiles);

    // Track series
    const seriesSet = seriesTracker.get(studyKey)!;
    if (meta?.seriesInstanceUid) {
      if (!seriesSet.has(meta.seriesInstanceUid)) {
        seriesSet.add(meta.seriesInstanceUid);
        if (meta.seriesDescription && !group.seriesDescriptions.includes(meta.seriesDescription)) {
          group.seriesDescriptions.push(meta.seriesDescription);
        }
      }
    }

    // Merge metadata if current folder has richer info
    if (meta) {
      const existing = group.metadata;
      if (!existing.patientName && meta.patientName) existing.patientName = meta.patientName;
      if (!existing.studyDescription && meta.studyDescription) existing.studyDescription = meta.studyDescription;
      if (!existing.modality && meta.modality) existing.modality = meta.modality;
      if (!existing.studyDate && meta.studyDate) existing.studyDate = meta.studyDate;
    }
  }

  // Step 4: Finalize series counts
  for (const [studyKey, group] of studyMap) {
    const seriesSet = seriesTracker.get(studyKey);
    group.seriesCount = seriesSet ? Math.max(seriesSet.size, 1) : 1;
  }

  return studyMap;
}

// ============================================================
// Parse metadata from the first file in a list (for quick extraction)
// ============================================================
export async function extractMetadataFromFirstFile(files: File[]): Promise<DicomMeta | null> {
  for (let i = 0; i < Math.min(3, files.length); i++) {
    const meta = await parseDicomFile(files[i]);
    if (meta) return meta;
  }
  return null;
}

// ============================================================
// Helpers
// ============================================================

/** Clean DICOM PersonName (caret-separated) into human-readable form */
function cleanPersonName(raw?: string): string | undefined {
  if (!raw) return undefined;
  // DICOM person names use ^ as separator: "LastName^FirstName^MiddleName^Prefix^Suffix"
  const cleaned = raw.replace(/\^/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

/** Convert DICOM date (YYYYMMDD) to readable format */
function formatDicomDate(raw?: string): string | undefined {
  if (!raw || raw.length < 8) return raw;
  const y = raw.substring(0, 4);
  const m = raw.substring(4, 6);
  const d = raw.substring(6, 8);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(m, 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${monthNames[monthIdx]} ${parseInt(d, 10)}, ${y}`;
  }
  return `${m}/${d}/${y}`;
}

/** Extract a meaningful study name from a folder path */
function getFolderStudyName(folderKey: string): string {
  const parts = folderKey.split('/').filter(Boolean);
  if (parts.length >= 2) return parts[1];
  return parts[0] || 'DICOM Study';
}

/** Derive a display name from metadata with smart fallbacks */
function deriveDisplayName(meta: DicomMeta | undefined, folderKey: string): string {
  if (meta?.studyDescription) return meta.studyDescription;
  if (meta?.seriesDescription) {
    const prefix = meta.modality ? `${meta.modality} — ` : '';
    return `${prefix}${meta.seriesDescription}`;
  }
  if (meta?.modality) {
    const folderName = getFolderStudyName(folderKey);
    // If folder name is just a number, use modality as the name
    if (/^\d+$/.test(folderName)) {
      return `${meta.modality} Study`;
    }
    return `${meta.modality} — ${folderName}`;
  }
  const folderName = getFolderStudyName(folderKey);
  if (/^\d+$/.test(folderName)) return 'DICOM Study';
  return folderName;
}

/** Extract Google Drive folder ID from a shared URL */
export function extractDriveFolderIdFromUrl(url: string): string | null {
  // Handles:
  //   https://drive.google.com/drive/folders/FOLDER_ID
  //   https://drive.google.com/drive/folders/FOLDER_ID?usp=share_link
  //   https://drive.google.com/drive/u/0/folders/FOLDER_ID
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}
