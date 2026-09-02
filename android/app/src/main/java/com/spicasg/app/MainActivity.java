package com.spicasg.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Register Google Auth plugin
        registerPlugin(GoogleAuth.class);

        // Prompt for an app update if a newer release has been pushed to
        // Firebase App Distribution (see scripts/deploy-to-firebase.js).
        UpdateManager.checkForUpdate(this);
    }
}
