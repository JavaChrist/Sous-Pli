import { ProfilePage } from "@/components/pages/account";
import { noIndex } from "@/lib/seo";

export const metadata = noIndex;

export default function Page() {
  return <ProfilePage />;
}
