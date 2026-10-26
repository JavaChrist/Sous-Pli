"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-3xl border border-line bg-card p-6">
      <h1 className="font-serif text-4xl text-pine-deep">Une erreur est survenue</h1>
      <p className="text-sm text-muted">La page n'a pas pu s'afficher. Vos brouillons locaux restent sur cet appareil.</p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
