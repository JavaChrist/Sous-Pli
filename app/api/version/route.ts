export const dynamic = "force-dynamic";

/** Commit du déploiement en cours. Vercel fournit le SHA ; en local la valeur reste « dev ». */
export function GET() {
  return Response.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
