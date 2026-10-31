import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

const pages: Array<{ path: string; priority: number }> = [
  { path: "/", priority: 1 },
  { path: "/famille", priority: 0.9 },
  { path: "/entreprise", priority: 0.8 },
  { path: "/association", priority: 0.8 },
  { path: "/tarifs", priority: 0.8 },
  { path: "/aide", priority: 0.6 },
  { path: "/contact", priority: 0.4 },
  { path: "/confidentialite", priority: 0.3 },
  { path: "/conditions", priority: 0.3 },
  { path: "/mentions", priority: 0.3 },
  { path: "/sous-traitance", priority: 0.3 },
  { path: "/suppression-compte", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-10-31");
  return pages.map((page) => ({
    url: page.path === "/" ? siteUrl : `${siteUrl}${page.path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: page.priority,
  }));
}
