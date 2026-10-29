"use client";

import { collection, doc, onSnapshot } from "firebase/firestore";
import { Building2, HeartHandshake, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useToast } from "@/components/providers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { call, errorText } from "@/lib/firebase/api";
import { getDb } from "@/lib/firebase/client";
import {
  CATALOG,
  amountDue,
  billingPolicy,
  formatEuros,
  priceLabel,
  readCommercial,
  type OfferId,
} from "@shared/billing";
import { ANDROID_PURCHASE_UNAVAILABLE, checkoutLaunch } from "@shared/native-shell";
import { accessEndInstant } from "@shared/retention";
import { formatInZone } from "@shared/time";
import { useShellPlatform } from "@/lib/native/shell";

export function PricingPage() {
  const [companySize, setCompanySize] = useState<"100" | "300" | "quote">("100");
  const [quote, setQuote] = useState({ name: "", email: "", organization: "", participants: "400", eventDate: "", need: "" });
  const [quoteMessage, setQuoteMessage] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const company = companySize === "300" ? CATALOG.business_plus : companySize === "quote" ? CATALOG.quote : CATALOG.business;
  return (
    <article className="space-y-8">
      <header className="max-w-3xl space-y-3">
        <h1 className="font-serif text-4xl text-pine-deep">Tarifs</h1>
        <p className="text-lg text-ink">{billingPolicy.promise}</p>
        <p className="text-sm text-muted">{billingPolicy.taxNote}</p>
        <p className="text-sm text-muted">{billingPolicy.preservedNote}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <PriceCard icon={HeartHandshake} offerId="family" />
        <PriceCard icon={Users} offerId="association" />
        <section className="flex flex-col rounded-3xl border border-line bg-card p-5">
          <Building2 className="h-6 w-6 text-pine" />
          <h2 className="mt-3 font-serif text-2xl">{company.title}</h2>
          <p className="mt-2 font-semibold text-pine-deep">{priceLabel(company.id)}</p>
          <Field label="Taille du groupe">
            <SelectInput value={companySize} onChange={(event) => setCompanySize(event.target.value as typeof companySize)}>
              <option value="100">Jusqu'à 100 participants : 19,90 €</option>
              <option value="300">Jusqu'à 300 participants : 39,90 €</option>
              <option value="quote">Plus de 300 : demander un devis</option>
            </SelectInput>
          </Field>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {company.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </section>
      </div>
      <p className="max-w-3xl text-sm text-muted">
        La sécurité, l'accessibilité, la suppression du compte et la protection des données ne sont pas réservées aux offres payées.
        Le contexte déclaré oriente les offres. Il n'est pas vérifié automatiquement.
        L'import, les exclusions et les relances sont disponibles pour toutes les formules. Le logo et les objets d'e-mail le sont pour Association, Entreprise et Entreprise Plus une fois le paiement confirmé.
      </p>
      <ButtonLink href="/evenements/nouveau">Préparer un événement</ButtonLink>
      {companySize === "quote" ? (
        <form className="max-w-xl space-y-3 rounded-3xl border border-line bg-card p-5" onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setQuoteError("");
          setQuoteMessage("");
          try {
            const result = await call<{ message: string }>("submitQuote", {
              ...quote,
              participants: Number(quote.participants),
            });
            setQuoteMessage(result.message);
          } catch (caught) {
            setQuoteError(errorText(caught));
          } finally {
            setBusy(false);
          }
        }}>
          <h2 className="font-serif text-2xl">Demande de devis</h2>
          <p className="text-sm text-muted">Aucun paiement n'est lancé. La demande est enregistrée. Un e-mail n'est annoncé que s'il part vraiment.</p>
          <Field label="Nom"><TextInput value={quote.name} onChange={(event) => setQuote({ ...quote, name: event.target.value })} required /></Field>
          <Field label="Adresse e-mail professionnelle"><TextInput type="email" value={quote.email} onChange={(event) => setQuote({ ...quote, email: event.target.value })} required /></Field>
          <Field label="Structure"><TextInput value={quote.organization} onChange={(event) => setQuote({ ...quote, organization: event.target.value })} required /></Field>
          <Field label="Nombre estimé de participants"><TextInput inputMode="numeric" value={quote.participants} onChange={(event) => setQuote({ ...quote, participants: event.target.value })} required /></Field>
          <Field label="Date de l'événement"><TextInput type="date" value={quote.eventDate} onChange={(event) => setQuote({ ...quote, eventDate: event.target.value })} required /></Field>
          <Field label="Besoin particulier"><TextArea value={quote.need} onChange={(event) => setQuote({ ...quote, need: event.target.value })} required /></Field>
          {quoteError ? <p className="text-sm text-burgundy">{quoteError}</p> : null}
          {quoteMessage ? <p className="text-sm text-pine">{quoteMessage}</p> : null}
          <Button type="submit" busy={busy}>Enregistrer la demande</Button>
        </form>
      ) : null}
    </article>
  );
}

