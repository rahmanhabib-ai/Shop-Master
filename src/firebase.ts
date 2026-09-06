import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
  doc, 
  getDoc as realGetDoc, 
  getDocs as realGetDocs, 
  setDoc as realSetDoc, 
  addDoc as realAddDoc, 
  updateDoc as realUpdateDoc, 
  deleteDoc as realDeleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot as realOnSnapshot, 
  getDocFromServer, 
  increment, 
  serverTimestamp, 
  writeBatch as realWriteBatch, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  memoryLocalCache,
  disableNetwork,
  enableNetwork,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence Firestore internal logging to prevent console log clutter when quota is exceeded
try {
  setLogLevel('silent');
} catch (e) {
  console.warn('[Quota Intercept] Failed to silence Firestore logger:', e);
}

// Global quota tracker with daily auto-reset
const getInitialQuotaState = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('firestore_quota_exceeded');
    if (!raw) return false;
    const quotaDate = localStorage.getItem('firestore_quota_date');
    const today = new Date().toISOString().slice(0, 10);
    // If quota was recorded on a previous day, auto-clear it so app reconnects to fresh quota
    if (quotaDate && quotaDate !== today) {
      localStorage.removeItem('firestore_quota_exceeded');
      localStorage.removeItem('firestore_quota_date');
      return false;
    }
    return raw === 'true';
  } catch (e) {
    return false;
  }
};

export let isQuotaExceeded = getInitialQuotaState();

export const resetQuotaExceeded = async () => {
  isQuotaExceeded = false;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('firestore_quota_exceeded');
      localStorage.removeItem('firestore_quota_date');
      if (db) {
        await enableNetwork(db).catch(() => {});
      }
    } catch (e) {}
  }
};

export const clearAllLocalStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      const keysToKeep = ['theme_dark'];
      const temp: Record<string, string> = {};
      for (const key of keysToKeep) {
        const val = localStorage.getItem(key);
        if (val !== null) temp[key] = val;
      }
      localStorage.clear();
      for (const key of keysToKeep) {
        if (temp[key] !== undefined) {
          localStorage.setItem(key, temp[key]);
        }
      }
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  }
};

const markQuotaExceeded = () => {
  if (!isQuotaExceeded) {
    isQuotaExceeded = true;
    if (typeof window !== 'undefined') {
      try {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem('firestore_quota_exceeded', 'true');
        localStorage.setItem('firestore_quota_date', today);
        window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
        if (db) {
          disableNetwork(db).catch(() => {});
        }
      } catch (e) {}
    }
  }
};

// Safe wrapper for setDoc
export const setDoc = async (docRef: any, data: any, options?: any): Promise<any> => {
  const handleLocalSet = () => {
    try {
      const key = `local_firestore_fallback_${docRef.path}`;
      localStorage.setItem(key, JSON.stringify({ ...(data as any), _local_fallback: true, updatedAt: Date.now() }));
    } catch (e) {
      console.error('[Quota Intercept] Failed to write fallback to localStorage', e);
    }
  };

  if (isQuotaExceeded) {
    if (typeof window !== 'undefined') {
      handleLocalSet();
    }
    return Promise.resolve();
  }

  try {
    return await realSetDoc(docRef, data, options);
  } catch (error: any) {
    const errorMsg = error?.message || '';
    if (error?.code === 'resource-exhausted' || errorMsg.includes('resource-exhausted') || errorMsg.includes('quota') || errorMsg.includes('Quota')) {
      console.warn('[Quota Intercept] setDoc failed due to quota exhaustion. Falling back to local mode.', error);
      markQuotaExceeded();
      if (typeof window !== 'undefined') {
        handleLocalSet();
      }
      return Promise.resolve();
    }
    throw error;
  }
};

