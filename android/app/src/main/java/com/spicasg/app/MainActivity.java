package com.spicasg.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;
import java.util.Locale;

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

        // Opt in to edge-to-edge ourselves (this app's targetSdk already
        // forces it on Android 15+ anyway, but older OS versions on the
        // same APK wouldn't get it automatically) and forward the real
        // system-bar insets to the web layer as CSS custom properties. The
        // WebView does NOT reliably populate CSS env(safe-area-inset-*) the
        // way iOS Safari does, so the bottom tab bar (rep/layout.tsx) was
        // rendering flush with the screen edge and getting hidden behind
        // the 3-button/gesture nav bar. Web CSS reads these as
        // var(--android-inset-bottom) / var(--android-inset-top), with a
        // max() against env() so nothing changes on platforms where env()
        // already works.
        // NOTE ON THE KEYBOARD: opting into edge-to-edge here means
        // android:windowSoftInputMode="adjustResize" (AndroidManifest.xml)
        // no longer automatically shrinks the window when the keyboard
        // shows — that's an Android platform behavior, not a bug in this
        // app, but the two together used to mean the keyboard just
        // covered whatever input was focused (e.g. the login password
        // field) with nothing compensating. Fixed the same way as the
        // nav-bar inset above: also read the IME (keyboard) inset here
        // and forward its height as --android-keyboard-inset, which
        // src/app/login/page.tsx uses to shrink its own layout so the
        // focused field stays above the keyboard.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        final WebView insetWebView = this.bridge.getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(insetWebView, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            float density = getResources().getDisplayMetrics().density;
            float topPx = bars.top / density;
            float bottomPx = bars.bottom / density;
            float keyboardPx = ime.bottom / density;
            String js = String.format(Locale.US,
                    "document.documentElement.style.setProperty('--android-inset-top','%.1fpx');"
                            + "document.documentElement.style.setProperty('--android-inset-bottom','%.1fpx');"
                            + "document.documentElement.style.setProperty('--android-keyboard-inset','%.1fpx');",
                    topPx, bottomPx, keyboardPx);
            view.post(() -> ((WebView) view).evaluateJavascript(js, null));
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(insetWebView);

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
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Capacitor's own default WebViewClient hands any
                // top-level navigation to a domain other than this app's
                // own (local bundle) origin off to Android's Intent
                // system — which is exactly what was popping the
                // admin/manager handoff (login/page.tsx navigating to
                // https://spicasg.in/admin/dashboard) open in the
                // system's default browser (a full separate Chrome tab)
                // instead of staying in the app. Force any spicasg.in
                // navigation to load in THIS SAME WebView instead —
                // covers the admin/manager handoff, Firebase Auth email
                // action links, etc. Everything else keeps Capacitor's
                // normal handling.
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && host.contains("spicasg.in")) {
                    view.loadUrl(uri.toString());
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

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
