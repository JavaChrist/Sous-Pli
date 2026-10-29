package fr.javachrist.souspli;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "SousPliFiles")
public class SousPliFilesPlugin extends Plugin {
    @PluginMethod
    public void saveText(PluginCall call) {
        String filename = call.getString("filename", "sous-pli-export.json");
        String mime = call.getString("mime", "application/json");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "saveTextResult");
    }

    @ActivityCallback
    private void saveTextResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Enregistrement annulé.", "canceled");
            return;
        }
        Uri uri = result.getData().getData();
        if (uri == null) {
            call.reject("Aucun emplacement choisi.", "canceled");
            return;
        }
        String text = call.getString("text", "");
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri)) {
            if (stream == null) {
                call.reject("Enregistrement impossible.", "failed");
                return;
            }
            stream.write(text.getBytes(StandardCharsets.UTF_8));
            call.resolve();
        } catch (IOException ignored) {
            call.reject("Enregistrement impossible.", "failed");
        }
    }
}