// Safe wrapper for addDoc
export const addDoc = async (collectionRef: any, data: any): Promise<any> => {
  const handleLocalAdd = () => {
    const mockId = 'mock_id_' + Math.random().toString(36).substring(2, 15);
    const docPath = `${collectionRef.path}/${mockId}`;
    const key = `local_firestore_fallback_${docPath}`;
    try {
      localStorage.setItem(key, JSON.stringify({ ...(data as any), id: mockId, _local_fallback: true, createdAt: Date.now() }));
      
      const collKey = `local_collection_fallback_${collectionRef.path}`;
      const existingListStr = localStorage.getItem(collKey) || '[]';
      const list = JSON.parse(existingListStr);
      list.push(mockId);
      localStorage.setItem(collKey, JSON.stringify(list));
    } catch (e) {
      console.error('[Quota Intercept] Failed to write collection fallback to localStorage', e);
    }
    return {
      id: mockId,
      path: docPath,
      parent: collectionRef,
      withConverter: () => ({})
    };
  };

  if (isQuotaExceeded) {
    if (typeof window !== 'undefined') {
      return Promise.resolve(handleLocalAdd()) as any;
    }
    return Promise.resolve({ id: 'mock_quota_id' }) as any;
  }

  try {
    return await realAddDoc(collectionRef, data);
  } catch (error: any) {
    const errorMsg = error?.message || '';
    if (error?.code === 'resource-exhausted' || errorMsg.includes('resource-exhausted') || errorMsg.includes('quota') || errorMsg.includes('Quota')) {
      console.warn('[Quota Intercept] addDoc failed due to quota exhaustion. Falling back to local mode.', error);
      markQuotaExceeded();
      if (typeof window !== 'undefined') {
        return Promise.resolve(handleLocalAdd()) as any;
      }
      return Promise.resolve({ id: 'mock_quota_id' }) as any;
    }
    throw error;
  }
};

// Safe wrapper for updateDoc
export const updateDoc = async (docRef: any, data: any): Promise<any> => {
  const handleLocalUpdate = () => {
    try {
      const key = `local_firestore_fallback_${docRef.path}`;
      const existing = localStorage.getItem(key);
      let merged = { ...(data as any) };
      if (existing) {
        try {
          merged = { ...JSON.parse(existing), ...(data as any) };
        } catch (parseErr) {
          merged = { ...(data as any) };
        }
      }
      localStorage.setItem(key, JSON.stringify({ ...merged, _local_fallback: true, updatedAt: Date.now() }));
    } catch (e) {
      console.error('[Quota Intercept] Failed to update fallback in localStorage', e);
    }
  };

  if (isQuotaExceeded) {
    if (typeof window !== 'undefined') {
      handleLocalUpdate();
    }
    return Promise.resolve();
  }

  try {
    return await realUpdateDoc(docRef, data);
  } catch (error: any) {
    const errorMsg = error?.message || '';
    if (error?.code === 'resource-exhausted' || errorMsg.includes('resource-exhausted') || errorMsg.includes('quota') || errorMsg.includes('Quota')) {
      console.warn('[Quota Intercept] updateDoc failed due to quota exhaustion. Falling back to local mode.', error);
      markQuotaExceeded();
      if (typeof window !== 'undefined') {
        handleLocalUpdate();
      }
      return Promise.resolve();
    }
    throw error;
  }
};

// Safe wrapper for deleteDoc
export const deleteDoc = async (docRef: any): Promise<any> => {
  const handleLocalDelete = () => {
    try {
      const key = `local_firestore_fallback_${docRef.path}`;
      localStorage.removeItem(key);
      
      const parentPath = docRef.parent?.path || '';
      if (parentPath) {
        const collKey = `local_collection_fallback_${parentPath}`;
        const existingListStr = localStorage.getItem(collKey);
        if (existingListStr) {
          const list = JSON.parse(existingListStr);
          const filtered = list.filter((id: string) => id !== docRef.id);
          localStorage.setItem(collKey, JSON.stringify(filtered));
        }
      }
    } catch (e) {
      console.error('[Quota Intercept] Failed to delete fallback from localStorage', e);
    }
  };

  if (isQuotaExceeded) {
    if (typeof window !== 'undefined') {
      handleLocalDelete();
    }
    return Promise.resolve();
  }

  try {
    return await realDeleteDoc(docRef);
  } catch (error: any) {
    const errorMsg = error?.message || '';
    if (error?.code === 'resource-exhausted' || errorMsg.includes('resource-exhausted') || errorMsg.includes('quota') || errorMsg.includes('Quota')) {
      console.warn('[Quota Intercept] deleteDoc failed due to quota exhaustion. Falling back to local mode.', error);
      markQuotaExceeded();
      if (typeof window !== 'undefined') {
        handleLocalDelete();
      }
      return Promise.resolve();
    }
    throw error;
  }
};

