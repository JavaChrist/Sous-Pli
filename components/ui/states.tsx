import { AlertTriangle, Inbox, LoaderCircle, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "Chargement" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-line bg-card px-4 py-6 text-sm text-muted" role="status">
      <LoaderCircle className="h-5 w-5 animate-spin text-pine" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-card px-5 py-8 text-center">
      <Inbox className="mx-auto h-8 w-8 text-gold" />
      <h2 className="mt-3 font-serif text-2xl">{title}</h2>
      <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border border-burgundy/30 bg-white px-5 py-6" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-burgundy" />
        <div className="text-sm">
          <p className="font-semibold">La lecture a échoué</p>
          <p className="mt-1 text-muted">{children}</p>
          {onRetry ? (
            <button className="mt-3 font-semibold text-pine" onClick={onRetry} type="button">
              Réessayer
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function OfflineState() {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-line bg-card px-4 py-4 text-sm">
      <WifiOff className="h-5 w-5 text-gold" />
      <p>Connexion indisponible. Les actions ne seront pas envoyées tant que le réseau manque.</p>
    </div>
  );
}
