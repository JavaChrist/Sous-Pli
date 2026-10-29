package fr.javachrist.souspli;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.CancellationSignal;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "SousPliGoogle")
public class SousPliGooglePlugin extends Plugin {
    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = getContext().getString(R.string.google_web_client_id);
        if (clientId == null || clientId.isBlank()) {
            call.reject("La configuration Google Android est absente.", "missing-config");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("La connexion Google est indisponible.", "unavailable");
            return;
        }
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(clientId).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager manager = CredentialManager.create(activity);
        manager.getCredentialAsync(
            activity,
            request,
            new CancellationSignal(),
            Executors.newSingleThreadExecutor(),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    Credential credential = result.getCredential();
                    if (!(credential instanceof CustomCredential)) {
                        call.reject("Réponse Google inattendue.", "unexpected");
                        return;
                    }
                    CustomCredential custom = (CustomCredential) credential;
                    if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(custom.getType())) {
                        call.reject("Réponse Google inattendue.", "unexpected");
                        return;
                    }
                    try {
                        GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(custom.getData());
                        JSObject payload = new JSObject();
                        payload.put("idToken", google.getIdToken());
                        call.resolve(payload);
                    } catch (Exception ignored) {
                        call.reject("Réponse Google illisible.", "unexpected");
                    }
                }

                @Override
                public void onError(GetCredentialException error) {
                    String code = error instanceof GetCredentialCancellationException ? "canceled" : "failed";
                    call.reject("Connexion Google interrompue.", code);
                }
            }
        );
    }

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        String scheme = url.getScheme();
        if (!"mailto".equals(scheme) && !"tel".equals(scheme)) return null;
        try {
            getContext().startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (ActivityNotFoundException ignored) {
            return true;
        }
        return true;
    }
}