function PriceCard({ icon: Icon, offerId }: { icon: typeof Users; offerId: "family" | "association" }) {
  const offer = CATALOG[offerId];
  return (
    <section className="flex flex-col rounded-3xl border border-line bg-card p-5">
      <Icon className="h-6 w-6 text-pine" />
      <h2 className="mt-3 font-serif text-2xl">{offer.title}</h2>
      <p className="mt-2 font-semibold text-pine-deep">{priceLabel(offerId)}</p>
      <p className="mt-2 text-sm text-muted">{offer.summary}</p>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        {offer.points.map((point) => <li key={point}>{point}</li>)}
      </ul>
    </section>
  );
}

export function CheckoutPage({ eventId }: { eventId: string }) {
  return <RequireAuth><Checkout eventId={eventId} /></RequireAuth>;
}

export function PaymentPrompt({
  eventId,
  open,
  onOpenChange,
  description = "L'événement est enregistré. Fermer cette fenêtre reporte le paiement. Le tirage attend la confirmation du serveur.",
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Paiement"
      description={description}
      busy={busy}
    >
      {open ? <Checkout eventId={eventId} embedded onLater={() => onOpenChange(false)} onBusy={setBusy} /> : null}
    </Modal>
  );
}

function Checkout({
  eventId,
  embedded = false,
  onLater,
  onBusy,
}: {
  eventId: string;
  embedded?: boolean;
  onLater?: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const toast = useToast();
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [offerId, setOfferId] = useState<OfferId>("family");
  const [accepted, setAccepted] = useState(false);
  const [acceptedProcessing, setAcceptedProcessing] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const platform = useShellPlatform();
  function setPaying(next: boolean) {
    setBusy(next);
    onBusy?.(next);
  }
  useEffect(() => onSnapshot(doc(getDb(), "events", eventId), (snap) => {
    if (!snap.exists()) {
      setError("Échange introuvable.");
      return;
    }
    const data = snap.data();
    setEvent(data);
    const commercial = readCommercial(data);
    setOfferId(commercial.offerId);
  }, (caught) => setError(errorText(caught))), [eventId]);
  if (error && !event) return <ErrorState>{error}</ErrorState>;
  if (!event) return <LoadingState />;
  const context = event.context === "organization" ? "organization" : event.context === "friends" ? "friends" : "family";
  const choices = (Object.values(CATALOG)).filter((offer) => offer.contexts.includes(context));
  const selected = CATALOG[offerId];
  const due = amountDue({ offerId, paidOfferId: readCommercial(event).paidOfferId, eventStatus: String(event.status ?? "draft") });
  return (
    <form className={embedded ? "space-y-4" : "mx-auto max-w-2xl space-y-4"} onSubmit={async (formEvent) => {
      formEvent.preventDefault();
      setPaying(true);
      setError("");
      try {
        await call("selectOffer", { eventId, offerId });
        if (selected.priceCents === null) {
          setInfo("Cette formule se traite sur devis. Aucun paiement n'a été lancé.");
          return;
        }
        if (selected.priceCents === 0) {
          setInfo("L'offre Famille & amis est incluse. Le tirage se lance ensuite, séparément.");
          toast("Offre enregistrée");
          return;
        }
        const route = checkoutLaunch(platform, due.kind);
        if (route === "android-unavailable") {
          setInfo(ANDROID_PURCHASE_UNAVAILABLE);
          return;
        }
        if (route !== "mollie") {
          setInfo(due.kind === "settled" ? "Cette offre est déjà payée." : due.message);
          return;
        }
        const result = await call<{ status: string; url: string | null; mode?: string }>("createCheckout", { eventId, acceptedTerms: accepted, acceptedProcessing });
        if (result.url && platform === "web") window.location.assign(result.url);
        else setInfo(result.status === "settled" ? "Cette offre est déjà payée." : "Aucun paiement n'est dû.");
      } catch (caught) {
        setError(errorText(caught));
      } finally {
        setPaying(false);
      }
    }}>
      {embedded ? null : <h1 className="font-serif text-4xl text-pine-deep">Offre et paiement</h1>}
      <p className="text-sm text-muted">{String(event.name)} · {billingPolicy.promise}</p>
      <Field label="Offre">
        <SelectInput value={offerId} onChange={(input) => { setOfferId(input.target.value as OfferId); setAccepted(false); setAcceptedProcessing(false); }}>
          {choices.map((offer) => <option key={offer.id} value={offer.id}>{offer.title} — {priceLabel(offer.id)} — {offer.capacity ? `${offer.capacity} participants` : "plus de 300"}</option>)}
        </SelectInput>
      </Field>
      <div className={embedded ? "space-y-1 text-sm" : "rounded-3xl border border-line bg-card p-5 text-sm"}>
        <p>Événement : {String(event.name)}</p>
        <p>Offre : {selected.title}</p>
        <p>Capacité : {selected.capacity ? `${selected.capacity} participants` : "sur devis, au-delà de 300"}</p>
        <p>Prix final de cette étape : {due.kind === "quote" ? "Sur devis" : formatEuros(due.cents)}</p>
        <p>{due.message}</p>
        <p className="mt-2 text-muted">Aucun frais de plateforme n'est ajouté. {billingPolicy.taxNote}</p>
        {checkoutLaunch(platform, due.kind) === "mollie" ? <p className="mt-2 text-muted">La suite s'ouvre chez Mollie. Aucune carte n'est enregistrée dans Sous pli. Le retour sur cette application ne débloque pas l'offre : le serveur relit l'état du paiement.</p> : null}
        {checkoutLaunch(platform, due.kind) === "android-unavailable" ? <p className="mt-2 text-muted">{ANDROID_PURCHASE_UNAVAILABLE}</p> : null}
        <p className="mt-2 text-muted">{accessText(event)}</p>
        {offerId === "business_plus" ? <p className="mt-2 text-muted">Si Entreprise est déjà payée, le serveur demande 20 €, la différence annoncée, et ignore tout autre montant.</p> : null}
      </div>
      {due.cents > 0 ? (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={accepted} onChange={(input) => setAccepted(input.target.checked)} />
          <span>J'accepte les conditions applicables à cet achat. {billingPolicy.withdrawalNote} <Link className="text-pine" href="/conditions">Lire les conditions.</Link></span>
        </label>
      ) : null}
      {due.cents > 0 && context === "organization" ? (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={acceptedProcessing} onChange={(input) => setAcceptedProcessing(input.target.checked)} />
          <span>J'accepte l'annexe de sous-traitance pour les données traitées sur instruction de l'organisation. Cette case est distincte des conditions générales et ne vaut pas consentement à la prospection. <Link className="text-pine" href="/sous-traitance">Lire l'annexe.</Link></span>
        </label>
      ) : null}
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      {info ? <p className="text-sm text-pine">{info}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onLater ? <Button type="button" variant="secondary" onClick={onLater} disabled={busy}>Plus tard</Button> : null}
        <Button type="submit" busy={busy} disabled={checkoutLaunch(platform, due.kind) === "mollie" && (!accepted || (context === "organization" && !acceptedProcessing))}>{checkoutLaunch(platform, due.kind) === "android-unavailable" ? "Enregistrer sans achat" : "Continuer"}</Button>
      </div>
      <p className="text-sm text-muted">{billingPolicy.invoiceNote}</p>
    </form>
  );
}

export function PaymentReturnPage({ paymentId }: { paymentId: string }) {
  return <RequireAuth><Return paymentId={paymentId} /></RequireAuth>;
}

function accessText(event: Record<string, unknown>): string {
  const zone = String(event.timeZone ?? "Europe/Paris");
  const stored = event.accessUntil as { toDate?: () => Date } | undefined;
  try {
    const instant = stored?.toDate?.() ?? (event.localDate ? accessEndInstant(String(event.localDate), zone) : null);
    if (!instant) return "La fin d'accès suit la date de l'événement.";
    const when = formatInZone(instant, zone);
    return `Accès pendant la préparation, jusqu'au ${when.date} à ${when.time} (${zone}). Un report ne repousse pas cette échéance.`;
  } catch {
    return "La fin d'accès suit la date et le fuseau de l'événement.";
  }
}

function Return({ paymentId }: { paymentId: string }) {
  const [status, setStatus] = useState("pending");
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState("");
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const result = await call<{ status: string; eventId: string; canRequestWithdrawal?: boolean }>("getPaymentStatus", { paymentId });
        if (stopped) return;
        setStatus(result.status);
        setEventId(result.eventId);
        setCanWithdraw(result.canRequestWithdrawal === true);
        if (result.status === "pending") window.setTimeout(() => void poll(), 2000);
      } catch (caught) {
        if (!stopped) setError(errorText(caught));
      }
    }
    void poll();
    return () => { stopped = true; };
  }, [paymentId]);
  const copy: Record<string, string> = {
    pending: "Confirmation du paiement en cours. Cette page ne débloque pas l'offre.",
    succeeded: "Le serveur a confirmé le paiement. Le tirage n'est pas lancé : c'est une action séparée.",
    failed: "Le paiement a échoué. L'événement n'a pas été modifié.",
    canceled: "Le paiement est annulé. L'événement n'a pas été modifié.",
    expired: "Le paiement a expiré. L'événement n'a pas été modifié.",
    refunded: "Le remboursement a été confirmé par le serveur. Les options payantes de cette commande cessent. Les attributions déjà réalisées ne sont pas redistribuées.",
  };
  return (
    <article className="mx-auto max-w-xl space-y-3">
      <h1 className="font-serif text-4xl text-pine-deep">Paiement</h1>
      {error ? <ErrorState>{error}</ErrorState> : <p className="text-sm text-muted">{copy[status] ?? "Statut en attente de confirmation serveur."}</p>}
      {canWithdraw ? (
        <Button
          busy={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const result = await call<{ message: string }>("requestWithdrawal", { paymentId });
              setNote(result.message);
              setCanWithdraw(false);
            } catch (caught) {
              setError(errorText(caught));
            } finally {
              setBusy(false);
            }
          }}
        >
          Demander la rétractation
        </Button>
      ) : null}
      {note ? <p className="text-sm text-pine">{note}</p> : null}
      {eventId ? <ButtonLink variant="secondary" href={`/evenements/${eventId}`}>Revenir à l'événement</ButtonLink> : null}
    </article>
  );
}

