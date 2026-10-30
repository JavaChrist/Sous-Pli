package fr.javachrist.souspli;

import android.app.Activity;
import android.util.Log;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.ProductDetailsResponseListener;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "SousPliBilling")
public class SousPliBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billing;
    private PluginCall launchCall;
    private final Map<String, ProductDetails> products = new HashMap<>();

    @Override
    public void load() {
        billing = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
    }

    @Override
    protected void handleOnDestroy() {
        if (billing != null) billing.endConnection();
    }

    @PluginMethod
    public void queryProducts(PluginCall call) {
        JSArray ids = call.getArray("productIds");
        List<String> productIds = new ArrayList<>();
        if (ids != null) {
            for (int i = 0; i < ids.length(); i += 1) {
                String id = ids.optString(i, "");
                if (!id.isBlank()) productIds.add(id);
            }
        }
        if (productIds.isEmpty()) {
            call.resolve(new JSObject().put("products", new JSArray()));
            return;
        }
        withClient(call, () -> query(call, productIds));
    }

    @PluginMethod
    public void launchPurchase(PluginCall call) {
        String productId = call.getString("productId", "");
        String accountId = call.getString("obfuscatedAccountId", "");
        String profileId = call.getString("obfuscatedProfileId", "");
        if (!opaque(accountId) || !opaque(profileId) || productId.isBlank()) {
            call.reject("La commande Google Play est incomplète.", "invalid");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Google Play est indisponible.", "unavailable");
            return;
        }
        withClient(call, () -> launch(call, activity, productId, accountId, profileId));
    }

    @PluginMethod
    public void queryOwned(PluginCall call) {
        withClient(call, () -> billing.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("Les achats Google Play n'ont pas pu être relus.", codeName(result.getResponseCode()));
                    return;
                }
                JSArray rows = new JSArray();
                for (Purchase purchase : purchases) {
                    if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED && purchase.getPurchaseState() != Purchase.PurchaseState.PENDING) continue;
                    if (purchase.getProducts().isEmpty()) continue;
                    JSObject row = new JSObject();
                    row.put("productId", purchase.getProducts().get(0));
                    row.put("purchaseToken", purchase.getPurchaseToken());
                    row.put("state", purchase.getPurchaseState() == Purchase.PurchaseState.PENDING ? "pending" : "purchased");
                    rows.put(row);
                }
                JSObject payload = new JSObject();
                payload.put("purchases", rows);
                call.resolve(payload);
            }
        ));
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        PluginCall call = launchCall;
        launchCall = null;
        if (call == null) return;
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            JSObject payload = new JSObject();
            payload.put("cancelled", true);
            call.resolve(payload);
            return;
        }
        if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            JSObject payload = new JSObject();
            payload.put("owned", true);
            call.resolve(payload);
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            Log.w("SousPliBilling", "Achat non abouti, code " + code);
            call.reject("L'achat Google Play n'a pas abouti.", codeName(code));
            return;
        }
        Purchase purchase = purchases.get(0);
        JSObject payload = new JSObject();
        payload.put("productId", purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0));
        payload.put("purchaseToken", purchase.getPurchaseToken());
        payload.put("state", purchase.getPurchaseState() == Purchase.PurchaseState.PENDING ? "pending" : "purchased");
        call.resolve(payload);
    }

    private void withClient(PluginCall call, Runnable ready) {
        if (billing.isReady()) {
            ready.run();
            return;
        }
        billing.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) ready.run();
                else call.reject("Google Play est indisponible sur cet appareil.", "unavailable");
            }

            @Override
            public void onBillingServiceDisconnected() {
                Log.i("SousPliBilling", "Service Play déconnecté.");
            }
        });
    }

    private void query(PluginCall call, List<String> productIds) {
        List<QueryProductDetailsParams.Product> requested = new ArrayList<>();
        for (String id : productIds) {
            requested.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id)
                .setProductType(BillingClient.ProductType.INAPP)
                .build());
        }
        billing.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(requested).build(),
            new ProductDetailsResponseListener() {
                @Override
                public void onProductDetailsResponse(BillingResult result, QueryProductDetailsResult detailsResult) {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        call.reject("Les produits Google Play sont indisponibles.", codeName(result.getResponseCode()));
                        return;
                    }
                    JSArray rows = new JSArray();
                    for (ProductDetails details : detailsResult.getProductDetailsList()) {
                        products.put(details.getProductId(), details);
                        String price = formattedPrice(details);
                        if (price.isBlank()) continue;
                        JSObject row = new JSObject();
                        row.put("productId", details.getProductId());
                        row.put("formattedPrice", price);
                        rows.put(row);
                    }
                    JSObject payload = new JSObject();
                    payload.put("products", rows);
                    call.resolve(payload);
                }
            }
        );
    }

    private void launch(PluginCall call, Activity activity, String productId, String accountId, String profileId) {
        ProductDetails details = products.get(productId);
        if (details != null) {
            openFlow(call, activity, details, accountId, profileId);
            return;
        }
        billing.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(List.of(
                QueryProductDetailsParams.Product.newBuilder().setProductId(productId).setProductType(BillingClient.ProductType.INAPP).build()
            )).build(),
            (result, detailsResult) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || detailsResult.getProductDetailsList().isEmpty()) {
                    call.reject("Ce produit Google Play est indisponible.", "unavailable");
                    return;
                }
                ProductDetails loaded = detailsResult.getProductDetailsList().get(0);
                products.put(loaded.getProductId(), loaded);
                openFlow(call, activity, loaded, accountId, profileId);
            }
        );
    }

    private void openFlow(PluginCall call, Activity activity, ProductDetails details, String accountId, String profileId) {
        List<ProductDetails.OneTimePurchaseOfferDetails> offers = details.getOneTimePurchaseOfferDetailsList();
        if (offers == null || offers.isEmpty()) {
            call.reject("Ce produit Google Play n'a pas d'offre achetable.", "unavailable");
            return;
        }
        BillingFlowParams.ProductDetailsParams.Builder product = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details);
        String offerToken = offers.get(0).getOfferToken();
        if (offerToken != null && !offerToken.isBlank()) product.setOfferToken(offerToken);
        BillingFlowParams params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(List.of(product.build()))
            .setObfuscatedAccountId(accountId)
            .setObfuscatedProfileId(profileId)
            .build();
        launchCall = call;
        activity.runOnUiThread(() -> {
            BillingResult result = billing.launchBillingFlow(activity, params);
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                launchCall = null;
                call.reject("La feuille Google Play n'a pas pu s'ouvrir.", codeName(result.getResponseCode()));
            }
        });
    }

    private static String formattedPrice(ProductDetails details) {
        List<ProductDetails.OneTimePurchaseOfferDetails> offers = details.getOneTimePurchaseOfferDetailsList();
        if (offers == null || offers.isEmpty()) return "";
        String price = offers.get(0).getFormattedPrice();
        return price == null ? "" : price;
    }

    private static boolean opaque(String value) {
        return value != null && value.matches("[A-Za-z0-9_-]{8,64}");
    }

    private static String codeName(int code) {
        return switch (code) {
            case BillingClient.BillingResponseCode.BILLING_UNAVAILABLE -> "unavailable";
            case BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> "unavailable";
            case BillingClient.BillingResponseCode.DEVELOPER_ERROR -> "developer";
            case BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE -> "unavailable";
            case BillingClient.BillingResponseCode.NETWORK_ERROR -> "network";
            default -> "failed";
        };
    }
}
