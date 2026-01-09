/**
 * Script to set admin role for a user
 * Usage: node scripts/set-admin-role.js <email>
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '..', 'studio-6785763299-c920b-firebase-adminsdk-fbsvc-f5a4eb7171.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function setAdminRole(email) {
    try {
        // Get user by email
        const user = await admin.auth().getUserByEmail(email);
        console.log(`Found user: ${user.email} (UID: ${user.uid})`);

        // Set custom claims
        await admin.auth().setCustomUserClaims(user.uid, {
            role: 'admin'
        });

        console.log(`✅ Successfully set admin role for ${email}`);
        console.log('The user needs to sign out and sign in again for changes to take effect.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error setting admin role:', error.message);
        process.exit(1);
    }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
    console.error('Usage: node scripts/set-admin-role.js <email>');
    console.error('Example: node scripts/set-admin-role.js mvrhsr@gmail.com');
    process.exit(1);
}

setAdminRole(email);
