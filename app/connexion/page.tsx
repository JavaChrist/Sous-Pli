import { AuthScreen } from "@/components/pages/auth";
import { noIndex } from "@/lib/seo";

export const metadata = noIndex;

export default function Page() {
  return <AuthScreen mode="login" />;
}
