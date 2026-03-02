# DICOM Folder Viewer — Smart Study Organization Plan

## Problem

When uploading a typical DICOM disc (like the one shared), the folder structure is:
```
PatientDisc/
  1/          ← CT Head (but name is just "1")
  2/          ← MRI Lumbar Spine (but name is just "2")
  3/          ← X-Ray Chest (but name is just "3")
```

**Current behavior:** The study browser shows "1", "2", "3" with no patient name, modality, date, or description.

**Desired behavior (Horos-style):** Show "CT HEAD W/O CONTRAST", "MRI LUMBAR SPINE W/ CONTRAST", etc., with patient name, modality badge, study date — all extracted from the DICOM metadata embedded in each file.

## Solution Overview

1. **Parse DICOM metadata at upload time** using the already-installed `dicom-parser` library
2. **Group files by Study Instance UID** instead of folder path — proper DICOM-standard grouping
3. **Populate all metadata fields** in the study record (name, patient, modality, date, description)
4. **Add Google Drive folder import** — paste a shared Drive URL to import DICOM studies directly
5. **Improve the study browser table** with modality color-coding and better formatting

---

## Detailed Implementation Steps

### Step 1: Create `services/dicomParserService.ts` (new file)

A lightweight DICOM metadata extraction utility using the `dicom-parser` package:

```typescript
// Key function signatures:
parseDicomFile(file: File): Promise<DicomMeta | null>
  // Reads ArrayBuffer, extracts tags: PatientName, Modality, StudyDescription,
  // StudyDate, SeriesDescription, StudyInstanceUID, SeriesInstanceUID

groupFilesByDicomStudy(files: File[]): Promise<Map<string, StudyGroup>>
  // Parses first file of each folder group to get Study Instance UID
  // Re-groups all files by actual study UID
  // Returns metadata + files for each study
```

**DICOM tags to extract:**
| Tag | Name | Use |
|-----|------|-----|
| (0010,0010) | Patient Name | Display in table |
| (0010,0030) | Patient DOB | Display |
| (0008,0060) | Modality | CT/MR/CR/US badge |
| (0008,1030) | Study Description | **Primary study name** |
| (0008,0020) | Study Date | Display |
| (0008,103E) | Series Description | Fallback name |
| (0020,000D) | Study Instance UID | Grouping key |
| (0020,000E) | Series Instance UID | Series grouping |

**Performance:** Only parse the first file per folder-group (~64KB read per group). For a disc with 5 studies, that's 5 file reads — negligible overhead.

### Step 2: Update `App.tsx` — `handleDicomFolderDriveUpload`

Replace folder-path-based grouping with DICOM-metadata-based grouping:

**Before (current):**
```
files → group by folder path → study name = folder name ("1", "2", "3")
```

**After:**
```
files → group by folder path → parse 1st file per group → re-group by Study Instance UID
→ study name = Study Description ("CT HEAD W/O CONTRAST")
→ populate patient, modality, date, description
```

**Fallback chain for study naming:**
1. Study Description (tag 0008,1030) — e.g. "CT HEAD W/O CONTRAST"
2. Series Description (tag 0008,103E) — e.g. "AXIAL 5mm"
3. Modality + folder name — e.g. "CT — Folder 1"
4. Folder name (current behavior) — e.g. "1"

### Step 3: Add Google Drive Folder Import to `CaseDetails.tsx`

Add a new button "Import from Drive" next to the existing upload buttons. Flow:

1. User clicks "Import from Drive" → modal opens with a text input for a shared Drive folder URL
2. System extracts the folder ID from the URL
3. Lists files in the Drive folder (and subfolders) using the Google Drive API
4. Downloads each file temporarily for DICOM metadata parsing
5. Groups by Study Instance UID, extracts metadata
6. Creates `DicomStudyRecord` entries with full metadata
7. Creates `Document` records pointing to the existing Drive files (no re-upload needed)

**Key API calls:**
- `GET /drive/v3/files?q='FOLDER_ID'+in+parents` — list files in folder
- `GET /drive/v3/files/FILE_ID?alt=media` — download file content for parsing

**Note:** For the Drive import, we only need to download the first file of each subfolder to parse metadata (~64KB), not all files. The rest remain as Drive file references.

### Step 4: Update `types.ts` — `DicomStudyRecord`

Add new optional fields:
```typescript
export interface DicomStudyRecord {
  // ... existing fields ...
  studyInstanceUid?: string;  // For deduplication and proper DICOM grouping
  seriesCount?: number;       // Number of series within this study
  seriesDescriptions?: string[]; // List of series descriptions
}
```

### Step 5: Update `components/CaseDetails.tsx` — Study Browser Table

- **Modality color coding:** CT=blue, MR=purple, CR/DX=amber, US=green, PT=red, NM=orange
- **Better date formatting:** YYYYMMDD → "Jan 15, 2024"
- **Series count** in a new column or as a subtitle
- **Study name** shows description with folder name as subtitle if different

### Step 6: Update `components/DicomViewer.tsx` — Local Viewer Study Names

Update `parseFilesToStudies()` to be async and parse DICOM metadata:
- After grouping by folder path, read first file of each group
- Replace generic folder names ("1", "2") with Study/Series descriptions
- Update sidebar tree to show meaningful names

---

## Files Changed

| File | Change |
|------|--------|
| `services/dicomParserService.ts` | **NEW** — DICOM metadata parser + study grouper |
| `App.tsx` | Update `handleDicomFolderDriveUpload` to use metadata-based grouping |
| `types.ts` | Add `studyInstanceUid`, `seriesCount`, `seriesDescriptions` to `DicomStudyRecord` |
| `components/CaseDetails.tsx` | Add Drive import button/modal, modality colors, better formatting |
| `components/DicomViewer.tsx` | Update `parseFilesToStudies` to parse DICOM metadata for names |
| `services/googleDriveService.ts` | Add `listDriveFolderFiles` and `listDriveSubfolders` functions |

## Backwards Compatibility

- All new fields on `DicomStudyRecord` are optional
- Existing studies with folder-name-based names continue to display fine
- No database migration needed — Firestore is schemaless
- Fallback to folder-name grouping if DICOM parsing fails

## Risk Mitigation

- **Corrupt files:** `try/catch` around all `dicom-parser` calls, fall back to folder name
- **Non-DICOM files in folder:** Already filtered by existing `filterDicomFiles()` / `isDicomFileByName()`
- **Large discs:** Only parse 1 file per folder group, not every file
- **Drive API rate limits:** Sequential file listing with small batches
- **OAuth token expiry:** Existing token refresh flow handles this
