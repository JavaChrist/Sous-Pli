import { BUILD_VERSION } from "@shared/build-version";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ version: BUILD_VERSION }, { headers: { "Cache-Control": "no-store" } });
}
