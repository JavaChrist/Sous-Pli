import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { appConfig } from "@shared/config";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import { siteUrl } from "@/lib/seo";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Secret Santa et tirage au sort de Noël", template: `%s · ${appConfig.name}` },
  description: "Tirage au sort de Noël en ligne. Secret Santa gratuit en famille, formules association et entreprise. Chacun découvre son destinataire sous pli.",
  applicationName: appConfig.name,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/apple-touch-icon-3d.png", sizes: "192x192" },
    ],
  },
  appleWebApp: { capable: true, title: appConfig.shortName, statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: appConfig.name,
    images: [{ url: "/logo512.png", width: 512, height: 512, alt: "Enveloppe cachetée, cadeau bordeaux et ruban doré, Sous pli" }],
  },
  twitter: { card: "summary", images: ["/logo512.png"] },
};

export const viewport: Viewport = {
  themeColor: appConfig.themeColor,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${outfit.variable} ${fraunces.variable} font-sans antialiased`}>
        <Providers>
          <Shell deploymentVersion={process.env.VERCEL_GIT_COMMIT_SHA ?? "dev"}>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
