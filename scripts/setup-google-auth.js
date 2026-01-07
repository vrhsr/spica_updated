#!/usr/bin/env node

/**
 * Script to install and configure Google Auth for Capacitor
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Google Auth for Capacitor Android...\n');

// Step 1: Install Google Auth plugin
console.log('📦 Installing @codetrix-studio/capacitor-google-auth...');
try {
    execSync('npm install @codetrix-studio/capacitor-google-auth', { stdio: 'inherit' });
    console.log('✅ Google Auth plugin installed\n');
} catch (error) {
    console.error('❌ Failed to install Google Auth plugin');
    process.exit(1);
}

// Step 2: Check for google-services.json
console.log('🔍 Checking for google-services.json...');
const googleServicesPath = path.join(__dirname, '..', 'android', 'app', 'google-services.json');
if (fs.existsSync(googleServicesPath)) {
    console.log('✅ google-services.json found\n');
} else {
    console.log('⚠️  google-services.json NOT found!');
    console.log('Please download it from Firebase Console and place it at:');
    console.log(`   android/app/google-services.json\n`);
}

// Step 3: Sync Capacitor
console.log('🔄 Syncing Capacitor...');
try {
    execSync('npx cap sync android', { stdio: 'inherit' });
    console.log('✅ Capacitor synced\n');
} catch (error) {
    console.error('❌ Failed to sync Capacitor');
    process.exit(1);
}

// Step 4: Instructions
console.log('📋 Next Steps:');
console.log('1. Add SHA-1 fingerprint to Firebase Console');
console.log('   Run: cd android && ./gradlew signingReport');
console.log('2. Update MainActivity.java (see CAPACITOR_SETUP_GUIDE.md)');
console.log('3. Open Android Studio: npx cap open android');
console.log('4. Build and test on device\n');

console.log('✅ Setup complete! See CAPACITOR_SETUP_GUIDE.md for detailed instructions.');
