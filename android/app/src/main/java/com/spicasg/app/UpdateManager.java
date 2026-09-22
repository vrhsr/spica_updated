package com.spicasg.app;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import com.google.firebase.appdistribution.FirebaseAppDistribution;
import com.google.firebase.appdistribution.FirebaseAppDistributionException;

/**
 * Checks Firebase App Distribution for a newer release of this app and, if one
 * exists, shows Firebase's built-in "Update available" dialog with release notes,
 * download progress and a one-tap install prompt.
 *
 * This only ever finds releases pushed via `scripts/deploy-to-firebase.js`
 * (`firebase appdistribution:distribute`) to the "representatives" tester group.
 * For a build installed from the Play Store, this is skipped entirely (see
 * isInstalledFromPlayStore) — Firebase App Distribution's SDK doesn't just fail
 * silently for those installs like the name `updateIfNewReleaseAvailable`
 * implies; before it can even determine that, it drives an interactive
 * "sign in to test this app" / "enable testing features" browser flow on every
 * launch, which is confusing and pointless when Play Store already owns
 * updates for that install.
 */
public final class UpdateManager {

    private static final String TAG = "UpdateManager";

    private UpdateManager() {
    }

    public static void checkForUpdate(Activity activity) {
        if (isInstalledFromPlayStore(activity)) {
            Log.i(TAG, "Installed from Play Store — skipping Firebase App Distribution update check.");
            return;
        }
        try {
            FirebaseAppDistribution.getInstance()
                    .updateIfNewReleaseAvailable()
                    .addOnFailureListener(e -> {
                        if (e instanceof FirebaseAppDistributionException) {
                            // Expected when there's no network, or the tester declines sign-in.
                            // Not an app error.
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

    private static boolean isInstalledFromPlayStore(Activity activity) {
        try {
            String installer;
            PackageManager pm = activity.getPackageManager();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                installer = pm.getInstallSourceInfo(activity.getPackageName()).getInstallingPackageName();
            } else {
                installer = pm.getInstallerPackageName(activity.getPackageName());
            }
            return "com.android.vending".equals(installer);
        } catch (Throwable t) {
            // If we can't tell, default to allowing the Firebase check rather
            // than silently breaking update checks for sideloaded/App
            // Distribution testers.
            return false;
        }
    }
}