// Safe wrapper for getDoc
export const getDoc = async (docRef: any): Promise<any> => {
  const key = `local_firestore_fallback_${docRef.path}`;
  const handleLocalGet = () => {
    const localData = localStorage.getItem(key);
    if (localData) {
      console.log(`[Quota Intercept] getDoc fallback loaded for path ${docRef.path}`);
      const parsed = JSON.parse(localData);
      return {
        exists: () => true,
        data: () => parsed,
        id: docRef.id,
        ref: docRef,
        get: (field: string) => parsed[field]
      };
    }
    return {
      exists: () => false,
      data: () => undefined,
      id: docRef.id,
      ref: docRef,
      get: () => undefined
    };
  };

  if (isQuotaExceeded) {
    if (typeof window !== 'undefined') {
      return Promise.resolve(handleLocalGet()) as any;
    }
  }

  try {
    return await realGetDoc(docRef);
  } catch (error: any) {
    const errorMsg = error?.message || '';
    if (error?.code === 'resource-exhausted' || errorMsg.includes('resource-exhausted') || errorMsg.includes('quota') || errorMsg.includes('Quota')) {
      markQuotaExceeded();
      if (typeof window !== 'undefined') {
        return Promise.resolve(handleLocalGet()) as any;
      }
    }
    throw error;
  }
};

// Safe wrapper for getDocs
export const getDocs = async (queryRef: any): Promise<any> => {
  const handleLocalGetDocs = () => {
    const path = (queryRef as any).path || ((queryRef as any)._query?.path?.segments?.join('/')) || '';
    if (path) {
      const collKey = `local_collection_fallback_${path}`;
      const listStr = localStorage.getItem(collKey);
      if (listStr) {
        const list = JSON.parse(listStr);
        const docsList = list.map((id: string) => {
          const itemKey = `local_firestore_fallback_${path}/${id}`;
          const itemData = localStorage.getItem(itemKey);
          const dataObj = itemData ? JSON.parse(itemData) : {};
          return {
            id,
            exists: () => true,
            data: () => dataObj,
            get: (field: string) => dataObj[field]
          };
        });
        return {
          docs: docsList,
          empty: docsList.length === 0,
          size: docsList.length,
          forEach: (callback: any) => docsList.forEach(callback)
        };
      }
    }
    return {
      docs: [],
      empty: true,
      size: 0,
      forEach: () => {}
    };
  };

  if (isQuotaExceeded) {
    if (typeof window !== 'undefined') {
      return Promise.resolve(handleLocalGetDocs()) as any;
    }
  }

  try {
    return await realGetDocs(queryRef);
  } catch (error: any) {
    const errorMsg = error?.message || '';
    if (error?.code === 'resource-exhausted' || errorMsg.includes('resource-exhausted') || errorMsg.includes('quota') || errorMsg.includes('Quota')) {
      markQuotaExceeded();
      if (typeof window !== 'undefined') {
        return Promise.resolve(handleLocalGetDocs()) as any;
      }
      return {
        docs: [],
        empty: true,
        size: 0,
        forEach: () => {}
      } as any;
    }
    throw error;
  }
};

