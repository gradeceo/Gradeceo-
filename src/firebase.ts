import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
// @ts-ignore
import configJson from '../firebase-applet-config.json';

// Default dummy config
const dummyConfig = {
  apiKey: "DUMMY_KEY",
  authDomain: "DUMMY_DOMAIN",
  projectId: "DUMMY_PROJECT",
  storageBucket: "DUMMY_BUCKET",
  messagingSenderId: "DUMMY_SENDER",
  appId: "DUMMY_APP",
  firestoreDatabaseId: "(default)"
};

// Use the auto-generated config if it's valid
const firebaseConfig = (configJson && configJson.apiKey !== "DUMMY_KEY") 
  ? configJson 
  : dummyConfig;

// Initialize Firebase SDK
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use the database ID from the config directly. 
// If it's "(default)", getFirestore will handle it correctly.
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

console.log("Firebase Config:", firebaseConfig);
console.log("Firestore DB:", db);
export const googleProvider = new GoogleAuthProvider();

export const isFirebaseConfigured = firebaseConfig.apiKey !== "DUMMY_KEY";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const signInWithGoogle = () => {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured. Please click 'Set up Firebase' in the AI Studio UI.");
  }
  return signInWithPopup(auth, googleProvider);
};

// Validate Connection to Firestore
async function testConnection() {
  if (!isFirebaseConfigured) return;
  try {
    await getDoc(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();
