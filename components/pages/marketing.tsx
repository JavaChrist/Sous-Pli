"use client";

import { appConfig } from "@shared/config";
import { Gift, Mail, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { call, errorText } from "@/lib/firebase/api";

export function HomePage() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Échange secret</p>
          <h1 className="mt-3 font-serif text-5xl leading-tight text-pine-deep md:text-6xl">{appConfig.name}</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">{appConfig.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/evenements/nouveau">Préparer un échange</ButtonLink>
            <ButtonLink variant="secondary" href="/aide">Comment ça marche</ButtonLink>
          </div>
        </div>
        <img src="/logo512.png" alt="Enveloppe cachetée, cadeau bordeaux et ruban doré, Sous pli" className="mx-auto w-full max-w-md rounded-[2rem]" />
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Préparer", "Nommez l'occasion, le budget et les personnes."],
          ["Inviter", "Un lien personnel ou une demande d'inscription, sans dévoiler le tirage."],
          ["Tirer au sort", "Le calcul reste sur le serveur. Chacun ne voit que son résultat."],
          ["Échanger", "Souhaits, messages anonymes, puis révélation quand vous l'ouvrez."],
        ].map(([title, text], index) => (
          <article key={title} className="rounded-3xl border border-line bg-card p-5">
            <p className="font-serif text-3xl text-gold">{index + 1}</p>
            <h2 className="mt-2 font-serif text-2xl">{title}</h2>
            <p className="mt-2 text-sm text-muted">{text}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          [ShieldCheck, "Secrets séparés", "Les attributions ne sont pas dans la fiche de l'événement lisible par tout le groupe."],
          [Mail, "Invitations distinctes", "Famille, amis ou organisation : le ton et les modèles changent."],
          [Users, "Sans obligation de compte", "Un participant peut rejoindre par lien, puis sécuriser sa session."],
        ].map(([Icon, title, text]) => (
          <article key={String(title)} className="rounded-3xl border border-line bg-card p-5">
            <Icon className="h-6 w-6 text-pine" />
            <h2 className="mt-3 font-serif text-2xl">{String(title)}</h2>
            <p className="mt-2 text-sm text-muted">{String(text)}</p>
          </article>
        ))}
      </section>
      <section className="rounded-3xl bg-pine px-6 py-8 text-white">
        <Gift className="h-7 w-7 text-gold" />
        <h2 className="mt-3 font-serif text-3xl">Le résultat se consulte sous pli</h2>
        <p className="mt-2 max-w-2xl text-white/80">Aucun nom tiré au sort dans les e-mails, les aperçus de liens ou les notifications. La révélation collective attend votre geste, à l'heure prévue dans le fuseau de l'échange.</p>
      </section>
    </div>
  );
}

export function HelpPage() {
  const questions = [
    ["Faut-il installer l'application ?", "Non. Le navigateur suffit. L'installation à l'écran d'accueil est proposée, jamais imposée."],
    ["L'organisateur voit-il les résultats ?", "En mode secret, non. Il suit les invitations, les consultations et les souhaits, pas les paires. Ce n'est pas un chiffrement qui empêcherait un administrateur technique de la base."],
    ["Un enfant peut-il participer ?", "Oui, via un adulte responsable. Cet adulte peut connaître le tirage de l'enfant : ce n'est pas un secret vis-à-vis de lui."],
    ["Que se passe-t-il si le tirage est impossible ?", "Rien n'est publié. L'organisateur reçoit une explication, par exemple une personne qui n'a plus assez de destinataires possibles."],
    ["Les e-mails contiennent-ils le destinataire ?", "Non. Le résultat se lit après connexion, dans l'espace protégé."],
  ];
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-serif text-4xl text-pine-deep">Aide</h1>
      {questions.map(([title, text]) => (
        <section key={title} className="rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">{title}</h2>
          <p className="mt-2 text-sm text-muted">{text}</p>
        </section>
      ))}
    </article>
  );
}

export function ContactPage() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <article className="mx-auto max-w-xl space-y-4">
      <h1 className="font-serif text-4xl text-pine-deep">Contact</h1>
      <p className="text-sm text-muted">Le message est enregistré. Aucun accusé n'est envoyé tant que la messagerie n'est pas configurée. Contact : {appConfig.supportEmailPlaceholder}.</p>
      <form
        className="space-y-4 rounded-3xl border border-line bg-card p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const form = new FormData(event.currentTarget);
          try {
            await call("submitContact", { name: form.get("name"), email: form.get("email"), message: form.get("message") });
            setStatus("Message enregistré. Aucun accusé n'est envoyé tant que la messagerie n'est pas configurée.");
            event.currentTarget.reset();
          } catch (caught) {
            setError(errorText(caught));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nom"><TextInput name="name" required maxLength={80} /></Field>
        <Field label="E-mail"><TextInput name="email" type="email" required /></Field>
        <Field label="Message"><TextArea name="message" required minLength={10} /></Field>
        {error ? <p className="text-sm text-burgundy">{error}</p> : null}
        {status ? <p className="text-sm text-pine">{status}</p> : null}
        <Button type="submit" busy={busy}>Envoyer</Button>
      </form>
    </article>
  );
}

export function OfflinePage() {
  return (
    <article className="mx-auto max-w-xl rounded-3xl border border-line bg-card p-6">
      <h1 className="font-serif text-4xl text-pine-deep">Hors connexion</h1>
      <p className="mt-3 text-sm text-muted">Le réseau manque. Les tirages, invitations et messages ne sont ni calculés ni simulés hors ligne. Réessayez lorsque la connexion revient.</p>
    </article>
  );
}

export function DeniedPage() {
  return (
    <article className="mx-auto max-w-xl rounded-3xl border border-line bg-card p-6">
      <h1 className="font-serif text-4xl text-pine-deep">Accès refusé</h1>
      <p className="mt-3 text-sm text-muted">Cette page ne fait pas partie de vos échanges, ou votre session n'a pas le droit de la lire.</p>
      <ButtonLink variant="secondary" className="mt-4" href="/evenements">Retour aux événements</ButtonLink>
    </article>
  );
}
