"use client";

import { appConfig } from "@shared/config";
import { Bell, CalendarDays, Gift, House, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { signOutClear, useAuth } from "./providers";
import { InstallPrompt, UpdateManager } from "./pwa";

const items = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/evenements", label: "Événements", icon: CalendarDays },
  { href: "/participations", label: "Participations", icon: Gift },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profil", label: "Profil", icon: UserRound },
];

export function Shell({ children, deploymentVersion }: { children: ReactNode; deploymentVersion: string }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const logged = Boolean(user);

  return (
    <div className="min-h-screen">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
        Aller au contenu
      </a>
      <header className="safe-top sticky top-0 z-40 border-b border-line/80 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" width={44} height={44} className="h-11 w-11 rounded-xl" />
            <span className="font-serif text-2xl leading-none text-pine-deep">{appConfig.name}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            {(logged ? items : [{ href: "/", label: "Accueil", icon: House }, { href: "/aide", label: "Aide", icon: House }, { href: "/tarifs", label: "Tarifs", icon: House }]).map((item) => (
              <Link key={item.href} href={item.href} className={cn("rounded-full px-3 py-2 text-sm", pathname === item.href ? "bg-pine text-white" : "text-ink hover:bg-white")}>
                {item.label}
              </Link>
            ))}
            </nav>
          {!logged ? (
            <Link href="/connexion" className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-white">
              Connexion
            </Link>
          ) : null}
        </div>
      </header>
      <div className={cn("mx-auto w-full max-w-6xl", logged && "md:grid md:grid-cols-[16rem_minmax(0,1fr)]")}>
        {logged ? (
          <aside className="hidden border-r border-line px-4 py-6 md:block">
            <nav className="space-y-1" aria-label="Espace personnel">
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2 text-sm", active ? "bg-pine text-white" : "hover:bg-white")}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        ) : null}
        <main id="contenu" className={cn("min-w-0 px-4 py-8 sm:px-6", logged && "pb-28 md:pb-10")}>
          {user && user.email && !user.emailVerified && !user.isAnonymous ? (
            <p className="mb-6 rounded-2xl border border-line bg-card p-4 text-sm">
              Adresse non vérifiée. Tu peux consulter l'aide, renvoyer le message depuis le profil et te déconnecter. Les actions d'organisateur qui exigent une adresse vérifiée restent en attente.
              {" "}
              <Link className="font-semibold text-pine" href="/profil">Profil</Link>
              {" · "}
              <Link className="font-semibold text-pine" href="/aide">Aide</Link>
              {" · "}
              <button type="button" className="font-semibold text-pine" onClick={() => void signOutClear()}>Se déconnecter</button>
            </p>
          ) : null}
          {children}
          <footer className="mt-10 flex flex-wrap gap-4 border-t border-line pt-6 text-sm text-muted">
            <Link href="/aide">Aide</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/tarifs">Tarifs</Link>
            <Link href="/confidentialite">Confidentialité</Link>
            <Link href="/conditions">Conditions</Link>
            <Link href="/sous-traitance">Sous-traitance</Link>
            <Link href="/mentions">Mentions</Link>
          </footer>
        </main>
      </div>
      {logged ? (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur md:hidden" aria-label="Navigation mobile">
          <ul className="grid grid-cols-5">
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]", active ? "text-pine" : "text-muted")}>
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
      <UpdateManager pageVersion={deploymentVersion} />
      <InstallPrompt />
    </div>
  );
}