// Safe wrapper for onSnapshot
export const onSnapshot = (queryRef: any, ...args: any[]): () => void => {
  let onNext = args[0];
  let onError = args[1];
  let onCompletion = args[2];
  
  if (typeof onNext === 'object' && onNext !== null) {
    onNext = args[0].next;
    onError = args[0].error;
    onCompletion = args[0].complete;
  }

  const safeOnNext = (snapshot: any) => {
    try {
      if (onNext) onNext(snapshot);
    } catch (e) {
      console.error('[Quota Intercept] onSnapshot callback error:', e);
    }
  };
  
  const safeOnError = (error: any) => {
    const errorMsg = error?.message || '';
    if (error?.code === 'resource-exhausted' || errorMsg.includes('resource-exhausted') || errorMsg.includes('quota') || errorMsg.includes('Quota')) {
      markQuotaExceeded();
      console.warn('[Quota Intercept] onSnapshot error handled gracefully:', errorMsg);
      
      // Attempt local mock snapshot emission
      const path = (queryRef as any).path || ((queryRef as any)._query?.path?.segments?.join('/')) || '';
      if (path && typeof window !== 'undefined') {
        const collKey = `local_collection_fallback_${path}`;
        const listStr = localStorage.getItem(collKey);
        if (listStr) {
          try {
            const list = JSON.parse(listStr);
            const docsList = list.map((id: string) => {
              const itemKey = `local_firestore_fallback_${path}/${id}`;
              const itemData = localStorage.getItem(itemKey);
              const dataObj = itemData ? JSON.parse(itemData) : {};
              return {
                id,
                exists: () => true,
                data: () => dataObj,
                get: (field: string) => dataObj[field]
              };
            });
            safeOnNext({
              docs: docsList,
              empty: docsList.length === 0,
              size: docsList.length,
              forEach: (callback: any) => docsList.forEach(callback)
            });
          } catch (snapshotErr) {
            console.error('[Quota Intercept] Failed to emit mock snapshot:', snapshotErr);
          }
        }
      }

      if (onError) {
        try {
          onError(error);
        } catch (callbackErr) {
          // Ignore
        }
      }
    } else {
      if (onError) {
        try {
          onError(error);
        } catch (callbackErr) {}
      }
    }
  };

  // If already marked as quota exceeded, emit immediately and do not listen to Firestore
  if (isQuotaExceeded) {
    const path = (queryRef as any).path || ((queryRef as any)._query?.path?.segments?.join('/')) || '';
    if (path && typeof window !== 'undefined') {
      setTimeout(() => {
        const collKey = `local_collection_fallback_${path}`;
        const listStr = localStorage.getItem(collKey);
        if (listStr) {
          try {
            const list = JSON.parse(listStr);
            const docsList = list.map((id: string) => {
              const itemKey = `local_firestore_fallback_${path}/${id}`;
              const itemData = localStorage.getItem(itemKey);
              const dataObj = itemData ? JSON.parse(itemData) : {};
              return {
                id,
                exists: () => true,
                data: () => dataObj,
                get: (field: string) => dataObj[field]
              };
            });
            safeOnNext({
              docs: docsList,
              empty: docsList.length === 0,
              size: docsList.length,
              forEach: (callback: any) => docsList.forEach(callback)
            });
          } catch (snapshotErr) {
            console.error('[Quota Intercept] Failed to emit pre-check mock snapshot:', snapshotErr);
          }
        }
      }, 50);
    }
    return () => {};
  }

  try {
    return realOnSnapshot(queryRef, safeOnNext, safeOnError, onCompletion);
  } catch (err: any) {
    console.error('[Quota Intercept] onSnapshot initialization failed:', err);
    return () => {};
  }
};

// Safe wrapper for writeBatch
export const writeBatch = (dbInstance: any) => {
  const realBatch = realWriteBatch(dbInstance);
  const pendingOperations: Array<() => void> = [];
  
  return {
    set(docRef: any, data: any, options?: any) {
      pendingOperations.push(() => {
        const key = `local_firestore_fallback_${docRef.path}`;
        localStorage.setItem(key, JSON.stringify({ ...(data as any), _local_fallback: true, updatedAt: Date.now() }));
      });
      if (!isQuotaExceeded) {
        try {
          realBatch.set(docRef, data, options);
        } catch (e) {}
      }
      return this;
    },
    update(docRef: any, data: any) {
      pendingOperations.push(() => {
        const key = `local_firestore_fallback_${docRef.path}`;
        const existing = localStorage.getItem(key);
        let merged = { ...(data as any) };
        if (existing) {
          try {
            merged = { ...JSON.parse(existing), ...(data as any) };
          } catch (e) {
            merged = { ...(data as any) };
          }
        }
        localStorage.setItem(key, JSON.stringify({ ...merged, _local_fallback: true, updatedAt: Date.now() }));
      });
      if (!isQuotaExceeded) {
        try {
          realBatch.update(docRef, data);
        } catch (e) {}
      }
      return this;
    },
    delete(docRef: any) {
      pendingOperations.push(() => {
        const key = `local_firestore_fallback_${docRef.path}`;
        localStorage.removeItem(key);
      });
      if (!isQuotaExceeded) {
        try {
          realBatch.delete(docRef);
        } catch (e) {}
      }
      return this;
    },
    async commit() {
      if (isQuotaExceeded) {
        if (typeof window !== 'undefined') {
          for (const op of pendingOperations) {
            try {
              op();
            } catch (e) {}
          }
        }
        return Promise.resolve();
      }
      try {
        return await realBatch.commit();
      } catch (error: any) {
        const errorMsg = error?.message || '';
        if (error?.code === 'resource-exhausted' || errorMsg.includes('resource-exhausted') || errorMsg.includes('quota') || errorMsg.includes('Quota')) {
          console.warn('[Quota Intercept] writeBatch commit failed due to quota exhaustion. Running operations locally.', error);
          markQuotaExceeded();
          if (typeof window !== 'undefined') {
            for (const op of pendingOperations) {
              try {
                op();
              } catch (e) {
                console.error('[Quota Intercept] Failed running batch fallback op:', e);
              }
            }
          }
          return Promise.resolve() as any;
        }
        throw error;
      }
    }
  };
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);

