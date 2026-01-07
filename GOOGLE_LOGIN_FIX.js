// Add this function to handle Google Sign-In with native Capacitor plugin
// Replace the existing handleGoogleLogin function in rep-login/page.tsx with this:

const handleGoogleLogin = async () => {
    setError(null);
    setIsLoadingGoogle(true);
    if (!auth) {
        setError('Authentication service is not available.');
        setIsLoadingGoogle(false);
        return;
    }
    try {
        // Use native Google Auth in Capacitor app
        if (isCapacitorApp()) {
            // Initialize Google Auth
            await GoogleAuth.initialize({
                clientId: '731200978852-8mvn08dar40n0pr1u276hbgmlt9nsqjm.apps.googleusercontent.com',
                scopes: ['profile', 'email'],
                grantOfflineAccess: true,
            });

            // Sign in with native plugin
            const googleUser = await GoogleAuth.signIn();

            // Create Firebase credential
            const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
            const userCredential = await signInWithCredential(auth, credential);
            const user = userCredential.user;
            const idTokenResult = await user.getIdTokenResult();
            const role = idTokenResult.claims.role;

            if (role !== 'rep') {
                await auth.signOut();
                setError('Access denied. This portal is for Representatives only. Please use the Admin portal.');
                return;
            }

            router.push('/rep');
        } else {
            // Use web popup for browsers
            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;
            const idTokenResult = await user.getIdTokenResult();
            const role = idTokenResult.claims.role;

            if (role !== 'rep') {
                await auth.signOut();
                setError('Access denied. This portal is for Representatives only. Please use the Admin portal.');
                return;
            }

            router.push('/rep');
        }
    } catch (err: any) {
        handleAuthError(err);
    } finally {
        setIsLoadingGoogle(false);
    }
};
