/**
 * Capacitor Build Script
 *
 * Temporarily moves server-side code OUT OF THE PROJECT for static export,
 * then restores it after build.
 *
 * WHY THIS EXISTS: the Android app's cold-start entry point must work with
 * zero network — a rep opening the app with no signal needs to reach their
 * downloaded presentations, not Chromium's native "Webpage not available"
 * interstitial. That requires the entry shell (/, /rep/offline,
 * /rep/present/view, /rep/pdf/viewer, /login) to be bundled locally in the
 * APK rather than fetched from spicasg.in on every launch. See
 * capacitor.config.json (no `server.url` — Capacitor serves this local
 * export by default) and src/app/page.tsx's isCapacitorApp() branches,
 * which were written for exactly this and jump to the *live* site
 * (window.location.href) once the user actually logs in online, so the
 * authenticated dashboard still gets instant Vercel-deployed updates.
 *
 * For Capacitor mobile app (Rep-focused, offline-capable):
 * - Admin section excluded (requires server actions)
 * - API routes excluded (need a server)
 * - Firebase Admin SDK / Supabase (S3) client excluded (server-only)
 * - Server Actions under src/lib/actions excluded
 *
 * INCLUDED in mobile build:
 * - Landing page, rep login, rep dashboard, doctors, requests
 * - Offline dashboard + presenting from IndexedDB (the whole point)
 * - PDF viewer
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const BACKUP_ROOT = path.join(PROJECT_ROOT, '.capacitor-backup'); // Outside src

const FOLDERS_TO_MOVE = [
    // API routes (server-side only)
    { src: path.join(PROJECT_ROOT, 'src', 'app', 'api'), backup: path.join(BACKUP_ROOT, 'app-api') },
    // Admin section (uses server actions for user management / presentation generation)
    { src: path.join(PROJECT_ROOT, 'src', 'app', 'admin'), backup: path.join(BACKUP_ROOT, 'app-admin') },
    { src: path.join(PROJECT_ROOT, 'src', 'app', 'admin-login'), backup: path.join(BACKUP_ROOT, 'app-admin-login') },
    // First-time password setup — imports markInviteAccepted from
    // admin/users/actions.ts (Admin SDK). Always reached via an emailed
    // link and inherently a one-time online-only action, so it's fine for
    // this one path to not exist in the offline-capable local bundle; a
    // tap on that link opens fine in any regular browser, and this app
    // isn't registered as the default handler for it.
    { src: path.join(PROJECT_ROOT, 'src', 'app', 'accept-invite'), backup: path.join(BACKUP_ROOT, 'app-accept-invite') },
    // Server actions (Firebase Admin - server-side only)
    { src: path.join(PROJECT_ROOT, 'src', 'lib', 'actions'), backup: path.join(BACKUP_ROOT, 'lib-actions') },
    { src: path.join(PROJECT_ROOT, 'src', 'lib', 'firebaseAdmin.ts'), backup: path.join(BACKUP_ROOT, 'lib-firebaseAdmin.ts') },
    // Supabase S3 client ('use server', only used by generatePresentation.ts above)
    { src: path.join(PROJECT_ROOT, 'src', 'lib', 'supabase.ts'), backup: path.join(BACKUP_ROOT, 'lib-supabase.ts') },
];

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_ROOT)) {
        fs.mkdirSync(BACKUP_ROOT, { recursive: true });
    }
}

function moveServerCode() {
    console.log('📦 Temporarily moving server-side code for static export...');
    ensureBackupDir();
    for (const folder of FOLDERS_TO_MOVE) {
        if (fs.existsSync(folder.src)) {
            const parentDir = path.dirname(folder.backup);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }
            fs.renameSync(folder.src, folder.backup);
            console.log(`   ✓ Moved: ${path.relative(PROJECT_ROOT, folder.src)}`);
        }
    }
    console.log('');
}

function restoreServerCode() {
    console.log('📦 Restoring server-side code...');
    for (const folder of FOLDERS_TO_MOVE) {
        if (fs.existsSync(folder.backup)) {
            const parentDir = path.dirname(folder.src);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }
            fs.renameSync(folder.backup, folder.src);
            console.log(`   ✓ Restored: ${path.relative(PROJECT_ROOT, folder.src)}`);
        }
    }
    if (fs.existsSync(BACKUP_ROOT)) {
        try {
            fs.rmSync(BACKUP_ROOT, { recursive: true, force: true });
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

async function main() {
    // Safety: if a previous run crashed before restoring, don't silently
    // build on top of an already-mutated tree — fail loudly instead.
    if (fs.existsSync(BACKUP_ROOT)) {
        console.error(
            `❌ ${path.relative(PROJECT_ROOT, BACKUP_ROOT)} already exists — a previous ` +
            `build:capacitor run likely crashed before restoring. Resolve that manually ` +
            `(move its contents back) before running this again.`
        );
        process.exit(1);
    }

    try {
        moveServerCode();

        console.log('🔨 Building static export for Capacitor (offline-capable shell)...');
        console.log('   Included: landing page, login, rep dashboard, offline mode, PDF viewer/present');
        console.log('   Excluded: admin portal, API routes, server actions (server-only)');
        console.log('');

        execSync('npx next build', {
            stdio: 'inherit',
            env: { ...process.env, BUILD_TARGET: 'capacitor' },
        });

        console.log('');
        console.log('✅ Capacitor static export successful (out/)');
        console.log('');
        console.log('📱 Next steps:');
        console.log('   1. npm run cap:sync');
        console.log('   2. Build/release the APK as usual');
    } catch (error) {
        console.error('');
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    } finally {
        restoreServerCode();
    }
}

main();
