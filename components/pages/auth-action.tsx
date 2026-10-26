"use client";

import { applyActionCode, checkActionCode, confirmPasswordReset } from "firebase/auth";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useSensitive } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Field, PasswordInput } from "@/components/ui/field";
import { call } from "@/lib/firebase/api";
import { getFirebaseAuth } from "@/lib/firebase/client";

type Phase = "checking" | "reset" | "confirm" | "done" | "invalid" | "expired" | "network" | "weak" | "error";

export function AuthActionScreen({ mode, code }: { mode: string; code: string }) {
  const { setLocked } = useSensitive();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setLocked(true);
    return () => setLocked(false);
  }, [setLocked]);
  useEffect(() => {
    const known = mode === "resetPassword" || mode === "verifyEmail" || mode === "verifyAndChangeEmail";
    if (!known || code.length < 10) {
      setPhase("invalid");
      return;
    }
    void checkActionCode(getFirebaseAuth(), code).then(() => {
      setPhase(mode === "resetPassword" ? "reset" : "confirm");
    }).catch((caught) => setPhase(phaseOf(caught)));
  }, [mode, code]);

  async function confirmAddress() {
    setBusy(true);
    setDetail("");
    try {
      const auth = getFirebaseAuth();
      await applyActionCode(auth, code);
      const user = auth.currentUser;
      if (user) {
        await user.reload();
        await user.getIdToken(true);
        await call("ensureProfile").catch(() => undefined);
      }
      setPhase("done");
    } catch (caught) {
      setPhase(phaseOf(caught));
      setDetail(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reset(event: FormEvent) {
    event.preventDefault();
    setDetail("");
    if (password.length < 8) {
      setPhase("weak");
      setDetail("8 caractères minimum.");
      return;
    }
    if (password !== confirm) {
      setDetail("Les deux saisies diffèrent.");
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(getFirebaseAuth(), code, password);
      setPassword("");
      setConfirm("");
      setPhase("done");
    } catch (caught) {
      setPhase(phaseOf(caught));
      setDetail(caught instanceof Error ? messageOf(caught) : "La réinitialisation a échoué.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-serif text-4xl text-pine-deep">Action du compte</h1>
      {phase === "checking" ? <p>Vérification du lien.</p> : null}
      {phase === "invalid" ? <p className="text-burgundy">Ce lien est invalide ou a déjà été utilisé.</p> : null}
      {phase === "expired" ? <p className="text-burgundy">Ce lien a expiré.</p> : null}
      {phase === "network" ? <p className="text-burgundy">Erreur réseau. Réessaie dans un instant. Les mots de passe saisis sont conservés.</p> : null}
      {phase === "weak" ? <p className="text-burgundy">Le mot de passe ne respecte pas la politique Firebase. {detail}</p> : null}
      {phase === "error" ? <p className="text-burgundy">{detail || "Cette action n'a pas abouti."}</p> : null}
      {phase === "done" && mode === "resetPassword" ? <p>Réinitialisation réussie. Tu peux te connecter avec le nouveau mot de passe.</p> : null}
      {phase === "done" && mode === "verifyEmail" ? <p>Adresse vérifiée. Les actions d'organisateur qui l'exigent sont maintenant disponibles.</p> : null}
      {phase === "done" && mode === "verifyAndChangeEmail" ? <p>Nouvelle adresse confirmée. Les participations restent liées à ce compte.</p> : null}
      {phase === "confirm" ? (
        <div className="space-y-3 rounded-3xl border border-line bg-card p-5">
          <p className="text-sm">Ouvrir ce lien ne modifie rien. Confirme l'action pour l'appliquer.</p>
          <Button busy={busy} onClick={() => void confirmAddress()}>{mode === "verifyAndChangeEmail" ? "Confirmer la nouvelle adresse" : "Confirmer l'adresse"}</Button>
        </div>
      ) : null}
      {phase === "reset" || phase === "weak" || (phase === "network" && mode === "resetPassword") ? (
        <form className="space-y-4 rounded-3xl border border-line bg-card p-5" onSubmit={(event) => void reset(event)}>
          <Field label="Nouveau mot de passe">
            <PasswordInput autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Field label="Confirmation">
            <PasswordInput autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </Field>
          {detail && phase === "reset" ? <p className="text-sm text-burgundy">{detail}</p> : null}
          <Button type="submit" busy={busy}>Enregistrer le mot de passe</Button>
        </form>
      ) : null}
      <Link className="text-sm text-pine" href="/connexion">Retour à la connexion</Link>
    </div>
  );
}

function phaseOf(caught: unknown): Phase {
  const code = caught && typeof caught === "object" && "code" in caught ? String((caught as { code?: string }).code) : "";
  if (code === "auth/expired-action-code") return "expired";
  if (code === "auth/invalid-action-code") return "invalid";
  if (code === "auth/weak-password") return "weak";
  if (code === "auth/network-request-failed") return "network";
  return "invalid";
}

function messageOf(caught: unknown): string {
  const code = caught && typeof caught === "object" && "code" in caught ? String((caught as { code?: string }).code) : "";
  if (code === "auth/weak-password") return "Choisis un mot de passe plus long.";
  if (code === "auth/network-request-failed") return "Erreur réseau.";
  return "Le lien n'a pas pu être utilisé.";
}
