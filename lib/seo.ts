import type { Metadata } from "next";

export const siteUrl = "https://souspli.fr";

export const noIndex: Metadata = {
  robots: { index: false, follow: false },
};

export function pageMetadata(input: { title: string; description: string; path: string; absolute?: boolean }): Metadata {
  const url = input.path === "/" ? siteUrl : `${siteUrl}${input.path}`;
  return {
    title: input.absolute ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      url,
      siteName: "Sous pli",
      title: input.title,
      description: input.description,
      images: [{ url: "/logo512.png", width: 512, height: 512, alt: "Enveloppe cachetée, cadeau bordeaux et ruban doré, Sous pli" }],
    },
    twitter: {
      card: "summary",
      title: input.title,
      description: input.description,
      images: ["/logo512.png"],
    },
  };
}
