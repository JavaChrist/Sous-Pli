"use client";

import { collection, collectionGroup, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useAuth, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { call, errorText } from "@/lib/firebase/api";
import { getDb, getFirebaseAuth } from "@/lib/firebase/client";
import { formatWhen, memberStatusLabel, statusLabel } from "@/lib/format";
import { signInAnonymously } from "firebase/auth";
import { useRouter } from "next/navigation";

export function ParticipationsPage() {
  return <RequireAuth><List /></RequireAuth>;
}

function List() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Array<{ id: string; eventId?: string; eventName?: string; status?: string }> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collectionGroup(getDb(), "memberIndex"), where("uid", "==", user.uid), orderBy("updatedAt", "desc")), (snap) => {
      setRows(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (caught) => setError(errorText(caught)));
  }, [user]);
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl text-pine-deep">Mes participations</h1>
      <p className="text-sm text-muted">Les échanges rejoints avec ce compte apparaissent ici. Les personnes ajoutées à un tirage que vous organisez sont dans Événements.</p>
      {error ? <ErrorState>{error}</ErrorState> : null}
      {rows === null && !error ? <LoadingState /> : null}
      {rows?.length === 0 ? <EmptyState title="Aucune participation">Acceptez une invitation pour qu'un échange apparaisse ici. Les personnes déjà saisies dans un tirage restent dans Événements.</EmptyState> : null}
      {rows?.map((row) => (
        <Link key={`${row.eventId}-${row.id}`} href={`/participations/${row.eventId}`} className="block rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">{row.eventName}</h2>
          <p className="text-sm text-muted">{memberStatusLabel(String(row.status ?? ""))}</p>
        </Link>
      ))}
    </div>
  );
}

export function ParticipantHome({ eventId }: { eventId: string }) {
  return <RequireAuth><Home eventId={eventId} /></RequireAuth>;
}

function Home({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [assignment, setAssignment] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    void call("materializeMyAssignment", { eventId }).catch(() => undefined);
    const unsubEvent = onSnapshot(doc(getDb(), "events", eventId), (snap) => setEvent(snap.exists() ? snap.data() : null), (caught) => setError(errorText(caught)));
    const unsubView = onSnapshot(doc(getDb(), "users", user.uid, "assignments", eventId), (snap) => setAssignment(snap.exists() ? snap.data() : null));
    return () => { unsubEvent(); unsubView(); };
  }, [eventId, user]);
  const slots = (assignment?.slots ?? []) as Array<{ slot: number; label: string }>;
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl text-pine-deep">{String(event?.name ?? "Participation")}</h1>
      <p className="text-sm text-muted">{event ? `${statusLabel(String(event.status))} · ${formatWhen(event.startsAt)}` : "Chargement de l'échange"}</p>
      {error ? <ErrorState>{error}</ErrorState> : null}
      {String(event?.privacyMode) === "double_blind" ? <p className="rounded-2xl bg-card p-4 text-sm text-muted">En double mystère, le nom reste masqué jusqu'à la révélation collective. Un texte ou une photo peut malgré tout permettre de deviner une personne.</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={async () => { try { await call("markDiscovered", { eventId }); setOpen(true); } catch (caught) { setError(errorText(caught)); } }}>Découvrir mon destinataire</Button>
        <Link className="rounded-full border border-line px-4 py-2 text-sm" href={`/participations/${eventId}/souhaits`}>Souhaits</Link>
        <Link className="rounded-full border border-line px-4 py-2 text-sm" href={`/participations/${eventId}/idees`}>Idées cadeau</Link>
        <Link className="rounded-full border border-line px-4 py-2 text-sm" href={`/participations/${eventId}/messages`}>Messages</Link>
        <Link className="rounded-full border border-line px-4 py-2 text-sm" href={`/participations/${eventId}/jour-j`}>Jour J</Link>
      </div>
      {!assignment && String(event?.status) === "drawn" ? <p className="text-sm text-muted">Votre résultat est en cours de publication.</p> : null}
      <Modal open={open} onOpenChange={setOpen} title="Votre destinataire" description="Vous pouvez masquer de nouveau cet écran.">
        <div className="motion-safe:animate-[fade_600ms_ease]">
          {slots.length ? slots.map((slot) => <p key={slot.slot} className="font-serif text-3xl text-pine">{slot.label}</p>) : <p>Aucun destinataire n'est encore disponible.</p>}
        </div>
        <Button className="mt-4" variant="secondary" onClick={() => setOpen(false)}>Masquer</Button>
      </Modal>
      <button type="button" className="text-sm text-pine" onClick={() => toast("Le résultat est masqué sur cet écran.")}>Le résultat n'est pas affiché en permanence.</button>
    </div>
  );
}

