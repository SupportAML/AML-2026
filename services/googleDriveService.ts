
import { GOOGLE_CONFIG } from '../config';

export interface DriveFolder {
  id: string;
  name: string;
  url: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
}

export interface DriveImportCandidate {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  relativePath: string; 
}

const SYNC_FILENAME = 'apex_med_law_sync.json';

/**
 * Finds the application sync file in the user's Drive.
 */
export const findSyncFile = async (accessToken: string): Promise<string | null> => {
  if (accessToken === 'mock-access-token') return 'mock-sync-id';
  
  try {
    const query = `name = '${SYNC_FILENAME}' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  } catch (e) {
    console.error("Error finding sync file", e);
    return null;
  }
};

/**
 * Reads the content of the sync file.
 */
export const readSyncFile = async (accessToken: string, fileId: string): Promise<any> => {
  if (accessToken === 'mock-access-token') return null;
  
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) return null;
    return response.json();
  } catch (e) {
    console.error("Error reading sync file", e);
    return null;
  }
};

/**
 * Saves or updates the application sync file.
 */
export const saveSyncFile = async (accessToken: string, data: any): Promise<void> => {
  if (accessToken === 'mock-access-token') return;

  try {
    const existingId = await findSyncFile(accessToken);
    const metadata = {
      name: SYNC_FILENAME,
      mimeType: 'application/json'
    };

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    
    if (existingId) {
      // Update existing using PATCH
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: blob
      });
    } else {
      // Create new using multipart upload
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);
      
      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: form
      });
    }
  } catch (e) {
    console.error("Error saving sync file", e);
    throw e;
  }
};

export const uploadFileToDrive = async (file: File, accessToken: string, folderId?: string): Promise<DriveFile> => {
  if (accessToken === 'mock-access-token') {
    return { id: `mock-file-${Date.now()}`, name: file.name, mimeType: file.type, sizeBytes: file.size };
  }

  const metadata: any = { name: file.name, mimeType: file.type };
  if (folderId) metadata.parents = [folderId];

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: form
  });

  if (!response.ok) throw new Error('Upload failed');
  const data = await response.json();
  return { id: data.id, name: data.name, mimeType: data.mimeType, sizeBytes: parseInt(data.size || '0') };
};

export const createDriveFolder = async (folderName: string, accessToken: string, parentId?: string): Promise<DriveFolder> => {
  if (accessToken === 'mock-access-token') return { id: `mock-folder-${Date.now()}`, name: folderName, url: '#' };
  const body: any = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId && parentId !== 'root') body.parents = [parentId];
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Failed to create folder');
  const data = await response.json();
  return { id: data.id, name: data.name, url: `https://drive.google.com/drive/folders/${data.id}` };
};

export const listDriveFiles = async (accessToken: string, folderId: string = 'root') => {
  if (accessToken === 'mock-access-token') return [];
  const query = `'${folderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/pdf') and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, size)&orderBy=folder,name&pageSize=1000`;
  const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error('Failed to list files');
  const data = await response.json();
  return data.files || [];
};

export const getRecursiveFiles = async (accessToken: string, folderId: string, currentPath: string = '/'): Promise<DriveImportCandidate[]> => {
  let results: DriveImportCandidate[] = [];
  try {
    const files = await listDriveFiles(accessToken, folderId);
    for (const file of files) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const subFiles = await getRecursiveFiles(accessToken, file.id, `${currentPath}${file.name}/`);
        results = [...results, ...subFiles];
      } else if (file.mimeType === 'application/pdf') {
        results.push({ id: file.id, name: file.name, mimeType: file.mimeType, size: file.size, relativePath: currentPath });
      }
    }
  } catch (e) { console.error(e); }
  return results;
};

export const getFileDownloadUrl = async (fileId: string, accessToken: string): Promise<string> => {
  if (accessToken === 'mock-access-token') return "data:application/pdf;base64,JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvQ291bnQgMQogIC9LaWRzIFszIDAgUl0KPj4KZW5kb2JqCgozIDAgvYmoKPDwKICAvVHlwZSAvUGFnZQogIC9QYXJlbnQgMiAwIFIKICAvUmVzb3VyY2VzIDw8CiAgICAvRm9udCA8PAogICAgICAvRjEgNCAwIFIKICAgID4+CiAgPj4KICAvTWVkaWFCb3ggWzAgMCA1OTUuMjggODQxLjg5XQogIC9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKICAvVHlwZSAvRm9udAogIC9TdWJ0eXBlIC9UeXBlMQogIC9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagoKNSAwIG9iago8PAogIC9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgoxMCA3NTAgVGQKKE1vY2sgRXZpZGVuY2UpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNjggMDAwMDAgbiAKMDAwMDAwMDEyMiAwMDAwMCBuIAowMDAwMDAwMjgxIDAwMDAwIG4gCjAwMDAwMDAzNTAgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDQ1CiUlRU9G";
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error('Failed to download file');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
