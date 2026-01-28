
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase";

export const uploadFile = async (caseId: string, file: File) => {
  const fileRef = ref(storage, `cases/${caseId}/documents/${Date.now()}_${file.name}`);
  const snapshot = await uploadBytes(fileRef, file);
  const url = await getDownloadURL(snapshot.ref);
  
  return {
    url,
    storagePath: snapshot.ref.fullPath,
    name: file.name,
    size: (file.size / (1024 * 1024)).toFixed(2) + " MB"
  };
};

export const deleteFile = async (storagePath: string) => {
  const fileRef = ref(storage, storagePath);
  await deleteObject(fileRef);
};