export function WishesPage({ eventId }: { eventId: string }) {
  return <RequireAuth><Wishes eventId={eventId} /></RequireAuth>;
}

function Wishes({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Array<{ id: string; text: string; url: string; price: string; note: string }>>([]);
  const [sizes, setSizes] = useState("");
  const [avoid, setAvoid] = useState("");
  const [error, setError] = useState("");
  const [memberId, setMemberId] = useState("");
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(getDb(), "events", eventId, "memberIndex", user.uid), (snap) => {
      const id = String(snap.data()?.memberId ?? "");
      setMemberId(id);
      if (!id) return;
      onSnapshot(doc(getDb(), "events", eventId, "wishlists", id), (wish) => {
        if (!wish.exists()) return;
        setItems((wish.data().items as typeof items) ?? []);
        setSizes(String(wish.data().sizes ?? ""));
        setAvoid(String(wish.data().avoid ?? ""));
      });
    });
  }, [eventId, user]);
  return (
    <form className="mx-auto max-w-2xl space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      try {
        await call("saveWishlist", { eventId, items, sizes, avoid });
        toast("Souhaits enregistrés");
      } catch (caught) { setError(errorText(caught)); }
    }}>
      <h1 className="font-serif text-4xl">Souhaits</h1>
      <p className="text-sm text-muted">Liens HTTPS seulement. N'indiquez pas d'information sensible inutile. L'envoi de photos est désactivé tant que leur affichage et leur suppression ne sont pas raccordés.</p>
      {items.map((item, index) => (
        <div key={item.id} className="space-y-2 rounded-3xl border border-line bg-card p-4">
          <TextInput value={item.text} onChange={(event) => setItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, text: event.target.value } : entry))} placeholder="Idée" />
          <TextInput value={item.url} onChange={(event) => setItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, url: event.target.value } : entry))} placeholder="https://" />
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => setItems([...items, { id: crypto.randomUUID(), text: "", url: "", price: "", note: "" }])}>Ajouter une idée</Button>
      <Field label="Tailles"><TextInput value={sizes} onChange={(event) => setSizes(event.target.value)} /></Field>
      <Field label="À éviter"><TextArea value={avoid} onChange={(event) => setAvoid(event.target.value)} /></Field>
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      <Button type="submit">Enregistrer</Button>
    </form>
  );
}

type IdeaBoard = {
  people: Array<{ id: string; displayName: string }>;
  mine: Array<{ id: string; aboutMemberId: string; text: string }>;
  recipients: Array<{
    memberId: string | null;
    label: string;
    wishes: Array<{ text: string }>;
    sizes: string;
    avoid: string;
    ideas: Array<{ authorName: string; text: string }>;
  }>;
};

export function IdeasPage({ eventId }: { eventId: string }) {
  return <RequireAuth><Ideas eventId={eventId} /></RequireAuth>;
}

