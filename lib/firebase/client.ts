import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, browserSessionPersistence, connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, initializeFirestore, memoryLocalCache, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { AUTH_PERSISTENCE } from "@shared/native-shell";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const configKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"] as const;

function authPersistence(mode: "local" | "session" | "none") {
  if (mode === "session") return browserSessionPersistence;
  if (mode === "none") return inMemoryPersistence;
  return browserLocalPersistence;
}

export function firebaseConfigured(): boolean {
  return configKeys.every((key) => {
    const value = firebaseConfig[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function useEmulators(): boolean {
  return process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
}

type ClientServices = {
  app?: FirebaseApp;
  auth?: Auth;
  db?: Firestore;
  functions?: Functions;
  storage?: FirebaseStorage;
};

const services: ClientServices = ((globalThis as typeof globalThis & { __souspliFirebase?: ClientServices }).__souspliFirebase ??= {});

function app(): FirebaseApp {
  if (!firebaseConfigured()) throw new Error("La configuration Firebase du navigateur est incomplète.");
  services.app ??= getApps()[0] ?? initializeApp(firebaseConfig);
  return services.app;
}

export function getFirebaseAuth(): Auth {
  if (!services.auth) {
    services.auth = getAuth(app());
    void setPersistence(services.auth, authPersistence(AUTH_PERSISTENCE));
    if (useEmulators() && !services.auth.emulatorConfig) {
      connectAuthEmulator(services.auth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
  }
  return services.auth;
}

export function getDb(): Firestore {
  if (!services.db) {
    const firebaseApp = app();
    try {
      services.db = initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
    } catch {
      services.db = getFirestore(firebaseApp);
    }
    if (useEmulators()) connectFirestoreEmulator(services.db, "127.0.0.1", 8080);
  }
  return services.db;
}

export function getFns(): Functions {
  if (!services.functions) {
    services.functions = getFunctions(app(), "europe-west1");
    if (useEmulators()) connectFunctionsEmulator(services.functions, "127.0.0.1", 5001);
  }
  return services.functions;
}

export function getBucket(): FirebaseStorage {
  if (!services.storage) {
    services.storage = getStorage(app());
    if (useEmulators()) connectStorageEmulator(services.storage, "127.0.0.1", 9199);
  }
  return services.storage;
}
