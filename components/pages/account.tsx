"use client";

import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { EmailAuthProvider, GoogleAuthProvider, linkWithCredential, reauthenticateWithCredential, reauthenticateWithPopup } from "firebase/auth";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { signOutClear, useAuth, useConfirm, useSensitive, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { call, errorText } from "@/lib/firebase/api";
import { getDb, getFirebaseAuth } from "@/lib/firebase/client";

export function NotificationsPage() {
  return <RequireAuth><Notifications /></RequireAuth>;
}

function Notifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Array<{ id: string; title?: string; body?: string; read?: boolean }> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(getDb(), "users", user.uid, "notifications"), orderBy("createdAt", "desc")), (snap) => {
      setRows(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (caught) => setError(errorText(caught)));
  }, [user]);
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl text-pine-deep">Notifications</h1>
      {error ? <ErrorState>{error}</ErrorState> : null}
      {rows === null && !error ? <LoadingState /> : null}
      {rows?.length === 0 ? <EmptyState title="Rien de nouveau">Les alertes de messages restent génériques.</EmptyState> : null}
      {rows?.map((row) => (
        <article key={row.id} className="rounded-3xl border border-line bg-card p-4">
          <h2 className="font-semibold">{row.title}</h2>
          <p className="text-sm text-muted">{row.body}</p>
          {row.read ? <p className="mt-2 text-xs text-muted">Lue</p> : (
            <button type="button" className="mt-2 text-sm font-semibold text-pine" onClick={() => {
              if (!user) return;
              void updateDoc(doc(getDb(), "users", user.uid, "notifications", row.id), { read: true });
            }}>Marquer comme lue</button>
          )}
        </article>
      ))}
    </div>
  );
}

export function ProfilePage() {
  return <RequireAuth><Profile /></RequireAuth>;
}

function Profile() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [name, setName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [error, setError] = useState("");
  const { setLocked } = useSensitive();
  const passwordAccount = Boolean(user?.providerData.some((item) => item.providerId === "password"));
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-serif text-4xl text-pine-deep">Profil</h1>
      <p className="text-sm text-muted">{user?.email || "Session sans adresse e-mail"} {user?.emailVerified ? "· adresse vérifiée" : user?.email ? "· adresse non vérifiée" : ""}</p>
      {user?.email && !user.emailVerified ? (
        <div className="space-y-2 rounded-3xl border border-line bg-card p-4">
          <p className="text-sm">L'adresse n'est pas vérifiée. L'aide reste disponible et tu peux te déconnecter.</p>
          <Button variant="secondary" onClick={async () => {
            try {
              const result = await call<{ status: string }>("requestEmailVerification");
              toast(result.status === "captured_locally" ? "Capturé localement — aucun e-mail envoyé" : result.status === "sent" ? "Accepté par Resend" : result.status === "already" ? "Adresse déjà vérifiée" : "Le renvoi n'a pas été accepté");
            } catch (caught) { setError(errorText(caught)); }
          }}>Renvoyer l'e-mail</Button>
        </div>
      ) : null}
      {user && !user.isAnonymous ? (
        <form className="space-y-3 rounded-3xl border border-line bg-card p-4" onSubmit={async (event) => {
          event.preventDefault();
          const current = getFirebaseAuth().currentUser;
          if (!current?.email) return;
          try {
            if (passwordAccount) {
              await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
            } else {
              await reauthenticateWithPopup(current, new GoogleAuthProvider());
            }
            await current.getIdToken(true);
            const result = await call<{ status: string }>("requestEmailChange", { email: nextEmail });
            setPassword("");
            toast(result.status === "captured_locally" ? "Capturé localement — aucun e-mail envoyé" : result.status === "sent" ? "Accepté par Resend" : "La demande n'a pas été acceptée");
          } catch (caught) { setError(errorText(caught)); }
        }}>
          <h2 className="font-serif text-2xl">Changer d'adresse</h2>
          <p className="text-sm text-muted">La nouvelle adresse n'est effective qu'après le lien de confirmation. Les participations restent sur ce compte.</p>
          <Field label="Nouvelle adresse"><TextInput type="email" autoComplete="email" value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} /></Field>
          {passwordAccount ? <Field label="Mot de passe actuel"><TextInput type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onFocus={() => setLocked(true)} onBlur={() => setLocked(false)} /></Field> : null}
          <Button type="submit">Demander le changement</Button>
        </form>
      ) : null}
      <Field label="Nom affiché"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Button onClick={async () => {
        try {
          await call("updatePreferences", { displayName: name, preferences: { notifyReminders: true, notifyActivity: true } });
          toast("Profil enregistré");
        } catch (caught) { setError(errorText(caught)); }
      }}>Enregistrer</Button>
      {user?.isAnonymous ? (
        <form className="space-y-3 rounded-3xl border border-line bg-card p-4" onSubmit={async (event) => {
          event.preventDefault();
          try {
            const credential = EmailAuthProvider.credential(email, password);
            await linkWithCredential(getFirebaseAuth().currentUser!, credential);
            await call("requestEmailVerification");
            toast("Adresse ajoutée. Le message de vérification suit le circuit Sous pli.");
          } catch (caught) { setError(errorText(caught)); }
        }}>
          <h2 className="font-serif text-2xl">Ajouter une adresse</h2>
          <Field label="E-mail"><TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <Field label="Mot de passe"><TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
          <Button type="submit">Lier cette session</Button>
        </form>
      ) : null}
      <Button variant="secondary" onClick={async () => {
        const data = await call("exportMyData");
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "sous-pli-export.json";
        anchor.click();
        URL.revokeObjectURL(url);
      }}>Exporter mes données</Button>
      <Button variant="danger" onClick={async () => {
        const accepted = await confirm({ title: "Supprimer le compte ?", description: "Les échanges en cours doivent d'abord être annulés ou archivés.", confirmLabel: "Supprimer", danger: true });
        if (!accepted) return;
        try {
          const result = await call<{ status: string }>("deleteAccount", { confirm: "SUPPRIMER" });
          if (result.status === "deleted") toast("Suppression terminée");
          await signOutClear();
        }
        catch (caught) { setError(errorText(caught)); }
      }}>Supprimer le compte</Button>
      <Button variant="secondary" onClick={() => void signOutClear()}>Se déconnecter</Button>
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
    </div>
  );
}