function Ideas({ eventId }: { eventId: string }) {
  const toast = useToast();
  const [board, setBoard] = useState<IdeaBoard | null>(null);
  const [aboutId, setAboutId] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stopped = false;
    void call<IdeaBoard>("listGiftIdeas", { eventId })
      .then((next) => {
        if (stopped) return;
        setBoard(next);
        setAboutId((current) => current || next.people[0]?.id || "");
      })
      .catch((caught) => { if (!stopped) setError(errorText(caught)); });
    return () => { stopped = true; };
  }, [eventId]);

  async function reload() {
    const next = await call<IdeaBoard>("listGiftIdeas", { eventId });
    setBoard(next);
    setAboutId((current) => current || next.people[0]?.id || "");
  }

  const nameOf = (id: string) => board?.people.find((person) => person.id === id)?.displayName ?? "Personne";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-serif text-4xl">Idées cadeau</h1>
      <p className="text-sm text-muted">Les prénoms du groupe sont visibles pour choisir une personne. Les adresses restent cachées. Noter une idée ne révèle pas qui offre à qui. La personne concernée ne voit pas ces notes : seule celle qui l'a tirée les consulte, avec le prénom de l'auteur.</p>
      {error ? <ErrorState>{error}</ErrorState> : null}
      {board === null && !error ? <LoadingState /> : null}
      {board && board.recipients.length === 0 ? <p className="text-sm text-muted">Après le tirage, les idées notées sur votre destinataire apparaîtront ici.</p> : null}
      {board?.recipients.map((recipient) => (
        <article key={`${recipient.memberId ?? "secret"}-${recipient.label}`} className="space-y-2 rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">{recipient.label}</h2>
          {recipient.wishes.length ? recipient.wishes.map((wish, index) => <p key={`${recipient.label}-${index}`} className="text-sm">{wish.text}</p>) : <p className="text-sm text-muted">Cette personne n'a pas encore écrit de souhait.</p>}
          {recipient.sizes ? <p className="text-sm text-muted">Tailles : {recipient.sizes}</p> : null}
          {recipient.avoid ? <p className="text-sm text-muted">À éviter : {recipient.avoid}</p> : null}
          <h3 className="text-sm font-semibold">Idées notées par les autres</h3>
          {recipient.ideas.length ? recipient.ideas.map((idea) => (
            <p key={`${idea.authorName}-${idea.text}`} className="text-sm"><strong>{idea.authorName}.</strong> {idea.text}</p>
          )) : <p className="text-sm text-muted">Aucune idée notée pour l'instant.</p>}
        </article>
      ))}
      <form className="space-y-3 rounded-3xl border border-line bg-card p-5" onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await call("addGiftIdea", { eventId, aboutMemberId: aboutId, text });
          setText("");
          await reload();
          toast("Idée notée");
        } catch (caught) {
          setError(errorText(caught));
        } finally {
          setBusy(false);
        }
      }}>
        <h2 className="font-serif text-2xl">Noter une idée</h2>
        <Field label="Personne">
          <SelectInput value={aboutId} onChange={(event) => setAboutId(event.target.value)}>
            {board?.people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
          </SelectInput>
        </Field>
        <Field label="Idée">
          <TextArea value={text} maxLength={280} onChange={(event) => setText(event.target.value)} placeholder="Par exemple : aimerait un appareil photo" />
        </Field>
        <Button busy={busy} type="submit">Noter l'idée</Button>
      </form>
      {board?.mine.length ? (
        <ul className="space-y-2 text-sm">
          {board.mine.map((idea) => (
            <li key={idea.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-3 py-2">
              <span>Pour {nameOf(idea.aboutMemberId)} : {idea.text}</span>
              <button type="button" className="text-burgundy" onClick={async () => {
                try {
                  await call("deleteGiftIdea", { eventId, ideaId: idea.id });
                  await reload();
                } catch (caught) { setError(errorText(caught)); }
              }}>Retirer</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function MessagesPage({ eventId }: { eventId: string }) {
  return <RequireAuth><Messages eventId={eventId} /></RequireAuth>;
}

function Messages({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Array<{ id: string; label?: string }>>([]);
  const [current, setCurrent] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; body?: string; fromLabel?: string }>>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(getDb(), "users", user.uid, "threads"), (snap) => {
      setThreads(snap.docs.filter((item) => item.data().eventId === eventId).map((item) => ({ id: item.id, ...item.data() })));
    }, (caught) => setError(errorText(caught)));
  }, [eventId, user]);
  useEffect(() => {
    if (!user || !current) return;
    return onSnapshot(collection(getDb(), "users", user.uid, "threads", current, "messages"), (snap) => {
      setMessages(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
  }, [current, user]);
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Messages</h1>
      <p className="text-sm text-muted">La conversation ne révèle pas l'identité cachée. Pas de pièce jointe dans cette version.</p>
      {error ? <ErrorState>{error}</ErrorState> : null}
      {threads.length === 0 ? <EmptyState title="Aucune conversation">Elles apparaissent après le tirage, une par cadeau.</EmptyState> : null}
      <div className="flex flex-wrap gap-2">
        {threads.map((thread) => <Button key={thread.id} variant={current === thread.id ? "primary" : "secondary"} onClick={() => setCurrent(thread.id)}>{thread.label}</Button>)}
      </div>
      <ul className="space-y-2">
        {messages.map((message) => <li key={message.id} className="rounded-2xl bg-card px-3 py-2 text-sm"><strong>{message.fromLabel}.</strong> {message.body}</li>)}
      </ul>
      {current ? (
        <form className="space-y-2" onSubmit={async (event) => {
          event.preventDefault();
          try {
            await call("sendMessage", { eventId, threadId: current, body });
            setBody("");
          } catch (caught) { setError(errorText(caught)); }
        }}>
          <TextArea value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} />
          <div className="flex gap-2">
            <Button type="submit">Envoyer</Button>
            <Button type="button" variant="secondary" onClick={() => void call("reportThread", { eventId, threadId: current })}>Signaler</Button>
            <Button type="button" variant="danger" onClick={() => void call("blockThread", { eventId, threadId: current })}>Bloquer</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function DayPage({ eventId }: { eventId: string }) {
  return <RequireAuth><Day eventId={eventId} /></RequireAuth>;
}

function Day({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [slots, setSlots] = useState<Array<{ slot: number; label: string; handedOver?: boolean }>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(getDb(), "events", eventId), (snap) => setEvent(snap.data() ?? null));
    const unsubView = onSnapshot(doc(getDb(), "users", user.uid, "assignments", eventId), (snap) => setSlots((snap.data()?.slots as typeof slots) ?? []));
    return () => { unsub(); unsubView(); };
  }, [eventId, user]);
  const organizer = event?.organizerUid === user?.uid;
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Jour J</h1>
      <p className="text-sm text-muted">{String(event?.place || "Lieu non précisé")} · {formatWhen(event?.startsAt)}</p>
      <p className="text-sm text-muted">Cocher un cadeau ne publie pas les résultats du groupe.</p>
      {slots.map((slot) => (
        <label key={slot.slot} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-sm">
          <input type="checkbox" checked={Boolean(slot.handedOver)} onChange={(event) => void call("markGift", { eventId, slot: slot.slot, handed: event.target.checked })} />
          Cadeau {slot.slot} pour {slot.label}
        </label>
      ))}
      {organizer ? <Button onClick={async () => { try { await call("revealEvent", { eventId }); } catch (caught) { setError(errorText(caught)); } }}>Ouvrir la révélation collective</Button> : null}
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
    </div>
  );
}

export function InvitationPage({ token }: { token: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [info, setInfo] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void call<Record<string, string>>("inspectInvitation", { token }).then(setInfo).catch((caught) => setError(errorText(caught)));
  }, [token]);
  async function accept(anonymous = false) {
    setBusy(true);
    setError("");
    try {
      if (anonymous && !user) await signInAnonymously(getFirebaseAuth());
      const result = await call<{ eventId: string }>("acceptInvitation", { token });
      router.replace(`/participations/${result.eventId}`);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="mx-auto max-w-xl space-y-4">
      <h1 className="font-serif text-4xl text-pine-deep">Invitation</h1>
      {info ? <p className="text-sm text-muted">{info.organizerName} vous propose de rejoindre {info.eventName} en tant que {info.memberName}. État : {info.state}. Ouvrir cette page ne consomme pas le lien.</p> : <LoadingState />}
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button busy={busy} onClick={() => void accept(false)} disabled={!user}>Accepter avec ce compte</Button>
        <Button busy={busy} variant="secondary" onClick={() => void accept(true)}>Continuer sans créer de compte</Button>
        <Link href="/connexion" className="rounded-full border border-line px-4 py-2 text-sm">Se connecter</Link>
      </div>
      <p className="text-sm text-muted">Sans compte, la session reste dans ce navigateur jusqu'à ce que vous ajoutiez une adresse.</p>
    </article>
  );
}

export function JoinPage({ code }: { code: string }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <form className="mx-auto max-w-xl space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      try {
        if (!user) await signInAnonymously(getFirebaseAuth());
        const result = await call<{ status: string; eventName: string }>("requestJoin", { code, displayName: name });
        setMessage(result.status === "joined" ? `Vous avez rejoint ${result.eventName}.` : `Demande envoyée pour ${result.eventName}. L'organisateur doit l'accepter. La liste des participants ne vous a pas été montrée.`);
      } catch (caught) { setError(errorText(caught)); }
    }}>
      <h1 className="font-serif text-4xl text-pine-deep">Rejoindre un groupe</h1>
      <p className="text-sm text-muted">Ce lien ne donne accès à aucune identité existante.</p>
      <Field label="Votre prénom ou pseudonyme"><TextInput value={name} onChange={(event) => setName(event.target.value)} required /></Field>
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      {message ? <p className="text-sm text-pine">{message}</p> : null}
      <Button type="submit">Envoyer la demande</Button>
    </form>
  );
}
