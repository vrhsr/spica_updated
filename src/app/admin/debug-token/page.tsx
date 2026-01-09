'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TokenDebugPage() {
    const auth = useAuth();
    const [tokenInfo, setTokenInfo] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const checkToken = async () => {
        if (!auth?.currentUser) {
            setTokenInfo({ error: 'No user logged in' });
            return;
        }

        try {
            const idTokenResult = await auth.currentUser.getIdTokenResult();
            setTokenInfo({
                uid: auth.currentUser.uid,
                email: auth.currentUser.email,
                claims: idTokenResult.claims,
                role: idTokenResult.claims.role || 'NOT SET'
            });
        } catch (error: any) {
            setTokenInfo({ error: error.message });
        }
    };

    const forceRefreshToken = async () => {
        if (!auth?.currentUser) {
            alert('No user logged in');
            return;
        }

        setLoading(true);
        try {
            // Force refresh the ID token
            await auth.currentUser.getIdToken(true);
            alert('Token refreshed! Please check your claims again.');
            await checkToken();
        } catch (error: any) {
            alert('Error refreshing token: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkToken();
    }, [auth]);

    return (
        <div className="container mx-auto p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Firebase Token Debug</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="font-semibold">Current Token Info:</h3>
                        <pre className="bg-slate-100 p-4 rounded text-xs overflow-auto">
                            {JSON.stringify(tokenInfo, null, 2)}
                        </pre>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={checkToken}>Check Token</Button>
                        <Button onClick={forceRefreshToken} disabled={loading}>
                            {loading ? 'Refreshing...' : 'Force Refresh Token'}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                auth?.signOut();
                                window.location.href = '/admin-login';
                            }}
                        >
                            Sign Out
                        </Button>
                    </div>

                    <div className="text-sm text-muted-foreground">
                        <p><strong>Instructions:</strong></p>
                        <ol className="list-decimal ml-4 space-y-1">
                            <li>Check if "role" is set to "admin" in the claims above</li>
                            <li>If NOT, click "Force Refresh Token"</li>
                            <li>If still not working, click "Sign Out" and sign in again</li>
                        </ol>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
