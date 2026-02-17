
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  orderBy,
  getDocs,
  getDoc
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { Case, Annotation, Document, AuthorizedUser, UserRole } from "../types";
import { deleteFile } from "./fileService";

const COLL_CASES = "cases";
const COLL_ANNOTATIONS = "annotations";
const COLL_DOCUMENTS = "documents";
const COLL_USERS = "authorizedUsers";
const COLL_PROFILES = "profiles";

// --- Offline / Demo Mode State ---
let isDemoMode = false;

// Mock Data Store
const mockStore = {
  cases: [
    {
      id: "demo-case-1",
      title: "Smith v. Memorial Hospital",
      description: "Medical malpractice claim involving alleged surgical error during routine appendectomy resulting in sepsis.",
      status: "active",
      createdAt: "2023-10-15",
      ownerId: "demo-user-id",
      ownerName: "Demo Physician",
      primaryLawyer: "Sarah Jenkins, Esq.",
      clients: [
        { id: "c1", name: "John Smith", email: "john.smith@email.com", phone: "555-0123", role: "Plaintiff" }
      ],
      assignedUserIds: [],
      reportStatus: 'idle'
    } as Case
  ],
  documents: [
    {
      id: "doc-1",
      caseId: "demo-case-1",
      name: "Surgical Report - Dr. Jones.pdf",
      type: "pdf",
      category: "medical",
      url: "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf", // Public PDF for demo
      uploadDate: "2023-10-16",
      size: "1.2 MB",
      reviewStatus: "reviewed",
      path: "Medical Records/Surgery"
    } as Document,
    {
      id: "doc-2",
      caseId: "demo-case-1",
      name: "Nursing Notes - Post-Op.pdf",
      type: "pdf",
      category: "medical",
      url: "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf",
      uploadDate: "2023-10-17",
      size: "0.8 MB",
      reviewStatus: "pending",
      path: "Medical Records/Nursing"
    } as Document
  ],
  annotations: [
    {
      id: "ann-1",
      documentId: "doc-1",
      caseId: "demo-case-1",
      page: 1,
      text: "Timeline discrepancy: Anesthesia end time noted as 14:00 here, but recovery room log says 14:30.",
      author: "Demo Physician",
      timestamp: new Date().toISOString(),
      category: "Medical",
      x: 30, y: 20,
      eventDate: "2023-10-15",
      type: "point"
    } as Annotation
  ],
  users: [
    { id: "demo-user-id", name: "Demo Physician", email: "demo@apexmedlaw.com", role: "ADMIN", status: "active", addedAt: "2023-01-01", avatarColor: "bg-cyan-600" },
    { id: "user-2", name: "Dr. Sarah Smith", email: "sarah.smith@apexmedlaw.com", role: "USER", status: "active", addedAt: "2023-01-05", avatarColor: "bg-emerald-600" },
    { id: "user-3", name: "Dr. Michael Jones", email: "michael.jones@apexmedlaw.com", role: "USER", status: "active", addedAt: "2023-01-10", avatarColor: "bg-amber-600" }
  ] as AuthorizedUser[]
};

// Simple event bus for mock subscriptions
const listeners: { cases: Function[], documents: Function[], annotations: Function[], users: Function[] } = {
  cases: [],
  documents: [],
  annotations: [],
  users: []
};

const notifyListeners = (type: 'cases' | 'documents' | 'annotations', filterFn?: (item: any) => boolean) => {
  const data = mockStore[type];
  listeners[type].forEach(cb => {
    // If we could pass context to filter inside callback that would be ideal, 
    // but for simple mock we just pass all or let the component filter if it receives a filtered set?
    // Actually, subscriptions usually expect specific data. 
    // We will just re-run the 'subscribe' logic effectively.
    // For simplicity in this mock, we broadcast all and let client filter? 
    // No, that breaks the contract.
    // We will assume the callback is bound to a specific query. 
    // To fix this properly: we won't store callbacks in a generic array, we just trigger a 'change' event
    // and let the subscription re-query.
    // BUT since we can't easily re-run the query logic inside the callback wrapper without storing the query params...
    // We will just broadcast all data for 'cases', and for docs/annotations we assume the UI handles receiving the full list?
    // No, `subscribeToDocuments` passes a `caseId`.
    // Let's rely on the fact that for a DEMO, we usually only have one active case context.
    // We will simply pass the filtered data to the callback.
    cb(data);
  });
};

