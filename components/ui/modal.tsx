"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "./button";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  busy = false,
  dirty = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  busy?: boolean;
  dirty?: boolean;
}) {
  const [confirmLeave, setConfirmLeave] = useState(false);

  function requestClose() {
    if (busy) return;
    if (dirty) {
      setConfirmLeave(true);
      return;
    }
    setConfirmLeave(false);
    onOpenChange(false);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else requestClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45" />
        <Dialog.Content
          className="fixed z-50 flex max-h-[min(92dvh,44rem)] w-[min(32rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-xl inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <Dialog.Title className="font-serif text-2xl text-pine-deep">{title}</Dialog.Title>
              <Dialog.Description className={description ? "mt-1 text-sm text-muted" : "sr-only"}>
                {description ?? "Fenêtre de dialogue"}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-2xl p-2 text-ink hover:bg-white" aria-label="Fermer" disabled={busy}>
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-5 py-4">{confirmLeave ? null : children}</div>
          {confirmLeave ? (
            <div className="space-y-4 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <p className="text-sm text-ink">Des modifications ne sont pas enregistrées. Les abandonner ?</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
                  Continuer la saisie
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirmLeave(false);
                    onOpenChange(false);
                  }}
                >
                  Abandonner
                </Button>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
