package com.spicasg.app;

import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    private boolean hasRetriedAfterLoadError = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Register Google Auth plugin
        registerPlugin(GoogleAuth.class);

        // Prompt for an app update if a newer release has been pushed to
        // Firebase App Distribution (see scripts/deploy-to-firebase.js).
        UpdateManager.checkForUpdate(this);

        // Work around a cold-start race: the very first main-frame
        // navigation to spicasg.in can be dispatched before the WebView's
        // Service Worker has finished registering/activating, so it goes
        // straight to the network instead of being caught by our
        // offline-capable SW. Online, nobody notices (the network fetch
        // just succeeds); offline, it surfaces as Chromium's raw "Webpage
        // not available" page instead of the app's own cached experience
        // (which is what reps need to view already-downloaded
        // presentations without a connection). One retry gives the SW time
        // to come up so the reload gets served from cache/fallback instead.
        this.bridge.getWebView().setWebViewClient(new BridgeWebViewClient(this.bridge) {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame() && !hasRetriedAfterLoadError) {
                    hasRetriedAfterLoadError = true;
                    view.postDelayed(view::reload, 400);
                }
            }
        });
    }
}
