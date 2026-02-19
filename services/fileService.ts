
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase";

export interface UploadProgressData {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  state: string;
}

export interface UploadResult {
  url: string;
  storagePath: string;
  name: string;
  size: string;
}

/**
 * Upload file with resumable upload (supports large files, progress, pause/resume)
 */
export const uploadFile = async (
  caseId: string,
  file: File,
  onProgress?: (data: UploadProgressData) => void
): Promise<UploadResult> => {
  const fileRef = ref(storage, `cases/${caseId}/documents/${Date.now()}_${file.name}`);

  const uploadTask = uploadBytesResumable(fileRef, file, {
    contentType: file.type,
    customMetadata: {
      uploadedAt: new Date().toISOString()
    }
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress({
            progress,
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            state: snapshot.state
          });
        }
      },
      (error) => {
        reject(error);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          url,
          storagePath: uploadTask.snapshot.ref.fullPath,
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2) + " MB"
        });
      }
    );
  });
};

export const deleteFile = async (storagePath: string) => {
  const fileRef = ref(storage, storagePath);
  await deleteObject(fileRef);
};

/**
 * Upload a CV PDF for a user profile.
 * Stored at profiles/{userId}/cv/{filename}
 */
export const uploadCV = async (
  userId: string,
  file: File,
  onProgress?: (data: UploadProgressData) => void
): Promise<UploadResult> => {
  const fileRef = ref(storage, `profiles/${userId}/cv/${file.name}`);

  const uploadTask = uploadBytesResumable(fileRef, file, {
    contentType: 'application/pdf',
    customMetadata: { uploadedAt: new Date().toISOString() },
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress({ progress, bytesTransferred: snapshot.bytesTransferred, totalBytes: snapshot.totalBytes, state: snapshot.state });
        }
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          url,
          storagePath: uploadTask.snapshot.ref.fullPath,
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        });
      }
    );
  });
};
