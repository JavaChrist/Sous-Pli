import { AuthActionScreen } from "@/components/pages/auth-action";

export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string; oobCode?: string }> }) {
  const params = await searchParams;
  return <AuthActionScreen mode={params.mode ?? ""} code={params.oobCode ?? ""} />;
}
