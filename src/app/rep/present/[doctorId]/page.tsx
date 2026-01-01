'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X, Loader } from 'lucide-react';
import { getPresentationOffline, isAvailableOffline } from '@/lib/offline-storage';
import { useToast } from '@/hooks/use-toast';

export default function PresentationViewerPage() {
    const params = useParams();
    const router = useRouter();
    const doctorId = params.doctorId as string;
    const { toast } = useToast();

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        setIsOffline(!navigator.onLine);

        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        loadPresentation();
    }, [doctorId]);

    const loadPresentation = async () => {
        setLoading(true);

        try {
            const isSaved = isAvailableOffline(doctorId);

            if (!isSaved) {
                toast({
                    variant: 'destructive',
                    title: 'Presentation Not Available',
                    description: 'Please save this presentation offline first.',
                });
                setLoading(false);
                return;
            }

            const blob = await getPresentationOffline(doctorId);
            if (!blob) {
                throw new Error('Failed to load PDF');
            }

            // Create object URL from blob
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            setLoading(false);
        } catch (error) {
            console.error('Error loading presentation:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load presentation.',
            });
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
        }

        // If in bypass mode, go back to offline dashboard
        const isBypass = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('mode') === 'bypass';
        if (isBypass) {
            router.push('/rep/offline');
        } else {
            router.back();
        }
    };

    const enterFullscreen = () => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        }
    };

    useEffect(() => {
        if (!loading && pdfUrl) {
            enterFullscreen();
        }
    }, [loading, pdfUrl]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <Loader className="h-12 w-12 animate-spin text-white" />
                <p className="ml-4 text-white">Loading presentation...</p>
            </div>
        );
    }

    if (!pdfUrl) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="text-center text-white">
                    <p className="text-xl">Presentation not available</p>
                    <Button variant="outline" className="mt-4" onClick={handleClose}>
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-screen w-full bg-black overflow-hidden">
            {/* Header Controls */}
            <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between bg-black/90 p-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="text-white hover:bg-white/20"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                {isOffline && (
                    <div className="rounded bg-destructive px-3 py-1 text-xs font-semibold text-white">
                        OFFLINE MODE
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="text-white hover:bg-white/20"
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* PDF Viewer - Using browser's native PDF viewer */}
            <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                className="h-full w-full border-0"
                title="Presentation Viewer"
            />

            {/* Instructions overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/70 rounded-lg px-4 py-2 text-white text-sm">
                💡 Use the PDF controls to navigate slides
            </div>
        </div>
    );
}
