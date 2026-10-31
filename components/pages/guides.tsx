import Link from "next/link";
import { FaqJsonLd } from "@/components/seo-jsonld";

export interface GuideSection {
  title: string;
  paragraphs: string[];
}

export function GuideArticle({
  eyebrow,
  title,
  lead,
  sections,
  faq,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  sections: GuideSection[];
  faq: Array<{ q: string; a: string }>;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <nav className="text-sm text-muted" aria-label="Fil d'Ariane">
        <Link href="/" className="text-pine underline">Accueil</Link>
        <span aria-hidden="true"> · </span>
        <span>{title}</span>
      </nav>
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">{eyebrow}</p>
        <h1 className="font-serif text-4xl text-pine-deep md:text-5xl">{title}</h1>
        <p className="text-lg text-ink">{lead}</p>
      </header>
      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="font-serif text-2xl text-pine-deep">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-muted">{paragraph}</p>
          ))}
        </section>
      ))}
      <section className="space-y-3">
        <h2 className="font-serif text-2xl text-pine-deep">Questions fréquentes</h2>
        {faq.map((item) => (
          <section key={item.q} className="rounded-3xl border border-line bg-card p-5">
            <h3 className="font-serif text-xl">{item.q}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{item.a}</p>
          </section>
        ))}
      </section>
      <p className="text-sm text-muted">
        <Link href="/tarifs" className="text-pine underline">Voir les tarifs</Link>
        {" · "}
        <Link href="/aide" className="text-pine underline">Lire l'aide</Link>
        {" · "}
        <Link href="/evenements/nouveau" className="text-pine underline">Préparer un échange</Link>
      </p>
      <FaqJsonLd items={faq} />
    </article>
  );
}
