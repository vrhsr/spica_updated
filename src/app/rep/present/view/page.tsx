'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X, Loader, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { getOfflinePDF, hasOfflinePDF } from '@/lib/offline-pdf-store';
import { useToast } from '@/hooks/use-toast';
import { useOfflineReady } from '@/hooks/useOfflineReady';
import * as pdfjsLib from 'pdfjs-dist';
import { App } from '@capacitor/app';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar, Style } from '@capacitor/status-bar';
import { saveVisitLog } from '@/lib/visit-logs-store';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Configure PDF.js worker - use local worker file for offline support
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

function PresentationViewerContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const doctorId = searchParams.get('id') || '';
    const { toast } = useToast();
    const { isReady: isDBReady, isLoading: isDBLoading, error: dbError } = useOfflineReady();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [doctorName, setDoctorName] = useState<string>('');
    const [showExitDialog, setShowExitDialog] = useState(false);

    // Touch gesture handling
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);

    useEffect(() => {
        setIsOffline(!navigator.onLine);

        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Lock screen orientation to landscape and go full screen
        const enterPresentationMode = async () => {
            try {
                await ScreenOrientation.lock({ orientation: 'landscape' });
                await StatusBar.hide();
            } catch (error) {
                console.log('Presentation mode setup skipped - not supported in this environment');
            }
        };
        enterPresentationMode();

        // Hardware Back Button Handling (Capacitor)
        let backListener: any;
        const setupBackListener = async () => {
            backListener = await App.addListener('backButton', () => {
                handleClose();
            });
        };
        setupBackListener();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (backListener) backListener.remove();
            
            const exitPresentationMode = async () => {
                try {
                    await ScreenOrientation.unlock();
                    await StatusBar.show();
                } catch (error) {}
            };
            exitPresentationMode();
        };
    }, []);

    useEffect(() => {
        // Wait for IndexedDB to be ready before loading
        if (!isDBReady || !doctorId) return;
        loadPresentation();
    }, [doctorId, isDBReady]);

    const loadPresentation = async () => {
        setLoading(true);

        try {
            const isSaved = await hasOfflinePDF(doctorId);

            if (!isSaved) {
                toast({
                    variant: 'destructive',
                    title: 'Presentation Not Available',
                    description: 'Please save this presentation offline first.',
                });
                setLoading(false);
                return;
            }

            const record = await getOfflinePDF(doctorId);
            if (!record) {
                throw new Error('Failed to load PDF record');
            }

            // Capture doctor name for feedback dialog
            setDoctorName(record.doctorName || 'Doctor');

            // GUARDRAILS - Smart Sync
            if (record.state === 'FAILED') {
                toast({
                    variant: 'destructive',
                    title: 'Sync Failed',
                    description: 'This presentation failed to download properly. Please retry the "Start Day" sync.',
                });
                setLoading(false);
                return;
            }

            if (record.state === 'STALE') {
                toast({
                    className: "bg-amber-100 border-amber-500 text-amber-900",
                    title: 'Presentation Outdated',
                    description: 'You are viewing an older version. Please sync when online.',
                });
            }

            // Load PDF with PDF.js using an Object URL
            const pdfUrl = URL.createObjectURL(record.fileBlob);
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;

            setPdfDoc(pdf);
            setTotalPages(pdf.numPages);
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

    const renderPage = useCallback(async (pageNumber: number) => {
        if (!pdfDoc || !canvasRef.current) return;

        try {
            const page = await pdfDoc.getPage(pageNumber);
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (!context) return;

            // Calculate scale to fit screen
            const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
            const containerHeight = containerRef.current?.clientHeight || window.innerHeight;

            const viewport = page.getViewport({ scale: 1 });
            const scaleX = containerWidth / viewport.width;
            const scaleY = containerHeight / viewport.height;
            const scale = Math.min(scaleX, scaleY) * 0.95;

            const scaledViewport = page.getViewport({ scale });

            canvas.height = scaledViewport.height;
            canvas.width = scaledViewport.width;

            await page.render({
                canvasContext: context,
                viewport: scaledViewport,
            }).promise;
        } catch (error) {
            console.error('Error rendering page:', error);
        }
    }, [pdfDoc]);

    useEffect(() => {
        if (pdfDoc && currentPage) {
            renderPage(currentPage);
        }
    }, [pdfDoc, currentPage, renderPage]);

    const goToPrevPage = useCallback(() => {
        setCurrentPage(p => Math.max(1, p - 1));
    }, []);

    const goToNextPage = useCallback(() => {
        setCurrentPage(p => Math.min(totalPages, p + 1));
    }, [totalPages]);

    const handleClose = () => {
        // For online presentations, show confirmation dialog
        if (navigator.onLine) {
            setShowExitDialog(true);
        } else {
            // Offline: redirect without asking
            window.location.replace('/rep/offline');
        }
    };

    const handlePresentationConfirm = async (didPresent: boolean) => {
        setShowExitDialog(false);

        if (didPresent) {
            // User confirmed they presented - save visit log
            await saveVisitLog(doctorId, 'VISITED', doctorName);
        }

        // Use router to navigate without hard reloading the app
        router.replace('/rep');
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const deltaX = touchEndX - touchStartX.current;
        const deltaY = touchEndY - touchStartY.current;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX > 0) {
                goToPrevPage();
            } else {
                goToNextPage();
            }
        }
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const canvasWidth = rect.width;

        if (clickX < canvasWidth / 3) {
            goToPrevPage();
        } else if (clickX > (canvasWidth * 2) / 3) {
            goToNextPage();
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                goToNextPage();
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goToPrevPage();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [goToNextPage, goToPrevPage]);

    if (!doctorId) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="text-center text-white">
                    <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
                    <p className="text-xl">No presentation selected</p>
                    <Button variant="outline" className="mt-4" onClick={() => router.push('/rep/offline')}>
                        Go to Offline Mode
                    </Button>
                </div>
            </div>
        );
    }

    if (dbError) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="text-center text-white">
                    <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
                    <p className="text-xl">Storage Error</p>
                    <p className="text-sm text-gray-400 mt-2 max-w-sm">
                        Unable to access offline storage.
                    </p>
                    <Button variant="outline" className="mt-4" onClick={() => router.push('/rep/offline')}>
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    if (isDBLoading || loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <Loader className="h-12 w-12 animate-spin text-white" />
                <p className="ml-4 text-white">
                    {isDBLoading ? 'Initializing storage...' : 'Loading presentation...'}
                </p>
            </div>
        );
    }

    if (!pdfDoc) {
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
        <div
            ref={containerRef}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black overflow-hidden"
            style={{
                // No safe area padding when in full screen presentation mode
                paddingTop: 0,
                paddingBottom: 0,
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-black/90 p-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="text-white hover:bg-white/20 focus:ring-0 focus-visible:ring-0"
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
                    className="text-white hover:bg-white/20 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* PDF Canvas */}
            <div className="flex-grow flex h-full w-full items-center justify-center px-2 pb-24 pt-20">
                <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full object-contain cursor-pointer"
                    onClick={handleCanvasClick}
                />
            </div>

            {/* Bottom Control Bar */}
            <div
                className="absolute left-0 right-0 z-10 flex items-center justify-center"
                style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
            >
                <div className="flex items-center gap-3 rounded-full bg-black/50 p-2 shadow-lg backdrop-blur-sm border border-white/20 text-white">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        className="text-white hover:bg-red-500/50 hover:text-white focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        title="Exit Presentation"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                    <div className="w-px h-6 bg-white/20" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={goToPrevPage}
                        disabled={currentPage <= 1}
                        className="text-white hover:bg-white/20 hover:text-white disabled:opacity-30 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <span className="text-sm font-medium tabular-nums min-w-[60px] text-center">
                        {currentPage} / {totalPages}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={goToNextPage}
                        disabled={currentPage >= totalPages}
                        className="text-white hover:bg-white/20 hover:text-white disabled:opacity-30 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </Button>
                </div>
            </div>

            {/* Navigation Tip (first slide only) */}
            {currentPage === 1 && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-black/70 rounded-lg px-6 py-3 text-white text-sm text-center max-w-md">
                    <p className="font-semibold mb-1">Navigation Tips:</p>
                    <p className="text-xs">• Swipe left/right to change slides</p>
                    <p className="text-xs">• Tap left/right side of screen</p>
                    <p className="text-xs">• Use buttons below or arrow keys</p>
                </div>
            )}

            {/* Presentation Confirmation Dialog */}
            <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl">Presentation Complete</AlertDialogTitle>
                        <AlertDialogDescription className="text-base pt-2">
                            Did you just present to <span className="font-semibold text-foreground">{doctorName}</span>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel
                            onClick={() => handlePresentationConfirm(false)}
                            className="w-full sm:w-auto"
                        >
                            <XCircle className="mr-2 h-4 w-4" />
                            No, Just Viewing
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handlePresentationConfirm(true)}
                            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Yes, I Presented
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}


export default function PresentationViewerPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <Loader className="h-12 w-12 animate-spin text-white" />
            </div>
        }>
            <PresentationViewerContent />
        </Suspense>
    );
}
