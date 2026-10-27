"use client";

import { collection, doc, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useAuth, useConfirm, useSensitive, useToast } from "@/components/providers";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { clearDraft, emptyDraft, loadDraft, saveDraft, type EventDraft } from "@/lib/draft";
import { call, errorText } from "@/lib/firebase/api";
import { getBucket, getDb } from "@/lib/firebase/client";
import { formatWhen, statusLabel } from "@/lib/format";
import { eventInputSchema } from "@shared/schemas";
import { CATALOG, defaultOffer, emailOfferRights, priceLabel, readCommercial } from "@shared/billing";
import { CoOrganizers, TeamProgress } from "@/components/pages/billing";
import { CONTEXT_LABELS, JOIN_LABELS, OCCASION_LABELS, PRIVACY_LABELS } from "@shared/domain";
import { mapTabular } from "@shared/import-table";
import { mergeParticipants, type RosterPerson } from "@shared/roster";
import { EVENT_TEMPLATE_IDS, defaultTheme, templateCopy, type PaletteId, type TemplateId } from "@shared/email/templates";
import { PREVIEW_VARS, renderEmail } from "@shared/email/render";
import { getDownloadURL, ref as storageObject, uploadBytes } from "firebase/storage";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";

type EventRow = { id: string; name?: string; status?: string; startsAt?: unknown; privacyMode?: string; role?: "co" };

export function EventsPage() {
  return (
    <RequireAuth>
      <EventsList />
    </RequireAuth>
  );
}

