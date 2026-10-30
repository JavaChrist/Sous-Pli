import { App } from "@capacitor/app";
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { call } from "@/lib/firebase/api";
import { shellPlatform } from "@/lib/native/shell";

interface PlayNativePlugin {
  queryProducts(options: { productIds: string[] }): Promise<{ products: Array<{ productId: string; formattedPrice: string }> }>;
  launchPurchase(options: { productId: string; obfuscatedAccountId: string; obfuscatedProfileId: string }): Promise<{
    cancelled?: boolean;
    owned?: boolean;
    purchaseToken?: string;
    productId?: string;
    state?: "purchased" | "pending";
  }>;
  queryOwned(): Promise<{ purchases: Array<{ productId: string; purchaseToken: string; state: "purchased" | "pending" }> }>;
}

const PlayNative = registerPlugin<PlayNativePlugin>("SousPliBilling");

export async function loadPlayPrice(productId: string): Promise<string | null> {
  if (shellPlatform() !== "android") return null;
  try {
    const result = await PlayNative.queryProducts({ productIds: [productId] });
    const match = result.products.find((product) => product.productId === productId && product.formattedPrice);
    return match?.formattedPrice ?? null;
  } catch {
    return null;
  }
}

export async function startPlayCheckout(input: {
  eventId: string;
  acceptedTerms: boolean;
  acceptedProcessing: boolean;
}): Promise<"succeeded" | "pending" | "cancelled"> {
  const order = await call<{
    productId: string;
    obfuscatedAccountId: string;
    obfuscatedProfileId: string;
  }>("createPlayOrder", input);
  const launched = await PlayNative.launchPurchase({
    productId: order.productId,
    obfuscatedAccountId: order.obfuscatedAccountId,
    obfuscatedProfileId: order.obfuscatedProfileId,
  });
  if (launched.cancelled) return "cancelled";
  if (launched.owned) {
    await resumePlayPurchases();
    return "pending";
  }
  if (!launched.purchaseToken || !launched.productId) return "cancelled";
  const submitted = await call<{ status: string }>("submitPlayPurchase", {
    purchaseToken: launched.purchaseToken,
    productId: launched.productId,
  });
  return submitted.status === "succeeded" ? "succeeded" : "pending";
}

export async function resumePlayPurchases(): Promise<void> {
  if (shellPlatform() !== "android") return;
  try {
    const owned = await PlayNative.queryOwned();
    await call("reconcilePlayPurchases", {
      purchases: owned.purchases.filter((purchase) => purchase.purchaseToken && purchase.productId).map((purchase) => ({
        purchaseToken: purchase.purchaseToken,
        productId: purchase.productId,
      })),
    });
  } catch {
    return;
  }
}

export function watchPlayResume(): () => void {
  if (shellPlatform() !== "android") return () => undefined;
  void resumePlayPurchases();
  let handle: PluginListenerHandle | undefined;
  void App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) void resumePlayPurchases();
  }).then((value) => {
    handle = value;
  });
  return () => {
    void handle?.remove();
  };
}
