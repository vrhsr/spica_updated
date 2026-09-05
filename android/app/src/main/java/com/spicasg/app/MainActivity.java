package com.spicasg.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    private boolean hasRetriedAfterLoadError = false;
    private volatile boolean isShowingLoadError = false;
    private ConnectivityManager.NetworkCallback networkCallback;

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
                if (request.isForMainFrame()) {
                    isShowingLoadError = true;
                    if (!hasRetriedAfterLoadError) {
                        hasRetriedAfterLoadError = true;
                        view.postDelayed(view::reload, 400);
                    }
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // A successful load (including one that lands on the app's
                // own offline.html/offline-dashboard fallback) clears the
                // error flag and resets the one-shot retry for next time.
                isShowingLoadError = false;
                hasRetriedAfterLoadError = false;
            }
        });

        // If that error page is still showing when connectivity comes back,
        // reload automatically instead of leaving the rep stuck on
        // Chromium's static "Webpage not available" page until they
        // force-close and reopen the app — a WebView error page doesn't
        // retry itself just because the network came back.
        ConnectivityManager connectivityManager =
                (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager != null) {
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    if (isShowingLoadError) {
                        runOnUiThread(() -> {
                            if (isShowingLoadError) {
                                bridge.getWebView().reload();
                            }
                        });
                    }
                }
            };
            NetworkRequest request = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build();
            connectivityManager.registerNetworkCallback(request, networkCallback);
        }
    }

    @Override
    public void onDestroy() {
        if (networkCallback != null) {
            ConnectivityManager connectivityManager =
                    (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (connectivityManager != null) {
                try {
                    connectivityManager.unregisterNetworkCallback(networkCallback);
                } catch (IllegalArgumentException ignored) {
                    // Callback was already unregistered — not a real error.
                }
            }
        }
        super.onDestroy();
    }
}
