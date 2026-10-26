"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearDraft } from "@/lib/draft";
import { call } from "@/lib/firebase/api";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase/client";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";

interface AuthState {
  user: User | null;
  ready: boolean;
  configured: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, ready: false, configured: false });
const ToastContext = createContext<(message: string) => void>(() => undefined);
const ConfirmContext = createContext<
  (options: { title: string; description?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>
>(async () => false);
const SensitiveContext = createContext<{ locked: boolean; setLocked: (value: boolean) => void }>({ locked: false, setLocked: () => undefined });

export function useAuth() {
  return useContext(AuthContext);
}

export function useToast() {
  return useContext(ToastContext);
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function useSensitive() {
  return useContext(SensitiveContext);
}

export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const configured = firebaseConfigured();
  const [toast, setToast] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    description?: string;
    confirmLabel?: string;
    danger?: boolean;
    resolve: (value: boolean) => void;
  } | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    return onAuthStateChanged(getFirebaseAuth(), (next) => {
      setUser(next);
      setReady(true);
      if (next) void call("ensureProfile").catch(() => undefined);
    });
  }, [configured]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const authValue = useMemo(() => ({ user, ready, configured }), [user, ready, configured]);

  return (
    <AuthContext.Provider value={authValue}>
      <ToastContext.Provider value={setToast}>
        <ConfirmContext.Provider
          value={(options) =>
            new Promise((resolve) => {
              setConfirm({ ...options, resolve });
            })
          }
        >
          <SensitiveContext.Provider value={{ locked, setLocked }}>
            {children}
            {toast ? (
              <div className="fixed bottom-24 left-1/2 z-[70] w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl bg-pine px-4 py-3 text-sm text-white shadow-lg sm:bottom-6" role="status">
                {toast}
              </div>
            ) : null}
            <Modal
              open={Boolean(confirm)}
              title={confirm?.title ?? ""}
              description={confirm?.description}
              onOpenChange={(open) => {
                if (!open && confirm) {
                  confirm.resolve(false);
                  setConfirm(null);
                }
              }}
            >
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    confirm?.resolve(false);
                    setConfirm(null);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  variant={confirm?.danger ? "danger" : "primary"}
                  onClick={() => {
                    confirm?.resolve(true);
                    setConfirm(null);
                  }}
                >
                  {confirm?.confirmLabel ?? "Confirmer"}
                </Button>
              </div>
            </Modal>
          </SensitiveContext.Provider>
        </ConfirmContext.Provider>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}

export async function signOutClear() {
  clearDraft();
  await signOut(getFirebaseAuth());
}
