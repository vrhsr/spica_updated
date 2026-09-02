#!/usr/bin/env node

/**
 * One-command Android release.
 *
 * Bumps android/app/version.properties (versionCode always increments so the
 * in-app UpdateManager can detect the new build), builds a signed release APK,
 * then pushes it to Firebase App Distribution's "representatives" group via
 * scripts/deploy-to-firebase.js. Testers with the app installed get an
 * automatic "Update available" prompt next time they open it.
 *
 * Usage:
 *   node scripts/release-android.js [versionName] ["release notes"]
 *
 * Examples:
 *   node scripts/release-android.js                              # bump build number only
 *   node scripts/release-android.js 1.1.0                        # bump version + build number
 *   node scripts/release-android.js 1.1.0 "Fixed login, added dark mode"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const ANDROID_DIR = path.join(PROJECT_ROOT, 'android');
const VERSION_PROPS_PATH = path.join(ANDROID_DIR, 'app', 'version.properties');

function readVersionProps() {
    const contents = fs.readFileSync(VERSION_PROPS_PATH, 'utf8');
    const props = {};
    for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^([A-Z_]+)=(.*)$/);
        if (match) props[match[1]] = match[2];
    }
    return props;
}

function writeVersionProps(props) {
    const contents = `VERSION_CODE=${props.VERSION_CODE}\nVERSION_NAME=${props.VERSION_NAME}\n`;
    fs.writeFileSync(VERSION_PROPS_PATH, contents, 'utf8');
}

function bumpVersion(newVersionName) {
    const props = readVersionProps();
    const nextCode = parseInt(props.VERSION_CODE || '1', 10) + 1;
    const nextName = newVersionName || props.VERSION_NAME || '1.0.0';
    writeVersionProps({ VERSION_CODE: String(nextCode), VERSION_NAME: nextName });
    console.log(`📈 Version bumped: ${nextName} (build ${nextCode})`);
    return { versionCode: nextCode, versionName: nextName };
}

function buildReleaseApk() {
    console.log('\n🔨 Building signed release APK...\n');
    // Absolute path avoids relying on the shell's current-directory search order,
    // which is inconsistent across cmd.exe/Git Bash invocations on Windows.
    const gradlew = path.join(ANDROID_DIR, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
    execSync(`"${gradlew}" assembleRelease`, { cwd: ANDROID_DIR, stdio: 'inherit' });
}

function deploy(releaseNotes) {
    console.log('\n🚀 Publishing to Firebase App Distribution...\n');
    const args = releaseNotes ? [JSON.stringify(releaseNotes)] : [];
    execSync(`node scripts/deploy-to-firebase.js ${args.join(' ')}`, {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
    });
}

function main() {
    const [versionNameArg, releaseNotesArg] = process.argv.slice(2);

    const { versionName, versionCode } = bumpVersion(versionNameArg);

    try {
        buildReleaseApk();
    } catch (error) {
        console.error('\n❌ Release build failed:', error.message);
        process.exit(1);
    }

    try {
        deploy(releaseNotesArg || `Version ${versionName} (build ${versionCode})`);
    } catch (error) {
        console.error('\n❌ Distribution failed:', error.message);
        console.log('\n💡 The APK still built successfully — you can retry distribution with:');
        console.log(`   node scripts/deploy-to-firebase.js "your release notes"\n`);
        process.exit(1);
    }

    console.log('\n✅ Release complete. Testers with the app installed will see an update prompt.\n');
}

main();
