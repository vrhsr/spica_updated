package com.spicasg.app;

import android.app.Activity;
import android.util.Log;

import com.google.firebase.appdistribution.FirebaseAppDistribution;
import com.google.firebase.appdistribution.FirebaseAppDistributionException;

/**
 * Checks Firebase App Distribution for a newer release of this app and, if one
 * exists, shows Firebase's built-in "Update available" dialog with release notes,
 * download progress and a one-tap install prompt.
 *
 * This only ever finds releases pushed via `scripts/deploy-to-firebase.js`
 * (`firebase appdistribution:distribute`) to the "representatives" tester group —
 * it has no effect for a build installed from the Play Store.
 */
public final class UpdateManager {

    private static final String TAG = "UpdateManager";

    private UpdateManager() {
    }

    public static void checkForUpdate(Activity activity) {
        try {
            FirebaseAppDistribution.getInstance()
                    .updateIfNewReleaseAvailable()
                    .addOnFailureListener(e -> {
                        if (e instanceof FirebaseAppDistributionException) {
                            // Expected for signed-in-with-Play-Store installs, no network,
                            // or when the tester declines sign-in. Not an app error.
                            Log.i(TAG, "Update check skipped: " + e.getMessage());
                        } else {
                            Log.w(TAG, "Update check failed", e);
                        }
                    });
        } catch (Throwable t) {
            // Never let the updater take the app down with it.
            Log.w(TAG, "Update check unavailable", t);
        }
    }
}