// Detect environment to choose safe local cache
const determineLocalCache = () => {
  try {
    if (typeof window === 'undefined') {
      return memoryLocalCache();
    }

    // Check if we previously marked IndexedDB as corrupted or closing
    if (localStorage.getItem('use_memory_cache') === 'true') {
      console.warn("Firestore: Utilizing memory cache due to previous IndexedDB connection closing/failure state.");
      
      // Asynchronously attempt to clean up and delete databases to heal on subsequent reloads
      setTimeout(() => {
        if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
          window.indexedDB.databases().then((dbs) => {
            dbs.forEach((dbInfo) => {
              if (dbInfo.name && dbInfo.name.includes('firestore')) {
                console.log("Cleaning up corrupted Firestore IndexedDB database:", dbInfo.name);
                window.indexedDB.deleteDatabase(dbInfo.name);
              }
            });
            localStorage.removeItem('use_memory_cache');
          }).catch(() => {
            try {
              window.indexedDB.deleteDatabase('firestore/[DEFAULT]/ShopMaster/main');
              window.indexedDB.deleteDatabase('firestore/[DEFAULT]/react-example/main');
              localStorage.removeItem('use_memory_cache');
            } catch (e) {}
          });
        } else {
          try {
            window.indexedDB.deleteDatabase('firestore/[DEFAULT]/ShopMaster/main');
            window.indexedDB.deleteDatabase('firestore/[DEFAULT]/react-example/main');
            localStorage.removeItem('use_memory_cache');
          } catch (e) {}
        }
      }, 2000);

      return memoryLocalCache();
    }

    // Sandboxed preview iframes block IndexedDB, which locks Firestore. Fallback to memory local cache.
    if (window.self !== window.top) {
      console.log("Firestore detected sandboxed iframe environment. Defensively utilizing memory cache to prevent sandboxed security-context query locks.");
      return memoryLocalCache();
    }
    if (!window.indexedDB) {
      console.log("Firestore detected missing or blocked IndexedDB. Utilizing memory cache.");
      return memoryLocalCache();
    }
    console.log("Firestore utilizing persistent local cache with multi-tab manager.");
    return persistentLocalCache({ tabManager: persistentMultipleTabManager() });
  } catch (err) {
    console.warn("Firestore was unable to set up persistent cache, fallback to memory cache:", err);
    return memoryLocalCache();
  }
};

// Global handlers to listen for IndexedDB database connection closing errors and gracefully heal them on reload
if (typeof window !== 'undefined') {
  const handleIDBError = (errorMsg: string) => {
    if (
      errorMsg.includes('IDBDatabase') || 
      errorMsg.includes('database connection is closing') || 
      errorMsg.includes('Failed to execute \'transaction\'') ||
      errorMsg.includes('The database connection is closing')
    ) {
      try {
        localStorage.setItem('use_memory_cache', 'true');
        console.warn("[IndexedDB Interceptor] Captured fatal IndexedDB closing error. Enabled memory cache for next boot.", errorMsg);
      } catch (e) {}
    }
  };

  window.addEventListener('error', (event) => {
    handleIDBError(event?.message || '');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason?.message || String(reason || '');
    handleIDBError(msg);
  });
}

// Initialize Firestore with smart adaptive cache
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: determineLocalCache()
}, (firebaseConfig as any).firestoreDatabaseId);

