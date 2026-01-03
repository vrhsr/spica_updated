/**
 * Capacitor Build Script
 * 
 * Temporarily moves server-side code OUT OF THE PROJECT for static export,
 * then restores it after build.
 * 
 * For Capacitor (rep OFFLINE app only):
 * - API routes are not needed
 * - Admin section is not needed
 * - Server actions are not needed
 * - Requests page is excluded (has admin dependency + requires network)
 * - Dynamic [doctorId] route is excluded (static export limitation)
 *   → Presentations are accessed via offline page with searchParams
 * 
 * The Capacitor app focuses on: Dashboard, Sync, Offline PDFs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const BACKUP_ROOT = path.join(PROJECT_ROOT, '.capacitor-backup'); // Outside src

const FOLDERS_TO_MOVE = [
    // API routes
    { src: path.join(PROJECT_ROOT, 'src', 'app', 'api'), backup: path.join(BACKUP_ROOT, 'app-api') },
    // Admin section (server-side Firebase Admin SDK)
    { src: path.join(PROJECT_ROOT, 'src', 'app', 'admin'), backup: path.join(BACKUP_ROOT, 'app-admin') },
    { src: path.join(PROJECT_ROOT, 'src', 'app', 'admin-login'), backup: path.join(BACKUP_ROOT, 'app-admin-login') },
    // Server actions (Firebase Admin)
    { src: path.join(PROJECT_ROOT, 'src', 'lib', 'actions'), backup: path.join(BACKUP_ROOT, 'lib-actions') },
    { src: path.join(PROJECT_ROOT, 'src', 'lib', 'firebaseAdmin.ts'), backup: path.join(BACKUP_ROOT, 'lib-firebaseAdmin.ts') },
    // AI/Genkit (server-side)
    { src: path.join(PROJECT_ROOT, 'src', 'ai'), backup: path.join(BACKUP_ROOT, 'ai') },
    // Rep requests page (imports from admin, requires network)
    { src: path.join(PROJECT_ROOT, 'src', 'app', 'rep', 'requests'), backup: path.join(BACKUP_ROOT, 'app-rep-requests') },
    // Dynamic route [doctorId] (not compatible with static export)
    { src: path.join(PROJECT_ROOT, 'src', 'app', 'rep', 'present', '[doctorId]'), backup: path.join(BACKUP_ROOT, 'app-rep-present-doctorId') },
    // PDF viewer (uses API route)
    { src: path.join(PROJECT_ROOT, 'src', 'app', 'rep', 'pdf'), backup: path.join(BACKUP_ROOT, 'app-rep-pdf') },
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
            // Ensure parent backup dir exists
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
            // Ensure parent src dir exists
            const parentDir = path.dirname(folder.src);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }
            fs.renameSync(folder.backup, folder.src);
            console.log(`   ✓ Restored: ${path.relative(PROJECT_ROOT, folder.src)}`);
        }
    }
    // Clean up backup dir
    if (fs.existsSync(BACKUP_ROOT)) {
        try {
            fs.rmSync(BACKUP_ROOT, { recursive: true, force: true });
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

async function main() {
    try {
        // Move server code out of the way
        moveServerCode();

        // Set environment and build
        console.log('🔨 Building for Capacitor (static export - offline rep app)...');
        console.log('   Features included: Dashboard, Sync, Offline Page');
        console.log('   Features excluded: Admin, API, Requests, Dynamic Routes');
        console.log('');

        execSync('npx next build', {
            stdio: 'inherit',
            env: { ...process.env, BUILD_TARGET: 'capacitor' }
        });

        console.log('');
        console.log('✅ Capacitor build successful!');
        console.log('');
        console.log('📱 Next steps:');
        console.log('   1. npx cap sync android');
        console.log('   2. npx cap open android');
        console.log('   3. Run on device');
        console.log('   4. Test offline after sync');

    } catch (error) {
        console.error('');
        console.error('❌ Build failed');
        process.exit(1);
    } finally {
        // Always restore server code
        restoreServerCode();
    }
}

main();
