"use client";

import { useAuth } from "@/components/providers";
import { LoadingState } from "@/components/ui/states";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready, configured } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && configured && !user) router.replace("/connexion");
  }, [ready, configured, user, router]);
  if (!configured) return <p className="text-sm text-burgundy">La configuration Firebase du navigateur est incomplète.</p>;
  if (!ready || !user) return <LoadingState label="Ouverture de la session" />;
  return children;
}