if (isQuotaExceeded) {
  console.log("Firestore quota was previously exceeded, disabling network immediately to prevent any quota errors.");
  disableNetwork(db).catch(() => {});
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Request offline access to try and maintain long-term token availability
googleProvider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

// Add required Google Workspace scopes
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Calendar Scopes
googleProvider.addScope('https://www.googleapis.com/auth/calendar');

// Gmail Scopes
googleProvider.addScope('https://mail.google.com/');

// Meet Scopes
googleProvider.addScope('https://www.googleapis.com/auth/meetings.space.created');

// Tasks Scopes
googleProvider.addScope('https://www.googleapis.com/auth/tasks');

// Contacts & Profile Scopes
googleProvider.addScope('https://www.googleapis.com/auth/contacts');

let cachedAccessToken: string | null = null;
try {
  if (typeof window !== 'undefined') {
    cachedAccessToken = localStorage.getItem('google_cached_access_token');
  }
} catch (e) {
  console.warn("localStorage not accessible", e);
}

export const getCachedAccessToken = () => cachedAccessToken;
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('google_cached_access_token', token);
      } else {
        localStorage.removeItem('google_cached_access_token');
      }
    }
  } catch (e) {
    console.warn("localStorage write failed", e);
  }
};

// Error handling helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let userFriendlyMessage = "An unexpected database error occurred.";
  if (error instanceof Error) {
    const errorMsg = error.message.toLowerCase();
    if (errorMsg.includes('unavailable') || errorMsg.includes('network') || errorMsg.includes('offline') || (error as any).code === 'unavailable') {
      userFriendlyMessage = "Network error: The operation failed. Please check your internet connection and try again.";
    } else if (errorMsg.includes('permission-denied') || (error as any).code === 'permission-denied') {
      userFriendlyMessage = "Permission denied: You do not have access to perform this operation.";
    } else {
      userFriendlyMessage = `Error performing ${operationType}: ${error.message}`;
    }
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
      providerId: provider.providerId,
      displayName: provider.displayName,
      email: provider.email,
      photoUrl: provider.photoURL
    })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error:', userFriendlyMessage, JSON.stringify(errInfo));
  return userFriendlyMessage;
}

// Connection test
async function testConnection() {
  if (typeof window === 'undefined') return;
  try {
    // skip network check to avoid console warnings during development/offline mode
    // await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (errorMsg.includes('offline') || errorMsg.includes('unavailable') || errorMsg.includes('network')) {
      console.warn("Firestore connection test info: client is offline or service is temporarily unavailable (expected during server build/CI sandbox tests or when offline).");
      console.warn("Please check your Firebase configuration if this message persists in active browser usage.");
    } else {
      console.error("Firestore connection test failed:", error);
    }
  }
}
// testConnection();

export const deleteShopAllData = async (shopId: string) => {
  if (!shopId) return;
  const collectionsToClear = [
    'products', 'sales', 'customers', 'customer_orders', 'categories', 
    'users', 'employees', 'expenses', 'investments', 'staff_salaries', 
    'stockRecords', 'branches', 'recycleBin', 'customer_logs', 
    'due_payments', 'notes', 'warranty_records', 'daily_closings',
    'suppliers'
  ];

  const failures: string[] = [];

  for (const collName of collectionsToClear) {
    try {
      const q = query(collection(db, collName), where('shopId', '==', shopId));
      const snap = await getDocs(q);
      const batchPromises = snap.docs.map(docSnap => deleteDoc(doc(db, collName, docSnap.id)));
      await Promise.all(batchPromises);
    } catch (err) {
      console.error(`Error deleting shop records in collection: ${collName}`, err);
      failures.push(collName);
    }
  }

  // Also try clearing records in collections where the field might be nested or named slightly differently
  // E.g., user profiles or specific items
  try {
    const qSettings = doc(db, 'settings', shopId);
    await deleteDoc(qSettings);
  } catch (err) {
    console.error('Error deleting settings doc:', err);
    failures.push('settings doc');
  }

  try {
    const qShop = doc(db, 'shops', shopId);
    await deleteDoc(qShop);
  } catch (err) {
    console.error('Error deleting shop doc:', err);
    failures.push('shop doc');
  }

  if (failures.length > 0) {
    throw new Error(`Failed to delete some records from collection(s): ${failures.join(', ')}. Please check your admin privileges in firestore.rules.`);
  }
};

export { 
  collection, doc, 
  query, where, orderBy, limit, signInWithPopup, signOut, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, increment, serverTimestamp,
  GoogleAuthProvider
};
