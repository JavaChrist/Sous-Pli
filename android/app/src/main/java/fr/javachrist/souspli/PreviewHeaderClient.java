package fr.javachrist.souspli;

import android.net.Uri;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Map;

/** Ajoute l’en-tête de prévisualisation uniquement à l’origine choisie pour le build debug. */
public class PreviewHeaderClient extends BridgeWebViewClient {
    private final String trustedHost;
    private final String protectionHeader;

    public PreviewHeaderClient(Bridge bridge, String protectionHeader) {
        super(bridge);
        String serverUrl = bridge.getServerUrl();
        String host = "";
        if (serverUrl != null && !serverUrl.isBlank()) {
            host = Uri.parse(serverUrl).getHost();
        }
        this.trustedHost = host == null ? "" : host;
        this.protectionHeader = protectionHeader == null ? "" : protectionHeader.trim();
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        String host = url.getHost();
        boolean loopback = "10.0.2.2".equals(host) || "127.0.0.1".equals(host) || "localhost".equalsIgnoreCase(host);
        boolean trusted = host != null && host.equalsIgnoreCase(trustedHost) && !"souspli.fr".equalsIgnoreCase(host);
        if (!trusted || loopback || !"https".equalsIgnoreCase(url.getScheme()) || protectionHeader.isEmpty() || !"GET".equals(request.getMethod())) {
            return super.shouldInterceptRequest(view, request);
        }
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url.toString()).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            for (Map.Entry<String, String> header : request.getRequestHeaders().entrySet()) {
                connection.setRequestProperty(header.getKey(), header.getValue());
            }
            connection.setRequestProperty("x-vercel-trusted-oidc-idp-token", protectionHeader);
            String cookie = CookieManager.getInstance().getCookie(url.toString());
            if (cookie != null) connection.setRequestProperty("Cookie", cookie);
            connection.connect();
            List<String> cookies = connection.getHeaderFields().get("Set-Cookie");
            if (cookies != null) {
                for (String value : cookies) CookieManager.getInstance().setCookie(url.toString(), value);
            }
            int status = connection.getResponseCode();
            String type = connection.getContentType() == null ? "text/plain" : connection.getContentType();
            String mime = type.split(";")[0].trim();
            String encoding = connection.getContentEncoding();
            return new WebResourceResponse(
                mime,
                encoding,
                status,
                status >= 400 ? "error" : "OK",
                Map.of("Cache-Control", "no-store"),
                status >= 400 ? connection.getErrorStream() : connection.getInputStream()
            );
        } catch (IOException error) {
            if (connection != null) connection.disconnect();
            return super.shouldInterceptRequest(view, request);
        }
    }
}