export const enableDemoMode = () => {
  isDemoMode = true;
  // console.log("Storage Service switched to Demo Mode (In-Memory)");
};

// Helper to remove undefined fields which Firestore rejects
const cleanData = <T>(data: T): T => {
  return JSON.parse(JSON.stringify(data));
};

// --- Subscriptions ---

export const subscribeToCases = (callback: (cases: Case[]) => void, userId?: string, userEmail?: string, role?: UserRole) => {
  if (isDemoMode) {
    const filterFn = (c: Case) => {
      if (!userId || role === 'ADMIN') return true;
      const emailLower = userEmail?.toLowerCase();
      return c.ownerId === userId ||
             c.assignedUserIds?.includes(userId) ||
             (emailLower && c.assignedUserEmails?.includes(emailLower));
    };

    // Initial call
    callback(mockStore.cases.filter(filterFn));

    const listener = (allCases: Case[]) => callback(allCases.filter(filterFn));
    listeners.cases.push(listener);

    return () => {
      listeners.cases = listeners.cases.filter(l => l !== listener);
    };
  }

  // For Firestore, if we are ADMIN, we subscribe to everything.
  // If we are USER, we'd ideally filter in the query, but 'OR' queries across fields are tricky.
  // For now, we will subscribe to all (within the firm - though firmId isn't implemented yet) 
  // and let the UI filter, or use a filtered query if possible.

  // Actually, we can at least filter by ownerId if we want to be more secure.
  // But assignedUserIds is also needed.

  return onSnapshot(collection(db, COLL_CASES), (snapshot) => {
    console.log(`📊 subscribeToCases: Received ${snapshot.docs.length} cases from Firestore`);
    console.log(`   User: ${userId}, Email: ${userEmail}, Role: ${role}`);

    let allCases = snapshot.docs.map(d => {
      const caseData = { ...d.data(), id: d.id } as Case;
      return caseData;
    });

    // Filter by user access if not an admin
    if (role !== 'ADMIN' && userId) {
      const emailLower = userEmail?.toLowerCase();
      const beforeFilterCount = allCases.length;

      allCases = allCases.filter(c => {
        const isOwner = c.ownerId === userId;
        const isAssignedByUid = c.assignedUserIds?.includes(userId);
        const isAssignedByEmail = emailLower && c.assignedUserEmails?.includes(emailLower);

        console.log(`   Case ${c.id} (${c.title}):`);
        console.log(`      ownerId: ${c.ownerId} (match: ${isOwner})`);
        console.log(`      assignedUserIds: ${JSON.stringify(c.assignedUserIds)} (match: ${isAssignedByUid})`);
        console.log(`      assignedUserEmails: ${JSON.stringify(c.assignedUserEmails)} (match: ${isAssignedByEmail})`);

        return isOwner || isAssignedByUid || isAssignedByEmail;
      });

      console.log(`   Filtered: ${beforeFilterCount} → ${allCases.length} cases visible to user`);
    }

    callback(allCases);
  }, (error) => {
    console.error("❌ Error subscribing to cases:", error);
    console.error("   Error code:", error.code);
    console.error("   Error message:", error.message);
  });
};

export const subscribeToAnnotations = (caseId: string, callback: (anns: Annotation[]) => void) => {
  if (isDemoMode) {
    // ... (demo implementation unused in this context)
    const filterAndNotify = () => {
      const filtered = mockStore.annotations.filter(a => a.caseId === caseId);
      callback([...filtered]);
    };
    filterAndNotify();
    const listener = () => filterAndNotify();
    listeners.annotations.push(listener);
    return () => {
      listeners.annotations = listeners.annotations.filter(l => l !== listener);
    };
  }

  const q = query(collection(db, COLL_ANNOTATIONS), where("caseId", "==", caseId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Annotation)));
  }, (error) => {
    console.error("❌ Error subscribing to annotations:", error);
  });
};

export const subscribeToDocuments = (caseId: string, callback: (docs: Document[]) => void) => {
  if (isDemoMode) {
    // ... (demo implementation redundant)
    const filterAndNotify = () => {
      const filtered = mockStore.documents.filter(d => d.caseId === caseId);
      callback([...filtered]);
    };
    filterAndNotify();
    const listener = () => filterAndNotify();
    listeners.documents.push(listener);
    return () => {
      listeners.documents = listeners.documents.filter(l => l !== listener);
    };
  }

  const q = query(collection(db, COLL_DOCUMENTS), where("caseId", "==", caseId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Document)));
  }, (error) => {
    console.error("❌ Error subscribing to documents:", error);
  });
};

