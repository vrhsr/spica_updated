#!/usr/bin/env node

/**
 * Deploy to Firebase App Distribution
 * Usage: node scripts/deploy-to-firebase.js "Optional release notes"
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_ID = '1:731200978852:android:8cb38e71a3f21160a7cb31';
const APK_PATH = path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

console.log('🚀 Deploying to Firebase App Distribution...\n');

// Check if APK exists
if (!fs.existsSync(APK_PATH)) {
    console.error('❌ APK not found at:', APK_PATH);
    console.log('\n📝 Please build the RELEASE APK first:');
    console.log('   1. Open Android Studio (run: npx cap open android)');
    console.log('   2. Build → Generate Signed Bundle / APK');
    console.log('   3. Select APK → Create release APK');
    console.log('   4. Sign it with your keystore');
    console.log('   5. Then run this script again\n');
    console.log('💡 Or build release APK from command line:');
    console.log('   cd android && ./gradlew assembleRelease\n');
    process.exit(1);
}

// Get release notes from command line arg or use default
const releaseNotes = process.argv[2] || 'Bug fixes and improvements';

try {
    console.log('📝 Release notes:', releaseNotes);
    console.log('\n📤 Uploading APK to Firebase...\n');

    const command = `firebase appdistribution:distribute "${APK_PATH}" --app "${APP_ID}" --groups "representatives" --release-notes "${releaseNotes}"`;

    execSync(command, { stdio: 'inherit' });

    console.log('\n✅ Successfully deployed to Firebase App Distribution!');
    console.log('📧 Representatives will receive email notifications about the new version.\n');

} catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('   1. Installed Firebase CLI: npm install -g firebase-tools');
    console.log('   2. Logged in: firebase login');
    console.log('   3. Created a "representatives" group in Firebase Console');
    console.log('   4. Built a RELEASE APK (not debug)\n');
    process.exit(1);
}
