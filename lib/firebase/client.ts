import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, browserSessionPersistence, connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, initializeFirestore, memoryLocalCache, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { AUTH_PERSISTENCE } from "@shared/native-shell";

/** Projet de démonstration : sans ressource cloud, un oubli d'émulateur échoue au lieu d'écrire en production. */
const DEMO_PROJECT_ID = "demo-souspli";

const cloudConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const demoConfig = {
  apiKey: "demo-api-key",
  authDomain: "localhost",
  projectId: DEMO_PROJECT_ID,
  storageBucket: "demo-souspli.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:demo",
};

const configKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"] as const;

function authPersistence(mode: "local" | "session" | "none") {
  if (mode === "session") return browserSessionPersistence;
  if (mode === "none") return inMemoryPersistence;
  return browserLocalPersistence;
}

export function useEmulators(): boolean {
  return process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
}

export function firebaseConfigured(): boolean {
  if (useEmulators()) return true;
  return configKeys.every((key) => {
    const value = cloudConfig[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

/**
 * L'émulateur Android joint la machine hôte par 10.0.2.2.
 * Documentation Firebase : connect_auth, « If you are using an Android emulator, you need to use 10.0.2.2 ».
 */
export function emulatorHost(): string {
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("SousPliAndroid")) return "10.0.2.2";
  return "127.0.0.1";
}

type ClientServices = {
  app?: FirebaseApp;
  auth?: Auth;
  db?: Firestore;
  functions?: Functions;
  storage?: FirebaseStorage;
};

const services: ClientServices = ((globalThis as typeof globalThis & { __souspliFirebase?: ClientServices }).__souspliFirebase ??= {});
let emulatorsConnected = false;

function firebaseOptions() {
  return useEmulators() ? demoConfig : cloudConfig;
}

function app(): FirebaseApp {
  if (!firebaseConfigured()) throw new Error("La configuration Firebase du navigateur est incomplète.");
  if (!services.app) {
    const options = firebaseOptions();
    const existing = getApps()[0];
    if (existing && existing.options.projectId !== options.projectId) {
      throw new Error("Une application Firebase d'un autre projet est déjà ouverte. Aucune écriture n'est envoyée.");
    }
    services.app = existing ?? initializeApp(options);
  }
  return services.app;
}

function localEndpoint(value: string | null | undefined): boolean {
  return Boolean(value && /(^|\/\/)(127\.0\.0\.1|10\.0\.2\.2|localhost)(:\d+)?(\/|$)/.test(value));
}

export type BackendReport = {
  mode: "emulators" | "cloud";
  projectId: string;
  auth: string | null;
  firestore: string | null;
  functions: string | null;
  storage: string | null;
};

function readFirestoreHost(database: Firestore | undefined): string | null {
  if (!database) return null;
  const record = database as unknown as {
    _delegate?: { _settings?: { host?: string }; _getSettings?: () => { host?: string } };
    _settings?: { host?: string };
    _getSettings?: () => { host?: string };
  };
  return record._delegate?._settings?.host
    ?? record._delegate?._getSettings?.().host
    ?? record._settings?.host
    ?? record._getSettings?.().host
    ?? null;
}

function snapshot(): BackendReport {
  const database = services.db;
  const functions = services.functions;
  const bucket = services.storage;
  const functionsHost = functions?.customDomain
    ?? (functions as (Functions & { emulatorOrigin?: string | null }) | undefined)?.emulatorOrigin
    ?? null;
  const storageHost = (bucket as (FirebaseStorage & { host?: string }) | undefined)?.host ?? null;
  return {
    mode: useEmulators() ? "emulators" : "cloud",
    projectId: services.app?.options.projectId ?? "",
    auth: services.auth?.emulatorConfig ? `${services.auth.emulatorConfig.host}:${services.auth.emulatorConfig.port}` : null,
    firestore: readFirestoreHost(database),
    functions: functionsHost,
    storage: storageHost,
  };
}

function destinationsAreLocal(report: BackendReport): boolean {
  return report.mode === "emulators"
    && report.projectId === DEMO_PROJECT_ID
    && [report.auth, report.firestore, report.functions, report.storage].every((host) => localEndpoint(host));
}

export function readBackend(): BackendReport {
  ensureServices();
  return snapshot();
}

/** Refuse l'écriture si une destination n'est pas un émulateur local. */
export function assertEmulatorBackend(): BackendReport {
  const report = readBackend();
  if (!destinationsAreLocal(report)) {
    throw new Error("La destination n'est pas l'émulateur local. Aucune écriture n'est envoyée.");
  }
  return report;
}

function connectLocal(host: string) {
  if (!services.auth?.emulatorConfig) {
    connectAuthEmulator(services.auth!, `http://${host}:9099`, { disableWarnings: true });
  }
  connectFirestoreEmulator(services.db!, host, 8080);
  connectFunctionsEmulator(services.functions!, host, 5001);
  connectStorageEmulator(services.storage!, host, 9199);
}

function ensureServices(): void {
  const firebaseApp = app();
  if (!services.auth) {
    services.auth = getAuth(firebaseApp);
    void setPersistence(services.auth, authPersistence(AUTH_PERSISTENCE));
  }
  if (!services.db) {
    try {
      services.db = initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
    } catch {
      services.db = getFirestore(firebaseApp);
    }
  }
  services.functions ??= getFunctions(firebaseApp, "europe-west1");
  services.storage ??= getStorage(firebaseApp);
  if (!useEmulators()) return;
  if (!emulatorsConnected) {
    try {
      connectLocal(emulatorHost());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      if (!/already been started|already called/i.test(message)) throw caught;
    }
    emulatorsConnected = true;
  }
  const report = snapshot();
  if (typeof window !== "undefined") {
    (window as Window & { __souspliBackend?: () => BackendReport }).__souspliBackend = () => snapshot();
  }
  if (!destinationsAreLocal(report)) {
    throw new Error(`La destination n'est pas l'émulateur local (${report.projectId} ; auth ${report.auth ?? "absent"} ; firestore ${report.firestore ?? "absent"} ; functions ${report.functions ?? "absent"} ; storage ${report.storage ?? "absent"}). Aucune écriture n'est envoyée.`);
  }
}

export function getFirebaseAuth(): Auth {
  ensureServices();
  return services.auth!;
}

export function getDb(): Firestore {
  ensureServices();
  return services.db!;
}

export function getFns(): Functions {
  ensureServices();
  return services.functions!;
}

export function getBucket(): FirebaseStorage {
  ensureServices();
  return services.storage!;
}