export const subscribeToUsers = (callback: (users: AuthorizedUser[]) => void) => {
  if (isDemoMode) {
    callback([...mockStore.users]);
    const listener = (allUsers: AuthorizedUser[]) => callback(allUsers);
    listeners.users.push(listener);
    return () => {
      listeners.users = listeners.users.filter(l => l !== listener);
    };
  }
  return onSnapshot(collection(db, COLL_USERS), (snapshot) => {
    callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as AuthorizedUser)));
  }, (error) => {
    console.error("❌ Error subscribing to users:", error);
  });
};

// --- Operations ---

// ... (upsert/delete functions remain same)

/**
 * Ensures that support@apexmedlaw.com exists as an ADMIN user
 * Call this on app initialization
 */
export const ensureAdminUser = async (currentUserEmail: string, uid: string) => {
  console.log('🔍 ensureAdminUser called with email:', currentUserEmail, 'UID:', uid);

  if (isDemoMode) return;

  const adminEmail = 'support@apexmedlaw.com';

  // Only proceed if the current user is the support account
  if (currentUserEmail.toLowerCase() !== adminEmail.toLowerCase()) return;

  console.log('✅ Support account detected - proceeding with admin sync');

  try {
    const usersRef = collection(db, COLL_USERS);

    // 1. Check for ANY existing records for this email (Manual entry, legacy ID, etc.)
    const q = query(usersRef, where('email', '==', adminEmail));
    const snapshot = await getDocs(q);

    let targetDocExists = false;

    // Process existing docs
    for (const d of snapshot.docs) {
      if (d.id === uid) {
        targetDocExists = true;

        // Ensure role is ADMIN
        if (d.data().role !== 'ADMIN') {
          await setDoc(doc(db, COLL_USERS, uid), { role: 'ADMIN' }, { merge: true });
        }
      } else {
        // Found a duplicate or legacy ID (e.g. 'support-admin' or 'auto-generated-id')
        // Since we are the super admin, we should consolidate this.
        // If data is valuable, copy it.
        console.log(`⚠️ Cleaning up legacy/duplicate admin doc: ${d.id}`);
        const data = d.data();
        await deleteDoc(doc(db, COLL_USERS, d.id));

        // If the UID doc didn't exist, use this data to create it
        if (!targetDocExists) {
          await setDoc(doc(db, COLL_USERS, uid), { ...data, id: uid, role: 'ADMIN' }, { merge: true });
          targetDocExists = true;
        }
      }
    }

    // 2. If no doc exists at all after cleanup, create it fresh
    if (!targetDocExists) {
      const adminUser: AuthorizedUser = {
        id: uid,
        email: adminEmail,
        name: 'Support Admin',
        role: 'ADMIN',
        status: 'active',
        addedAt: new Date().toISOString(),
        avatarColor: 'bg-purple-600'
      };
      console.log('💾 Creating fresh admin document with ID:', uid);
      await setDoc(doc(db, COLL_USERS, uid), cleanData(adminUser), { merge: true });
    }

    console.log('✅ Admin user sync complete!');
  } catch (error) {
    console.error('❌ Error ensuring admin user:', error);
  }
};

// --- User Profile (qualifications, bio) ---
const demoProfiles: Record<string, { name?: string; qualifications?: string; bio?: string }> = {};

export const getProfile = async (userId: string): Promise<{ name?: string; qualifications?: string; bio?: string }> => {
  if (isDemoMode) {
    return demoProfiles[userId] ?? {};
  }
  try {
    const snap = await getDoc(doc(db, COLL_PROFILES, userId));
    return (snap.data() as any) ?? {};
  } catch {
    return {};
  }
};

export const upsertProfile = async (
  userId: string,
  data: { name?: string; qualifications?: string; bio?: string }
): Promise<void> => {
  if (isDemoMode) {
    demoProfiles[userId] = { ...(demoProfiles[userId] ?? {}), ...data };
    return;
  }
  await setDoc(doc(db, COLL_PROFILES, userId), cleanData(data), { merge: true });
};

// --- Operations ---

