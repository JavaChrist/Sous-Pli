import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-serif text-4xl text-pine-deep">Page introuvable</h1>
      <p className="text-sm text-muted">Ce lien ne correspond à aucune page de Sous pli.</p>
      <Link href="/" className="font-semibold text-pine">Retour à l'accueil</Link>
    </div>
  );
}
