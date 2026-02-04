
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  orderBy,
  getDocs
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { Case, Annotation, Document, AuthorizedUser, UserRole } from "../types";

const COLL_CASES = "cases";
const COLL_ANNOTATIONS = "annotations";
const COLL_DOCUMENTS = "documents";
const COLL_USERS = "users";

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

export const subscribeToCases = (callback: (cases: Case[]) => void, userId?: string, role?: UserRole) => {
  if (isDemoMode) {
    const filterFn = (c: Case) => {
      if (!userId || role === 'ADMIN') return true;
      return c.ownerId === userId || c.assignedUserIds?.includes(userId);
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
    let allCases = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Case));

    // Filter by user access if not an admin
    if (role !== 'ADMIN' && userId) {
      allCases = allCases.filter(c =>
        c.ownerId === userId ||
        c.assignedUserIds?.includes(userId)
      );
    }

    callback(allCases);
  });
};

export const subscribeToAnnotations = (caseId: string, callback: (anns: Annotation[]) => void) => {
  if (isDemoMode) {
    const filterAndNotify = () => {
      const filtered = mockStore.annotations.filter(a => a.caseId === caseId);
      callback([...filtered]);
    };

    filterAndNotify();

    const listener = () => filterAndNotify(); // Re-run filter on any update
    listeners.annotations.push(listener);

    return () => {
      listeners.annotations = listeners.annotations.filter(l => l !== listener);
    };
  }

  const q = query(collection(db, COLL_ANNOTATIONS), where("caseId", "==", caseId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Annotation)));
  });
};

export const subscribeToDocuments = (caseId: string, callback: (docs: Document[]) => void) => {
  if (isDemoMode) {
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
  });
};

// --- Operations ---

export const upsertCase = async (caseItem: Case) => {
  if (isDemoMode) {
    const index = mockStore.cases.findIndex(c => c.id === caseItem.id);
    if (index >= 0) {
      mockStore.cases[index] = { ...mockStore.cases[index], ...caseItem };
    } else {
      mockStore.cases.push(caseItem);
    }
    // Trigger updates
    listeners.cases.forEach(l => l([...mockStore.cases]));
    return;
  }
  await setDoc(doc(db, COLL_CASES, caseItem.id), cleanData(caseItem), { merge: true });
};

export const deleteCaseFromStore = async (caseId: string) => {
  if (isDemoMode) {
    mockStore.cases = mockStore.cases.filter(c => c.id !== caseId);
    listeners.cases.forEach(l => l([...mockStore.cases]));
    return;
  }
  await deleteDoc(doc(db, COLL_CASES, caseId));
};

export const upsertDocument = async (document: Document) => {
  if (isDemoMode) {
    const index = mockStore.documents.findIndex(d => d.id === document.id);
    if (index >= 0) {
      mockStore.documents[index] = { ...mockStore.documents[index], ...document };
    } else {
      mockStore.documents.push(document);
    }
    // Notify document listeners
    listeners.documents.forEach(l => l()); // Listeners re-filter themselves
    return;
  }
  await setDoc(doc(db, COLL_DOCUMENTS, document.id), cleanData(document), { merge: true });
};

export const deleteDocumentFromStore = async (docId: string) => {
  if (isDemoMode) {
    mockStore.documents = mockStore.documents.filter(d => d.id !== docId);
    listeners.documents.forEach(l => l());
    return;
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
    return;
  }
  await setDoc(doc(db, COLL_ANNOTATIONS, ann.id), cleanData(ann), { merge: true });
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
 * Ensures that support@apexmedlaw.com exists as an ADMIN user
 * Call this on app initialization
 */
export const ensureAdminUser = async (currentUserEmail: string) => {
  console.log('🔍 ensureAdminUser called with email:', currentUserEmail);

  if (isDemoMode) {
    console.log('⏭️ Skipping - Demo mode is active');
    return;
  }

  const adminEmail = 'support@apexmedlaw.com';

  // Only proceed if the current user is the support account
  if (currentUserEmail.toLowerCase() !== adminEmail.toLowerCase()) {
    console.log('⏭️ Skipping - Not the support account');
    return;
  }

  console.log('✅ Support account detected - proceeding with admin check');

  try {
    const usersRef = collection(db, COLL_USERS);
    console.log('📂 Querying users collection:', COLL_USERS);

    const q = query(usersRef, where('email', '==', adminEmail));
    const snapshot = await getDocs(q);

    console.log('📊 Query results - Empty:', snapshot.empty, 'Count:', snapshot.docs.length);

    if (snapshot.empty) {
      // Create the admin user
      console.log('📝 Creating new admin user:', adminEmail);
      const adminUser: AuthorizedUser = {
        id: 'support-admin',
        email: adminEmail,
        name: 'Support Admin',
        role: 'ADMIN',
        status: 'active',
        addedAt: new Date().toISOString(),
        avatarColor: 'bg-purple-600'
      };

      console.log('💾 Writing to Firestore:', adminUser);
      await setDoc(doc(db, COLL_USERS, 'support-admin'), cleanData(adminUser));
      console.log('✅ Admin user created successfully!');
      console.log('🔄 Please wait a moment for the role to sync...');
    } else {
      // User exists, ensure they have ADMIN role
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data() as AuthorizedUser;

      console.log('👤 Existing user found:', {
        id: userDoc.id,
        email: userData.email,
        role: userData.role,
        status: userData.status
      });

      if (userData.role !== 'ADMIN') {
        console.log('⬆️ Updating user to ADMIN role...');
        await setDoc(doc(db, COLL_USERS, userDoc.id), {
          ...userData,
          role: 'ADMIN',
          status: 'active'
        });
        console.log('✅ User role updated to ADMIN!');
        console.log('🔄 Please wait a moment for the role to sync...');
      } else {
        console.log('✅ User already has ADMIN role - no update needed');
      }
    }
  } catch (error) {
    console.error('❌ Error ensuring admin user:', error);
    console.error('📋 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
      stack: error instanceof Error ? error.stack : undefined
    });
  }
};
