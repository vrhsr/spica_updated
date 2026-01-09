/**
 * Script to verify user's custom claims
 * Usage: node scripts/verify-user-claims.js <email>
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '..', 'studio-6785763299-c920b-firebase-adminsdk-fbsvc-f5a4eb7171.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function verifyUserClaims(email) {
    try {
        // Get user by email
        const user = await admin.auth().getUserByEmail(email);
        console.log(`\n✅ Found user: ${user.email}`);
        console.log(`UID: ${user.uid}`);
        console.log(`\nCustom Claims:`);
        console.log(JSON.stringify(user.customClaims, null, 2));

        if (!user.customClaims || !user.customClaims.role) {
            console.log('\n⚠️  WARNING: No custom claims set! Setting admin role now...\n');
            await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
            console.log('✅ Admin role has been set. User must sign out and sign in again.');
        } else {
            console.log(`\n✅ User has role: ${user.customClaims.role}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

const email = process.argv[2];

if (!email) {
    console.error('Usage: node scripts/verify-user-claims.js <email>');
    process.exit(1);
}

verifyUserClaims(email);
