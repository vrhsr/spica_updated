/**
 * Capacitor Build Script
 * 
 * Temporarily moves server-side code OUT OF THE PROJECT for static export,
 * then restores it after build.
 * 
 * For Capacitor mobile app:
 * - API routes excluded (need server)
 * - Firebase Admin SDK excluded (need server)
 * - AI/Genkit excluded (need server)
 * 
 * INCLUDED in mobile build:
 * - Admin section (works with online connection)
 * - Representative pages
 * - Presentation viewing with [doctorId]
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
    // Server actions (Firebase Admin - server-side only)
    { src: path.join(PROJECT_ROOT, 'src', 'lib', 'actions'), backup: path.join(BACKUP_ROOT, 'lib-actions') },
    { src: path.join(PROJECT_ROOT, 'src', 'lib', 'firebaseAdmin.ts'), backup: path.join(BACKUP_ROOT, 'lib-firebaseAdmin.ts') },
    // AI/Genkit (server-side only)
    { src: path.join(PROJECT_ROOT, 'src', 'ai'), backup: path.join(BACKUP_ROOT, 'ai') },
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
        console.log('🔨 Building for Capacitor (mobile app with online features)...');
        console.log('   Features included: Admin, Rep Dashboard, Presentations, PDF Viewer');
        console.log('   Features excluded: API routes (server-side only)');
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
        console.error('❌ Build failed:', error.message);
        if (error.stdout) console.log(error.stdout.toString());
        if (error.stderr) console.error(error.stderr.toString());
        process.exit(1);
    } finally {
        // Always restore server code
        restoreServerCode();
    }
}

main();