export const upsertCase = async (caseItem: Case) => {
  // Auto-stamp lastActivityAt on every case write
  const stamped = { ...caseItem, lastActivityAt: new Date().toISOString() };
  if (isDemoMode) {
    const index = mockStore.cases.findIndex(c => c.id === stamped.id);
    if (index >= 0) {
      mockStore.cases[index] = { ...mockStore.cases[index], ...stamped };
    } else {
      mockStore.cases.push(stamped);
    }
    listeners.cases.forEach(l => l([...mockStore.cases]));
    return;
  }

  try {
    
    const cleanedData = cleanData(stamped);
    
    await setDoc(doc(db, COLL_CASES, stamped.id), cleanedData, { merge: true });
  } catch (error) {
    console.error('❌ Error writing case to Firestore:', error);
    throw error;
  }
};

/** Touch the lastActivityAt timestamp on a case (used after doc/annotation changes) */
const touchCaseActivity = async (caseId: string) => {
  if (isDemoMode) {
    const c = mockStore.cases.find(x => x.id === caseId);
    if (c) { c.lastActivityAt = new Date().toISOString(); listeners.cases.forEach(l => l([...mockStore.cases])); }
    return;
  }
  try {
    await setDoc(doc(db, COLL_CASES, caseId), { lastActivityAt: new Date().toISOString() }, { merge: true });
  } catch { /* non-critical */ }
};

export const deleteCaseFromStore = async (caseId: string) => {
  if (isDemoMode) {
    mockStore.cases = mockStore.cases.filter(c => c.id !== caseId);
    listeners.cases.forEach(l => l([...mockStore.cases]));
    return;
  }

  console.log('🗑️ Cascade deleting case and all related data:', caseId);

  try {
    // Fetch all related data in parallel
    const [docsSnapshot, annsSnapshot] = await Promise.all([
      getDocs(query(collection(db, COLL_DOCUMENTS), where("caseId", "==", caseId))),
      getDocs(query(collection(db, COLL_ANNOTATIONS), where("caseId", "==", caseId)))
    ]);

    console.log('   📄 Deleting', docsSnapshot.size, 'documents...');
    console.log('   📝 Deleting', annsSnapshot.size, 'annotations...');

    // Delete all in parallel for maximum performance
    await Promise.all([
      // Delete all documents
      ...docsSnapshot.docs.map(docSnap => deleteDocumentFromStore(docSnap.id)),
      // Delete all annotations
      ...annsSnapshot.docs.map(annSnap => deleteDoc(doc(db, COLL_ANNOTATIONS, annSnap.id))),
      // Delete the case document itself
      deleteDoc(doc(db, COLL_CASES, caseId))
    ]);

    console.log('✅ Successfully deleted case and all related data');
  } catch (error) {
    console.error('❌ Error during cascade delete:', error);
    throw error;
  }
};

export const upsertDocument = async (document: Document) => {
  if (isDemoMode) {
    const index = mockStore.documents.findIndex(d => d.id === document.id);
    if (index >= 0) {
      mockStore.documents[index] = { ...mockStore.documents[index], ...document };
    } else {
      mockStore.documents.push(document);
    }
    listeners.documents.forEach(l => l());
    touchCaseActivity(document.caseId);
    return;
  }
  
  await setDoc(doc(db, COLL_DOCUMENTS, document.id), cleanData(document), { merge: true });
  touchCaseActivity(document.caseId);
};

export const deleteDocumentFromStore = async (docId: string) => {
  if (isDemoMode) {
    mockStore.documents = mockStore.documents.filter(d => d.id !== docId);
    listeners.documents.forEach(l => l());
    return;
  }
  // First, attempt to delete the associated storage object (if present)
  try {
    const docRef = doc(db, COLL_DOCUMENTS, docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const docData = snap.data() as Document;
      if (docData && (docData as any).storagePath) {
        // deleteFile removes the object from Firebase Storage
        try {
          await deleteFile((docData as any).storagePath);
        } catch (storageErr) {
          console.warn('Failed to delete storage object for document', docId, storageErr);
          // proceed to delete metadata anyway
        }
      }
    }
  } catch (err) {
    console.warn('Error while attempting to remove storage object for document', docId, err);
  }

  await deleteDoc(doc(db, COLL_DOCUMENTS, docId));
};