function EventsList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<EventRow[] | null>(null);
  const [shared, setShared] = useState<EventRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(getDb(), "events"), where("organizerUid", "==", user.uid), orderBy("updatedAt", "desc")),
      (snap) => setRows(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (caught) => setError(errorText(caught)),
    );
  }, [user]);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(getDb(), "users", user.uid, "coEvents"), (snap) => {
      setShared(snap.docs.map((item) => ({ id: item.id, name: String(item.data().eventName ?? "Échange"), role: "co" })));
    });
  }, [user]);
  const ownedIds = new Set(rows?.map((event) => event.id) ?? []);
  const visible = [...(rows ?? []), ...shared.filter((event) => !ownedIds.has(event.id))];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-4xl text-pine-deep">Mes événements</h1>
        <ButtonLink href="/evenements/nouveau">Créer</ButtonLink>
      </div>
      {error ? <ErrorState>{error}</ErrorState> : null}
      {rows === null && !error ? <LoadingState /> : null}
      {rows?.length === 0 && shared.length === 0 ? <EmptyState title="Aucun échange">Préparez un premier tirage. Le brouillon peut commencer avant l'enregistrement.</EmptyState> : null}
      <div className="grid gap-3">
        {visible.map((event) => (
          <Link key={event.id} href={`/evenements/${event.id}`} className="rounded-3xl border border-line bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl">{event.name}</h2>
              <span className="rounded-full bg-cream px-3 py-1 text-xs">{event.role === "co" ? "Coorganisateur" : statusLabel(String(event.status))}</span>
            </div>
            <p className="mt-2 text-sm text-muted">{event.role === "co" ? "Accès de gestion, sans les attributions." : `${formatWhen(event.startsAt)} · ${PRIVACY_LABELS[event.privacyMode as keyof typeof PRIVACY_LABELS] ?? ""}`}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function WizardPage() {
  return (
    <RequireAuth>
      <Wizard />
    </RequireAuth>
  );
}

function Wizard() {
  const [draft, setDraft] = useState<EventDraft>(emptyDraft());
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    const stored = loadDraft();
    if (stored) setDraft(stored);
  }, []);
  useEffect(() => saveDraft(draft), [draft]);

  async function save() {
    const payload = {
      name: draft.name,
      occasion: draft.occasion,
      context: draft.context,
      localDate: draft.localDate,
      localTime: draft.localTime,
      timeZone: draft.timeZone,
      place: draft.place,
      description: draft.description,
      rulesText: draft.rulesText,
      budget: draft.budgetEnabled ? { min: Number(draft.budgetMin), max: Number(draft.budgetMax), currency: "EUR", handmade: draft.handmade, secondHand: draft.secondHand } : null,
      privacyMode: draft.privacyMode,
      giftsPerPerson: Number(draft.giftsPerPerson),
      avoidReciprocal: draft.avoidReciprocal,
      organizerParticipates: draft.organizerParticipates,
      revealLocalDate: draft.revealLocalDate || draft.localDate,
      revealLocalTime: draft.revealLocalTime,
      joinPolicy: draft.joinPolicy,
      offerId: draft.offerId,
      organizationName: draft.organizationName,
      teamName: draft.teamName,
    };
    const parsed = eventInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Le formulaire est incomplet.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await call<{ eventId: string }>("upsertEvent", parsed.data);
      await call("setMembers", { eventId: created.eventId, members: draft.members });
      clearDraft();
      toast("Échange enregistré. Aucune invitation n'a été envoyée.");
      window.location.href = `/evenements/${created.eventId}`;
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-serif text-4xl text-pine-deep">Nouvel échange</h1>
      <p className="text-sm text-muted">Étape {step + 1} sur 4. Le brouillon reste sur cet appareil tant qu'il n'est pas enregistré.</p>
      {step === 0 ? (
        <div className="space-y-3 rounded-3xl border border-line bg-card p-5">
          <Field label="Nom"><TextInput value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
          <Field label="Contexte">
            <SelectInput value={draft.context} onChange={(event) => {
              const context = event.target.value as EventDraft["context"];
              setDraft({ ...draft, context, offerId: defaultOffer(context) });
            }}>
              {Object.entries(CONTEXT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </SelectInput>
          </Field>
          <Field label="Occasion">
            <SelectInput value={draft.occasion} onChange={(event) => setDraft({ ...draft, occasion: event.target.value as EventDraft["occasion"] })}>
              {Object.entries(OCCASION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </SelectInput>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date"><TextInput type="date" value={draft.localDate} onChange={(event) => setDraft({ ...draft, localDate: event.target.value })} /></Field>
            <Field label="Heure"><TextInput type="time" value={draft.localTime} onChange={(event) => setDraft({ ...draft, localTime: event.target.value })} /></Field>
          </div>
          <Field label="Fuseau"><TextInput value={draft.timeZone} onChange={(event) => setDraft({ ...draft, timeZone: event.target.value })} /></Field>
          <Field label="Lieu"><TextInput value={draft.place} onChange={(event) => setDraft({ ...draft, place: event.target.value })} /></Field>
          <Field label="Consignes"><TextArea value={draft.rulesText} onChange={(event) => setDraft({ ...draft, rulesText: event.target.value })} /></Field>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="space-y-3 rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">Offre</h2>
          <p className="text-sm text-muted">Un paiement par événement, sans abonnement. Les participants ne paient jamais. Une organisation peut préparer le brouillon avant de payer. Le tirage d'une offre payante attend la confirmation serveur.</p>
          <Field label="Formule">
            <SelectInput value={draft.offerId} onChange={(event) => setDraft({ ...draft, offerId: event.target.value as EventDraft["offerId"] })}>
              {Object.values(CATALOG).filter((offer) => offer.contexts.includes(draft.context)).map((offer) => (
                <option key={offer.id} value={offer.id}>{offer.title} — {priceLabel(offer.id)}</option>
              ))}
            </SelectInput>
          </Field>
          <p className="text-sm text-muted">{CATALOG[draft.offerId].summary} Capacité : {CATALOG[draft.offerId].capacity ?? "sur devis"}.</p>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-3 rounded-3xl border border-line bg-card p-5">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.budgetEnabled} onChange={(event) => setDraft({ ...draft, budgetEnabled: event.target.checked })} /> Indiquer un budget</label>
          {draft.budgetEnabled ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Minimum"><TextInput inputMode="decimal" value={draft.budgetMin} onChange={(event) => setDraft({ ...draft, budgetMin: event.target.value })} /></Field>
              <Field label="Maximum"><TextInput inputMode="decimal" value={draft.budgetMax} onChange={(event) => setDraft({ ...draft, budgetMax: event.target.value })} /></Field>
            </div>
          ) : null}
          <Field label="Confidentialité">
            <SelectInput value={draft.privacyMode} onChange={(event) => setDraft({ ...draft, privacyMode: event.target.value as EventDraft["privacyMode"] })}>
              {Object.entries(PRIVACY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </SelectInput>
          </Field>
          <Field label="Cadeaux par personne">
            <SelectInput value={draft.giftsPerPerson} onChange={(event) => setDraft({ ...draft, giftsPerPerson: Number(event.target.value) })}>
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
            </SelectInput>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.avoidReciprocal} onChange={(event) => setDraft({ ...draft, avoidReciprocal: event.target.checked })} /> Éviter les échanges réciproques si possible</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.organizerParticipates} onChange={(event) => setDraft({ ...draft, organizerParticipates: event.target.checked })} /> Je participe au tirage</label>
          <Field label="Inscriptions">
            <SelectInput value={draft.joinPolicy} onChange={(event) => setDraft({ ...draft, joinPolicy: event.target.value as EventDraft["joinPolicy"] })}>
              {Object.entries(JOIN_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </SelectInput>
          </Field>
          <Field label="Révélation collective"><TextInput type="date" value={draft.revealLocalDate} onChange={(event) => setDraft({ ...draft, revealLocalDate: event.target.value })} /></Field>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">Capacité prévue : {CATALOG[draft.offerId].capacity ?? "devis"}. L'organisateur compte s'il participe. Personne n'est retiré automatiquement.</p>
          <MemberEditor members={draft.members} onChange={(members) => setDraft({ ...draft, members })} />
        </div>
      ) : null}
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>Retour</Button>
        {step < 3 ? <Button onClick={() => setStep((value) => value + 1)}>Continuer</Button> : <Button busy={busy} onClick={() => void save()}>Enregistrer le brouillon</Button>}
      </div>
    </div>
  );
}

function MemberEditor({
  members,
  onChange,
  excludeEventId,
  organizerMemberId,
  onReused,
}: {
  members: EventDraft["members"];
  onChange: (members: EventDraft["members"]) => void;
  excludeEventId?: string;
  organizerMemberId?: string | null;
  onReused?: (members: EventDraft["members"]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [reuseOpen, setReuseOpen] = useState(false);
  const toast = useToast();
  return (
    <div className="space-y-3 rounded-3xl border border-line bg-card p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <TextInput placeholder="Prénom ou pseudonyme" value={name} onChange={(event) => setName(event.target.value)} />
        <TextInput placeholder="E-mail facultatif" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Button type="button" onClick={() => { if (!name.trim()) return; onChange([...members, { displayName: name.trim(), email: email.trim(), groupLabel: "" }]); setName(""); setEmail(""); }}>Ajouter</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" type="button" onClick={() => setImportOpen(true)}>Importer un fichier</Button>
        <Button variant="secondary" type="button" onClick={() => setReuseOpen(true)}>Reprendre un groupe</Button>
      </div>
      <ul className="space-y-2 text-sm">
        {members.map((member, index) => (
          <li key={`${member.displayName}-${index}`} className="flex items-center justify-between rounded-2xl bg-cream px-3 py-2">
            <span>{member.displayName}{member.email ? ` · ${member.email}` : ""}</span>
            <Button type="button" variant="danger" onClick={() => onChange(members.filter((_, item) => item !== index))}>Retirer</Button>
          </li>
        ))}
      </ul>
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={(imported) => onChange([...members, ...imported])} />
      <ReuseRosterDialog
        open={reuseOpen}
        onOpenChange={setReuseOpen}
        excludeEventId={excludeEventId}
        current={members}
        organizerMemberId={organizerMemberId}
        onImported={async (next, added) => {
          if (onReused) await onReused(next);
          onChange(next);
          toast(added === 1 ? "1 personne reprise, avec son adresse." : `${added} personnes reprises, avec leurs adresses.`);
        }}
      />
    </div>
  );
}

function ImportDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; onImported: (members: EventDraft["members"]) => void }) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [nameCol, setNameCol] = useState("");
  const [emailCol, setEmailCol] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Importer des participants" description="Aucune formule du fichier n'est exécutée. Deux prénoms identiques restent deux personnes.">
      <input
        type="file"
        accept=".csv,.xlsx,text/csv"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.name.endsWith(".csv")) {
            const text = await file.text();
            const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
            const table = parsed.data;
            setHeaders(table[0] ?? []);
            setRows(table.slice(1));
            setNameCol(table[0]?.[0] ?? "");
          } else {
            const table = await readSheet(file);
            const asText = table.map((row) => row.map((cell) => String(cell ?? "")));
            setHeaders(asText[0] ?? []);
            setRows(asText.slice(1));
            setNameCol(asText[0]?.[0] ?? "");
          }
        }}
      />
      {headers.length ? (
        <div className="mt-3 space-y-3">
          <Field label="Colonne du prénom">
            <SelectInput value={nameCol} onChange={(event) => setNameCol(event.target.value)}>
              {headers.map((header) => <option key={header}>{header}</option>)}
            </SelectInput>
          </Field>
          <Field label="Colonne e-mail">
            <SelectInput value={emailCol} onChange={(event) => setEmailCol(event.target.value)}>
              <option value="">Aucune</option>
              {headers.map((header) => <option key={header}>{header}</option>)}
            </SelectInput>
          </Field>
          {issues.map((issue) => <p key={issue} className="text-sm text-burgundy">{issue}</p>)}
          <Button
            onClick={() => {
              const mapped = mapTabular(headers, rows, { displayName: nameCol, email: emailCol, group: "" });
              setIssues([...mapped.errors, ...mapped.warnings].map((issue) => `Ligne ${issue.row} : ${issue.message}`));
              if (!mapped.errors.length) {
                onImported(mapped.members);
                onOpenChange(false);
              }
            }}
          >
            Valider l'aperçu
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}

function ReuseRosterDialog({
  open,
  onOpenChange,
  excludeEventId,
  current,
  organizerMemberId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeEventId?: string;
  current: EventDraft["members"];
  organizerMemberId?: string | null;
  onImported: (members: EventDraft["members"], added: number) => Promise<void> | void;
}) {
  const { user } = useAuth();
  const [events, setEvents] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    setError("");
    setLoading(true);
    getDocs(query(collection(getDb(), "events"), where("organizerUid", "==", user.uid), orderBy("updatedAt", "desc")))
      .then((snap) => {
        setEvents(snap.docs
          .filter((item) => item.id !== excludeEventId)
          .map((item) => ({
            id: item.id,
            name: String(item.data().name ?? "Échange"),
            status: statusLabel(String(item.data().status ?? "")),
          })));
      })
      .catch((caught) => setError(errorText(caught)))
      .finally(() => setLoading(false));
  }, [open, user, excludeEventId]);

  async function reuse(sourceId: string) {
    setBusyId(sourceId);
    setError("");
    try {
      const [people, secrets] = await Promise.all([
        getDocs(collection(getDb(), "events", sourceId, "members")),
        getDocs(collection(getDb(), "events", sourceId, "memberPrivate")),
      ]);
      const emails = new Map(secrets.docs.map((item) => [item.id, String(item.data().email ?? "")]));
      const incoming: RosterPerson[] = people.docs.map((item) => ({
        memberId: item.id,
        displayName: String(item.data().displayName ?? ""),
        email: emails.get(item.id) ?? "",
        groupLabel: String(item.data().groupLabel ?? ""),
        managedByMemberId: (item.data().managedByMemberId as string | null) ?? null,
        role: String(item.data().role ?? ""),
      }));
      const merged = mergeParticipants(current, incoming, organizerMemberId);
      if (merged.added === 0) {
        setError("Ces personnes sont déjà dans la liste.");
        return;
      }
      await onImported(merged.members, merged.added);
      onOpenChange(false);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusyId("");
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Reprendre un groupe" description="Les prénoms et les adresses d'un échange déjà créé sont ajoutés. Une adresse déjà présente n'est pas recopiée. Aucune invitation n'est envoyée.">
      {loading ? <p className="text-sm text-muted">Chargement des échanges...</p> : null}
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      {!loading && events.length === 0 ? <p className="text-sm text-muted">Aucun autre échange à reprendre.</p> : null}
      <div className="space-y-2">
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            disabled={Boolean(busyId)}
            className={buttonClass("secondary", "w-full justify-between text-left disabled:opacity-60")}
            onClick={() => void reuse(event.id)}
          >
            <span>{event.name}</span>
            <span className="text-muted">{busyId === event.id ? "Patientez..." : event.status}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function EventDashboard({ eventId }: { eventId: string }) {
  return <RequireAuth><Dashboard eventId={eventId} /></RequireAuth>;
}

function Dashboard({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const { setLocked } = useSensitive();
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [twinOpen, setTwinOpen] = useState(false);
  const [twinName, setTwinName] = useState("");
  const [twinError, setTwinError] = useState("");
  useEffect(() => onSnapshot(doc(getDb(), "events", eventId), (snap) => {
    if (!snap.exists()) setError("Accès refusé ou échange introuvable.");
    else { setError(""); setEvent({ id: snap.id, ...snap.data() }); }
  }, (caught) => setError(errorText(caught))), [eventId, user?.uid]);

  async function launch() {
    const accepted = await confirm({
      title: "Lancer le tirage ?",
      description: "Les attributions seront figées. Cette action ne se recalcule pas en rouvrant la page.",
      confirmLabel: "Lancer le tirage",
    });
    if (!accepted) return;
    setBusy(true);
    setLocked(true);
    try {
      const result = await call<{ reciprocalPreferenceRelaxed: boolean }>("launchDraw", { eventId, idempotencyKey: crypto.randomUUID() });
      setInfo(result.reciprocalPreferenceRelaxed ? "Tirage publié. La préférence anti-réciprocité n'a pas pu être tenue." : "Tirage publié. Les résultats ne sont pas affichés ici.");
      toast("Tirage lancé");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
      setLocked(false);
    }
  }

  if (error && !event) return <ErrorState>{error}</ErrorState>;
  if (!event) return <LoadingState />;
  const status = String(event.status ?? "");
  const commercial = readCommercial(event);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl text-pine-deep">{String(event.name)}</h1>
          <p className="text-sm text-muted">{statusLabel(status)} · {formatWhen(event.startsAt)}</p>
        </div>
        <span className="rounded-full bg-card px-3 py-1 text-xs">{PRIVACY_LABELS[event.privacyMode as keyof typeof PRIVACY_LABELS]}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ButtonLink variant="secondary" className="w-full justify-start" href={`/evenements/${eventId}/participants`}>Participants</ButtonLink>
        <ButtonLink variant="secondary" className="w-full justify-start" href={`/evenements/${eventId}/exclusions`}>Règles et exclusions</ButtonLink>
        <ButtonLink variant="secondary" className="w-full justify-start" href={`/evenements/${eventId}/invitations`}>Invitations</ButtonLink>
        <ButtonLink variant="secondary" className="w-full justify-start" href={`/evenements/${eventId}/courriels`}>E-mails</ButtonLink>
        <ButtonLink variant="secondary" className="w-full justify-start" href={`/evenements/${eventId}/reglement`}>Offre et paiement</ButtonLink>
        <ButtonLink variant="secondary" className="w-full justify-start" href={`/participations/${eventId}`}>Mon espace</ButtonLink>
        <ButtonLink variant="secondary" className="w-full justify-start" href={`/participations/${eventId}/jour-j`}>Jour J</ButtonLink>
      </div>
      <p className="text-sm text-muted">{CATALOG[commercial.offerId].title} · {commercial.status === "paid" ? "payée" : commercial.status === "included" ? "incluse" : commercial.status === "pending" ? "confirmation du paiement en cours" : "paiement non confirmé"}</p>
      {commercial.offerId === "business_plus" && commercial.status === "paid" ? <TeamProgress eventId={eventId} /> : null}
      {commercial.offerId === "business_plus" && commercial.status === "paid" && event.organizerUid === user?.uid ? <CoOrganizers eventId={eventId} /> : null}
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      {info ? <p className="text-sm text-pine">{info}</p> : null}
      <div className="flex flex-wrap gap-2">
        {["draft", "registration_open", "ready"].includes(status) ? <Button busy={busy} onClick={() => void launch()}>Lancer le tirage</Button> : null}
        <Button variant="secondary" onClick={async () => {
          try {
            const result = await call<{ ok: boolean; messages: string[] }>("checkFeasibility", { eventId });
            setInfo(result.messages.join(" "));
          } catch (caught) { setError(errorText(caught)); }
        }}>Vérifier la faisabilité</Button>
        {status === "drawn" ? <Button variant="secondary" onClick={async () => {
          const accepted = await confirm({ title: "Révéler les résultats ?", description: "Le serveur refuse cette action avant l'heure prévue.", confirmLabel: "Révéler", danger: true });
          if (!accepted) return;
          try { await call("revealEvent", { eventId }); toast("Révélation ouverte"); } catch (caught) { setError(errorText(caught)); }
        }}>Révélation collective</Button> : null}
        <Button variant="secondary" onClick={() => {
          setTwinName(`${String(event.name)} — second tirage`.slice(0, 80));
          setTwinError("");
          setTwinOpen(true);
        }}>Second tirage</Button>
        <Button variant="danger" onClick={async () => {
          const accepted = await confirm({ title: "Annuler l'échange ?", description: `Saisissez ensuite le nom « ${String(event.name)} » dans la confirmation du serveur.`, confirmLabel: "Continuer", danger: true });
          if (!accepted) return;
          try { await call("cancelEvent", { eventId, confirmName: event.name }); toast("Échange annulé"); } catch (caught) { setError(errorText(caught)); }
        }}>Annuler</Button>
      </div>
      {status === "drawn" ? <LateRoster eventId={eventId} /> : null}
      <PracticalForm eventId={eventId} place={String(event.place ?? "")} rulesText={String(event.rulesText ?? "")} description={String(event.description ?? "")} />
      <Modal open={twinOpen} onOpenChange={setTwinOpen} title="Second tirage" description="Les participants, leurs adresses et les exclusions sont repris dans un nouvel échange. Les invitations et le paiement ne le sont pas. Utile pour un cadeau top et un cadeau flop." busy={busy}>
        <Field label="Nom">
          <TextInput value={twinName} maxLength={80} onChange={(input) => setTwinName(input.target.value)} />
        </Field>
        {twinError ? <p className="text-sm text-burgundy">{twinError}</p> : null}
        <Button busy={busy} onClick={async () => {
          setBusy(true);
          setTwinError("");
          try {
            const created = await call<{ eventId: string }>("duplicateEvent", { eventId, name: twinName.trim() });
            window.location.href = `/evenements/${created.eventId}`;
          } catch (caught) {
            setTwinError(errorText(caught));
            setBusy(false);
          }
        }}>Créer le second tirage</Button>
      </Modal>
    </div>
  );
}

function LateRoster({ eventId }: { eventId: string }) {
  const [name, setName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [members, setMembers] = useState<Array<{ id: string; displayName: string }>>([]);
  const [error, setError] = useState("");
  const toast = useToast();
  useEffect(() => onSnapshot(collection(getDb(), "events", eventId, "members"), (snap) => {
    setMembers(snap.docs.map((item) => ({ id: item.id, displayName: String(item.data().displayName) })));
  }), [eventId]);
  return (
    <div className="space-y-3 rounded-3xl border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">Ajout ou retrait après le tirage</h2>
      <p className="text-sm text-muted">Une attribution déjà découverte ne change pas. S'il existe déjà des messages, l'action est refusée.</p>
      <Field label="Prénom à ajouter"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Button onClick={async () => {
        try {
          await call("lateMemberChange", { eventId, action: "add", displayName: name });
          setName("");
          toast("Personne ajoutée, les résultats déjà vus sont conservés");
        } catch (caught) { setError(errorText(caught)); }
      }}>Ajouter</Button>
      <Field label="Personne à retirer">
        <SelectInput value={memberId} onChange={(event) => setMemberId(event.target.value)}>
          <option value="">Choisir</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
        </SelectInput>
      </Field>
      <Button variant="danger" onClick={async () => {
        try {
          await call("lateMemberChange", { eventId, action: "remove", memberId });
          toast("Personne retirée");
        } catch (caught) { setError(errorText(caught)); }
      }}>Retirer</Button>
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
    </div>
  );
}

function PracticalForm({ eventId, place, rulesText, description }: { eventId: string; place: string; rulesText: string; description: string }) {
  const [values, setValues] = useState({ place, rulesText, description });
  const [error, setError] = useState("");
  const toast = useToast();
  useEffect(() => setValues({ place, rulesText, description }), [place, rulesText, description]);
  return (
    <form className="space-y-3 rounded-3xl border border-line bg-card p-5" data-dirty={values.place !== place || values.rulesText !== rulesText ? "true" : "false"} onSubmit={async (event) => {
      event.preventDefault();
      try {
        await call("updatePracticalInfo", { eventId, ...values });
        toast("Informations enregistrées");
      } catch (caught) { setError(errorText(caught)); }
    }}>
      <h2 className="font-serif text-2xl">Informations pratiques</h2>
      <Field label="Lieu"><TextInput value={values.place} onChange={(event) => setValues({ ...values, place: event.target.value })} /></Field>
      <Field label="Consignes"><TextArea value={values.rulesText} onChange={(event) => setValues({ ...values, rulesText: event.target.value })} /></Field>
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      <Button type="submit">Enregistrer</Button>
    </form>
  );
}

export function ParticipantsPage({ eventId }: { eventId: string }) {
  return <RequireAuth><Participants eventId={eventId} /></RequireAuth>;
}

function Participants({ eventId }: { eventId: string }) {
  const [members, setMembers] = useState<EventDraft["members"]>([]);
  const [organizerMemberId, setOrganizerMemberId] = useState<string | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const toast = useToast();
  useEffect(() => onSnapshot(collection(getDb(), "events", eventId, "memberPrivate"), (snap) => {
    const next: Record<string, string> = {};
    snap.docs.forEach((item) => { next[item.id] = String(item.data().email ?? ""); });
    setEmails(next);
  }), [eventId]);
  useEffect(() => onSnapshot(collection(getDb(), "events", eventId, "members"), (snap) => {
    const organizer = snap.docs.find((item) => item.data().role === "organizer");
    setOrganizerMemberId(organizer?.id ?? null);
    setMembers(snap.docs.filter((item) => item.data().role !== "organizer").map((item) => ({
      memberId: item.id,
      displayName: String(item.data().displayName ?? ""),
      email: emails[item.id] ?? "",
      groupLabel: String(item.data().groupLabel ?? ""),
      managedByMemberId: (item.data().managedByMemberId as string | null) ?? null,
    })));
    setReady(true);
  }, (caught) => setError(errorText(caught))), [eventId, emails]);
  if (!ready && !error) return <LoadingState />;
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Participants</h1>
      <p className="text-sm text-muted">Les adresses restent dans l'espace organisateur. Deux prénoms identiques ne sont pas fusionnés. Pour un cadeau top et un cadeau flop, reprenez le groupe d'un échange déjà créé.</p>
      {error ? <ErrorState>{error}</ErrorState> : null}
      <MemberEditor
        members={members}
        excludeEventId={eventId}
        organizerMemberId={organizerMemberId}
        onChange={setMembers}
        onReused={async (next) => {
          await call("setMembers", { eventId, members: next.map((member) => ({ ...member, email: member.email || emails[member.memberId ?? ""] || "" })) });
        }}
      />
      <Button onClick={async () => {
        try {
          await call("setMembers", { eventId, members: members.map((member) => ({ ...member, email: member.email || emails[member.memberId ?? ""] || "" })) });
          toast("Participants enregistrés");
        } catch (caught) { setError(errorText(caught)); }
      }}>Enregistrer les participants</Button>
    </div>
  );
}

export function ExclusionsPage({ eventId }: { eventId: string }) {
  return <RequireAuth><Exclusions eventId={eventId} /></RequireAuth>;
}

function Exclusions({ eventId }: { eventId: string }) {
  const [members, setMembers] = useState<Array<{ id: string; displayName: string }>>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<Array<Record<string, unknown>>>([]);
  const [avoidPriorPairs, setAvoidPriorPairs] = useState(true);
  const [error, setError] = useState("");
  const toast = useToast();
  useEffect(() => {
    const unsubMembers = onSnapshot(collection(getDb(), "events", eventId, "members"), (snap) => {
      setMembers(snap.docs.map((item) => ({ id: item.id, displayName: String(item.data().displayName) })));
    });
    const unsubConstraints = onSnapshot(collection(getDb(), "events", eventId, "constraints"), (snap) => {
      setConstraints(snap.docs.map((item) => item.data()));
    });
    const unsubEvent = onSnapshot(doc(getDb(), "events", eventId), (snap) => {
      setAvoidPriorPairs(snap.data()?.avoidPriorPairs !== false);
    });
    return () => { unsubMembers(); unsubConstraints(); unsubEvent(); };
  }, [eventId]);
  const nameOf = (id: unknown) => members.find((member) => member.id === id)?.displayName ?? "Personne";
  const labelOf = (constraint: Record<string, unknown>) => {
    if (constraint.kind === "directional") return `${nameOf(constraint.fromId)} ne tire pas ${nameOf(constraint.toId)}`;
    if (constraint.kind === "reciprocal") return `${nameOf(constraint.aId)} et ${nameOf(constraint.bId)} ne se tirent pas`;
    if (constraint.kind === "group") return `Groupe fermé : ${(constraint.memberIds as string[]).map(nameOf).join(", ")}`;
    if (constraint.kind === "history") return `Historique : ${nameOf(constraint.fromId)} ne retire pas ${nameOf(constraint.toId)}`;
    return "Contrainte";
  };
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Règles et exclusions</h1>
      <p className="text-sm text-muted">Interdisez à une personne d'offrir à une autre, dans un seul sens ou dans les deux. Un groupe fermé ne se tire pas entre ses membres. Personne ne peut se tirer soi-même. Une exclusion enregistrée n'est jamais ignorée en silence.</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={avoidPriorPairs} onChange={(event) => setAvoidPriorPairs(event.target.checked)} />
        <span>Ne pas remettre les mêmes destinataires que lors des tirages précédents. La reconnaissance se fait par l'adresse e-mail, ou par le nom s'il est unique et sans adresse.</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectInput value={fromId} onChange={(event) => setFromId(event.target.value)}>
          <option value="">De</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
        </SelectInput>
        <SelectInput value={toId} onChange={(event) => setToId(event.target.value)}>
          <option value="">Vers</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
        </SelectInput>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => fromId && toId && fromId !== toId && setConstraints([...constraints, { kind: "directional", fromId, toId }])}>Exclure dans un sens</Button>
        <Button variant="secondary" onClick={() => fromId && toId && fromId !== toId && setConstraints([...constraints, { kind: "reciprocal", aId: fromId, bId: toId }])}>Exclure le couple</Button>
      </div>
      <fieldset className="space-y-2 rounded-3xl border border-line bg-card p-4">
        <legend className="px-2 text-sm text-muted">Groupe qui ne se tire pas entre ses membres</legend>
        {members.map((member) => (
          <label key={member.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={groupIds.includes(member.id)} onChange={(event) => setGroupIds(event.target.checked ? [...groupIds, member.id] : groupIds.filter((id) => id !== member.id))} />
            {member.displayName}
          </label>
        ))}
        <Button type="button" variant="secondary" onClick={() => {
          if (groupIds.length < 2) return;
          setConstraints([...constraints, { kind: "group", memberIds: groupIds }]);
          setGroupIds([]);
        }}>Ajouter ce groupe</Button>
      </fieldset>
      <ul className="space-y-2 text-sm">
        {constraints.map((constraint, index) => (
          <li key={index} className="flex justify-between gap-3 rounded-2xl bg-card px-3 py-2">
            <span>{labelOf(constraint)}</span>
            <Button type="button" variant="danger" onClick={() => setConstraints(constraints.filter((_, item) => item !== index))}>Retirer</Button>
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      <Button onClick={async () => {
        try { await call("setConstraints", { eventId, constraints, avoidPriorPairs }); toast("Règles enregistrées"); }
        catch (caught) { setError(errorText(caught)); }
      }}>Enregistrer</Button>
    </div>
  );
}

export function InvitationsPage({ eventId }: { eventId: string }) {
  return <RequireAuth><Invitations eventId={eventId} /></RequireAuth>;
}

function Invitations({ eventId }: { eventId: string }) {
  const [links, setLinks] = useState<Array<{ memberId: string; url: string }>>([]);
  const [joinUrl, setJoinUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Invitations</h1>
      <p className="text-sm text-muted">Le lien personnel est montré une fois. Un simple aperçu ne consomme pas l'invitation. En local, l'e-mail est capturé et n'est pas vraiment envoyé.</p>
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button busy={busy} onClick={async () => {
          setBusy(true);
          try {
            const result = await call<{ links: Array<{ memberId: string; url: string }> }>("createInvitations", { eventId, memberIds: [] });
            setLinks(result.links);
            toast(result.links.length ? "Liens créés" : "Aucun participant à inviter");
          } catch (caught) { setError(errorText(caught)); }
          finally { setBusy(false); }
        }}>Créer les liens personnels</Button>
        <Button variant="secondary" onClick={async () => {
          try {
            const result = await call<{ url: string }>("rotateJoinCode", { eventId });
            setJoinUrl(result.url);
          } catch (caught) { setError(errorText(caught)); }
        }}>Lien d'inscription au groupe</Button>
      </div>
      {joinUrl ? <p className="break-all rounded-2xl bg-card p-3 text-sm">{joinUrl}</p> : null}
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.memberId} className="break-all rounded-2xl bg-card p-3 text-sm">
            {link.url}
            <Button type="button" variant="secondary" className="mt-2" onClick={() => void navigator.clipboard.writeText(link.url)}>Copier</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MailPage({ eventId }: { eventId: string }) {
  return <RequireAuth><MailTheme eventId={eventId} /></RequireAuth>;
}

const MAIL_LABELS: Record<string, string> = {
  invitation: "Invitation",
  draw_ready: "Tirage prêt",
  invite_resent: "Invitation renvoyée",
  reminder_view: "Rappel de consultation",
  reminder_wishes: "Rappel de souhaits",
  new_message: "Nouveau message",
  info_changed: "Informations modifiées",
  reminder_event: "Rappel de date",
  reveal_available: "Révélation",
  cancellation: "Annulation",
};

function MailTheme({ eventId }: { eventId: string }) {
  const [tone, setTone] = useState<"tu" | "vous">("tu");
  const [palette, setPalette] = useState<PaletteId>("sapin");
  const [intro, setIntro] = useState("");
  const [signature, setSignature] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [subjects, setSubjects] = useState<Partial<Record<TemplateId, string>>>({});
  const [templateId, setTemplateId] = useState<TemplateId>("invitation");
  const [context, setContext] = useState<"family" | "friends" | "organization">("family");
  const [occasion, setOccasion] = useState<"christmas" | "annual" | "other">("other");
  const [rights, setRights] = useState({ logo: false, subjects: false });
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const toast = useToast();
  useEffect(() => {
    const unsubEvent = onSnapshot(doc(getDb(), "events", eventId), (snap) => {
      const data = snap.data() ?? {};
      const commercial = readCommercial(data);
      setContext(data.context === "friends" || data.context === "organization" ? data.context : "family");
      setOccasion(data.occasion === "christmas" || data.occasion === "annual" ? data.occasion : "other");
      setRights(emailOfferRights(commercial.offerId, commercial.status));
      setReady(true);
    }, (caught) => setError(errorText(caught)));
    const unsubTheme = onSnapshot(doc(getDb(), "events", eventId, "emailTheme", "current"), (snap) => {
      const data = snap.data();
      if (!data) return;
      if (data.tone === "tu" || data.tone === "vous") setTone(data.tone);
      if (data.palette === "sapin" || data.palette === "bordeaux" || data.palette === "soiree" || data.palette === "sobre") setPalette(data.palette);
      setIntro(String(data.intro ?? ""));
      setSignature(String(data.signature ?? ""));
      setLogoUrl(String(data.logoUrl ?? ""));
      setSubjects((data.subjectOverrides ?? {}) as Partial<Record<TemplateId, string>>);
    });
    return () => {
      unsubEvent();
      unsubTheme();
    };
  }, [eventId]);
  const defaults = templateCopy(context, tone);
  function currentTheme() {
    return {
      ...defaultTheme(context, occasion),
      tone,
      palette,
      intro,
      signature,
      logoUrl: rights.logo ? logoUrl : "",
      subjectOverrides: rights.subjects ? subjects : {},
    };
  }
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">E-mails de l'échange</h1>
      <p className="text-sm text-muted">L'aperçu et l'essai utilisent des prénoms, des liens et des consignes fictifs. Aucun jeton d'invitation ni aucune attribution n'y figure. Le HTML libre n'est pas accepté.</p>
      <Field label="Modèle">
        <SelectInput value={templateId} onChange={(event) => setTemplateId(event.target.value as TemplateId)}>
          {EVENT_TEMPLATE_IDS.map((id) => <option key={id} value={id}>{MAIL_LABELS[id] ?? id}</option>)}
        </SelectInput>
      </Field>
      <Field label="Ton">
        <SelectInput value={tone} onChange={(event) => setTone(event.target.value as "tu" | "vous")}>
          <option value="tu">Tutoiement</option>
          <option value="vous">Vouvoiement</option>
        </SelectInput>
      </Field>
      <Field label="Palette">
        <SelectInput value={palette} onChange={(event) => setPalette(event.target.value as PaletteId)}>
          <option value="sapin">Sapin</option>
          <option value="bordeaux">Bordeaux</option>
          <option value="soiree">Soirée</option>
          <option value="sobre">Sobre</option>
        </SelectInput>
      </Field>
      <Field label="Introduction"><TextArea value={intro} onChange={(event) => setIntro(event.target.value)} /></Field>
      <Field label="Signature"><TextInput value={signature} onChange={(event) => setSignature(event.target.value)} /></Field>
      {rights.subjects ? (
        <Field label="Objet de ce modèle" hint={`Défaut : ${defaults[templateId].subject}`}>
          <TextInput maxLength={140} value={subjects[templateId] ?? ""} placeholder={defaults[templateId].subject} onChange={(event) => setSubjects((current) => ({ ...current, [templateId]: event.target.value }))} />
        </Field>
      ) : <p className="text-sm text-muted">Les objets personnalisés sont inclus dans les offres Association, Entreprise et Entreprise Plus une fois payées. Les objets par défaut restent utilisés.</p>}
      {rights.logo ? (
        <Field label="Logo des e-mails" hint="Image de marque de cet événement, JPEG, PNG ou WebP, 2 Mo maximum.">
          <input className="block text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              const stored = storageObject(getBucket(), `events/${eventId}/brand/logo`);
              await uploadBytes(stored, file, { contentType: file.type });
              setLogoUrl(await getDownloadURL(stored));
              toast("Logo prêt à être enregistré");
            } catch (caught) { setError(errorText(caught)); }
          }} />
          {logoUrl ? <Button type="button" variant="danger" onClick={() => setLogoUrl("")}>Retirer le logo</Button> : null}
        </Field>
      ) : <p className="text-sm text-muted">Le logo dans les e-mails est inclus dans les offres Association, Entreprise et Entreprise Plus une fois payées.</p>}
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={async () => {
          try {
            const subjectOverrides = rights.subjects
              ? Object.fromEntries(Object.entries(subjects).filter((entry) => entry[1]?.trim()).map(([key, value]) => [key, value.trim().slice(0, 140)]))
              : {};
            await call("saveEmailTheme", { eventId, tone, palette, intro, signature, fromName: "", organizationName: "", teamName: "", logoUrl: rights.logo ? logoUrl : "", instructions: "", buttonLabel: "", replyToEnabled: false, subjectOverrides });
            toast("Thème enregistré pour les prochains envois");
          } catch (caught) { setError(errorText(caught)); }
        }}>Enregistrer</Button>
        <Button variant="secondary" onClick={() => {
          if (!ready) { setError("Le contexte de l'événement n'est pas encore chargé."); return; }
          try { setPreview(renderEmail(currentTheme(), templateId, PREVIEW_VARS).html); }
          catch (caught) { setError(errorText(caught)); }
        }}>Aperçu fictif</Button>
        <Button variant="secondary" onClick={async () => {
          try {
            const result = await call<{ status: string }>("sendTestEmail", { eventId, templateId });
            toast(result.status === "captured_locally" ? "Capturé localement — aucun e-mail envoyé" : result.status === "sent" ? "Accepté par Resend" : "L'essai n'a pas été accepté");
          } catch (caught) { setError(errorText(caught)); }
        }}>Envoyer un essai</Button>
      </div>
      <Modal open={Boolean(preview)} onOpenChange={() => setPreview("")} title="Aperçu" description="Données fictives, sans jeton réel.">
        <div className="max-h-96 overflow-auto rounded-2xl border border-line" dangerouslySetInnerHTML={{ __html: preview }} />
      </Modal>
    </div>
  );
}