export function TeamProgress({ eventId }: { eventId: string }) {
  const [teams, setTeams] = useState<Array<{ label: string; members: number; discovered: number }>>([]);
  useEffect(() => onSnapshot(doc(getDb(), "events", eventId, "teamProgress", "summary"), (snap) => {
    setTeams((snap.data()?.teams as Array<{ label: string; members: number; discovered: number }>) ?? []);
  }), [eventId]);
  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">Progression par équipe</h2>
      <p className="mt-1 text-sm text-muted">Comptages seulement. Les attributions restent cachées, y compris pour les coorganisateurs.</p>
      {teams.length === 0 ? <p className="mt-2 text-sm text-muted">Les compteurs apparaissent après l'enregistrement des participants.</p> : null}
      <ul className="mt-3 space-y-1 text-sm">
        {teams.map((team) => <li key={team.label}>{team.label} : {team.discovered} sur {team.members} ont consulté leur résultat.</li>)}
      </ul>
    </section>
  );
}

export function CoOrganizers({ eventId }: { eventId: string }) {
  const [email, setEmail] = useState("");
  const [rows, setRows] = useState<Array<{ id: string; email?: string }>>([]);
  const [error, setError] = useState("");
  useEffect(() => onSnapshot(collection(getDb(), "events", eventId, "coOrganizers"), (snap) => {
    setRows(snap.docs.map((item) => ({ id: item.id, email: String(item.data().email ?? "") })));
  }), [eventId]);
  return (
    <section className="space-y-3 rounded-3xl border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">Coorganisateurs</h2>
      <p className="text-sm text-muted">Ils gèrent l'événement sans voir les attributions. Une personne qui ne participe pas au tirage ne compte pas dans la capacité.</p>
      <div className="flex flex-wrap gap-2">
        <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="adresse du compte" />
        <Button onClick={async () => {
          try {
            await call("addCoOrganizer", { eventId, email });
            setEmail("");
            setError("");
          } catch (caught) { setError(errorText(caught)); }
        }}>Ajouter</Button>
      </div>
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3">
            <span>{row.email}</span>
            <Button type="button" variant="danger" onClick={() => void call("removeCoOrganizer", { eventId, uid: row.id })}>Retirer</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TestPaymentPage({ paymentId }: { paymentId: string }) {
  return <RequireAuth><TestNotice paymentId={paymentId} /></RequireAuth>;
}

function TestNotice({ paymentId }: { paymentId: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(outcome: "succeeded" | "failed" | "canceled" | "refunded") {
    setBusy(true);
    setError("");
    try {
      const result = await call<{ status: string }>("simulateProviderNotice", { paymentId, outcome });
      setMessage(`Avis enregistré. Statut serveur : ${result.status}. La page de retour ne fait pas cette confirmation.`);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="mx-auto max-w-xl space-y-4">
      <h1 className="font-serif text-4xl text-pine-deep">Avis de test</h1>
      <p className="text-sm text-muted">Ceci simule la notification du prestataire dans l'émulateur. Aucune carte n'est demandée et aucun débit réel n'existe. Le montant vient de la commande serveur.</p>
      <div className="flex flex-wrap gap-2">
        <Button busy={busy} onClick={() => void send("succeeded")}>Confirmer le paiement</Button>
        <Button busy={busy} variant="secondary" onClick={() => void send("failed")}>Signaler un échec</Button>
        <Button busy={busy} variant="secondary" onClick={() => void send("canceled")}>Annuler</Button>
        <Button busy={busy} variant="danger" onClick={() => void send("refunded")}>Confirmer un remboursement</Button>
      </div>
      {message ? <p className="text-sm text-pine">{message}</p> : null}
      {error ? <p className="text-sm text-burgundy">{error}</p> : null}
      <ButtonLink variant="secondary" href={`/paiement/retour?payment=${paymentId}`}>Voir la page de retour, qui ne valide rien</ButtonLink>
    </article>
  );
}