export const upsertAnnotation = async (ann: Annotation) => {
  if (isDemoMode) {
    const index = mockStore.annotations.findIndex(a => a.id === ann.id);
    if (index >= 0) {
      mockStore.annotations[index] = { ...mockStore.annotations[index], ...ann };
    } else {
      mockStore.annotations.push(ann);
    }
    listeners.annotations.forEach(l => l());
    touchCaseActivity(ann.caseId);
    return;
  }
  
  await setDoc(doc(db, COLL_ANNOTATIONS, ann.id), cleanData(ann), { merge: true });
  touchCaseActivity(ann.caseId);
};

export const deleteAnnotationFromStore = async (annId: string) => {
  if (isDemoMode) {
    mockStore.annotations = mockStore.annotations.filter(a => a.id !== annId);
    listeners.annotations.forEach(l => l());
    return;
  }
  await deleteDoc(doc(db, COLL_ANNOTATIONS, annId));
};

export const upsertUser = async (user: Partial<AuthorizedUser>) => {
  if (isDemoMode) {
    const index = mockStore.users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      mockStore.users[index] = { ...mockStore.users[index], ...user as AuthorizedUser };
    } else {
      mockStore.users.push(user as AuthorizedUser);
    }
    listeners.users.forEach(l => l([...mockStore.users]));
    return;
  }
  if (!user.id) return;
  await setDoc(doc(db, COLL_USERS, user.id), cleanData(user), { merge: true });
};

export const deleteUserFromStore = async (userId: string) => {
  if (isDemoMode) {
    mockStore.users = mockStore.users.filter(u => u.id !== userId);
    listeners.users.forEach(l => l([...mockStore.users]));
    return;
  }
  await deleteDoc(doc(db, COLL_USERS, userId));
};

/**
 * Reassign all cases owned by one user to another user
 */
export const reassignUserCases = async (fromUserId: string, toUserId: string, toUserName: string) => {
  if (isDemoMode) {
    mockStore.cases = mockStore.cases.map(c => {
      if (c.ownerId === fromUserId) {
        return { ...c, ownerId: toUserId, ownerName: toUserName };
      }
      // Also remove from assignedUserIds and add the new user
      if (c.assignedUserIds?.includes(fromUserId)) {
        const filtered = c.assignedUserIds.filter(id => id !== fromUserId);
        if (!filtered.includes(toUserId)) filtered.push(toUserId);
        return { ...c, assignedUserIds: filtered };
      }
      return c;
    });
    listeners.cases.forEach(l => l([...mockStore.cases]));
    return;
  }

  const casesSnapshot = await getDocs(collection(db, COLL_CASES));
  const updates: Promise<void>[] = [];

  for (const caseDoc of casesSnapshot.docs) {
    const caseData = caseDoc.data() as Case;
    const patch: Record<string, any> = {};

    if (caseData.ownerId === fromUserId) {
      patch.ownerId = toUserId;
      patch.ownerName = toUserName;
    }

    if (caseData.assignedUserIds?.includes(fromUserId)) {
      const filtered = caseData.assignedUserIds.filter(id => id !== fromUserId);
      if (!filtered.includes(toUserId)) filtered.push(toUserId);
      patch.assignedUserIds = filtered;
    }

    if (Object.keys(patch).length > 0) {
      updates.push(setDoc(doc(db, COLL_CASES, caseDoc.id), patch, { merge: true }));
    }
  }

  await Promise.all(updates);
};

/**
 * Delete all cases owned by a user (cascade delete with docs/annotations)
 */
export const deleteUserCases = async (userId: string) => {
  if (isDemoMode) {
    const caseIds = mockStore.cases.filter(c => c.ownerId === userId).map(c => c.id);
    mockStore.cases = mockStore.cases.filter(c => c.ownerId !== userId);
    mockStore.documents = mockStore.documents.filter(d => !caseIds.includes(d.caseId));
    mockStore.annotations = mockStore.annotations.filter(a => !caseIds.includes(a.caseId));
    listeners.cases.forEach(l => l([...mockStore.cases]));
    return;
  }

  const casesSnapshot = await getDocs(collection(db, COLL_CASES));
  const userCaseIds = casesSnapshot.docs
    .filter(d => (d.data() as Case).ownerId === userId)
    .map(d => d.id);

  for (const caseId of userCaseIds) {
    await deleteCaseFromStore(caseId);
  }
};


