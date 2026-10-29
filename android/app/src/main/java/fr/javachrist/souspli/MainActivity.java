package fr.javachrist.souspli;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SousPliGooglePlugin.class);
        registerPlugin(SousPliFilesPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge != null && bridge.getWebView() != null) {
            String header = getString(R.string.vercel_protection_header);
            bridge.getWebView().setWebViewClient(new PreviewHeaderClient(bridge, header));
        }
    }
}
