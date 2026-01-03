'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X, Loader, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { getOfflinePDF, hasOfflinePDF } from '@/lib/offline-pdf-store';
import { useToast } from '@/hooks/use-toast';
import { useOfflineReady } from '@/hooks/useOfflineReady';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use local worker file for offline support
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export default function PresentationViewerPage() {
    const params = useParams();
    const router = useRouter();
    const doctorId = params.doctorId as string;
    const { toast } = useToast();
    const { isReady: isDBReady, isLoading: isDBLoading, error: dbError } = useOfflineReady();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [isPresenting, setIsPresenting] = useState(false);

    // Touch gesture handling
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);

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
        // Wait for IndexedDB to be ready before loading
        if (!isDBReady) return;
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

            // GUARDRAILS - Smart Sync
            if (record.state === 'FAILED') {
                toast({
                    variant: 'destructive',
                    title: 'Sync Failed',
                    description: 'This presentation failed to download properly. Please retry the "Start Day" sync.',
                });
                setLoading(false);
                // We keep it null so the empty state is shown
                return;
            }

            if (record.state === 'STALE') {
                toast({
                    className: "bg-amber-100 border-amber-500 text-amber-900",
                    title: 'Presentation Outdated',
                    description: 'You are viewing an older version. Please sync when online.',
                });
            }

            // Load PDF with PDF.js using an Object URL (recommended architecture)
            const pdfUrl = URL.createObjectURL(record.fileBlob);
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;

            // Optional: revoke after load if not needed (PDF.js might need it though)
            // URL.revokeObjectURL(pdfUrl); 

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
            const scale = Math.min(scaleX, scaleY) * 0.95; // 95% to add some padding

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
        const isBypass = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('mode') === 'bypass';
        if (isBypass) {
            router.push('/rep/offline');
        } else {
            router.back();
        }
    };

    const startPresentation = useCallback(() => {
        const elem = containerRef.current;
        if (elem?.requestFullscreen) {
            elem.requestFullscreen().catch(err => {
                console.warn('Could not enter fullscreen:', err);
            }).then(() => setIsPresenting(true));
        }
    }, []);

    const exitPresentation = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().then(() => setIsPresenting(false));
        }
    };

    // Touch gesture handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const deltaX = touchEndX - touchStartX.current;
        const deltaY = touchEndY - touchStartY.current;

        // Check if it's a horizontal swipe (not vertical scroll)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX > 0) {
                // Swipe right - go to previous slide
                goToPrevPage();
            } else {
                // Swipe left - go to next slide
                goToNextPage();
            }
        }
    };

    // Click/tap navigation (left/right side of screen)
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const canvasWidth = rect.width;

        // Left third of screen - previous slide
        if (clickX < canvasWidth / 3) {
            goToPrevPage();
        }
        // Right third of screen - next slide
        else if (clickX > (canvasWidth * 2) / 3) {
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
            if (e.key === 'Escape') {
                exitPresentation();
            }
        };

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setIsPresenting(false);
            } else {
                setIsPresenting(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [goToNextPage, goToPrevPage]);

    // Auto-start presentation when loaded
    useEffect(() => {
        if (pdfDoc && !loading) {
            startPresentation();
        }
    }, [pdfDoc, loading, startPresentation]);

    // Database initialization error
    if (dbError) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="text-center text-white">
                    <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
                    <p className="text-xl">Storage Error</p>
                    <p className="text-sm text-gray-400 mt-2 max-w-sm">
                        Unable to access offline storage. Please restart the app or check browser settings.
                    </p>
                    <Button variant="outline" className="mt-4" onClick={handleClose}>
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
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Top Controls - only visible if NOT in presentation mode */}
            {!isPresenting && (
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-black/90 p-3">
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
            )}

            {/* Main Canvas */}
            <div className="flex-grow flex items-center justify-center w-full h-full">
                <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full object-contain cursor-pointer"
                    onClick={handleCanvasClick}
                />
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-4 left-0 right-0 z-10 flex items-center justify-center gap-4">
                <div className="flex items-center gap-4 rounded-full bg-black/50 p-2 shadow-lg backdrop-blur-sm border border-white/20 text-white">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={goToPrevPage}
                        disabled={currentPage <= 1}
                        className="text-white hover:bg-white/20 hover:text-white disabled:opacity-30"
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
                        className="text-white hover:bg-white/20 hover:text-white disabled:opacity-30"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </Button>
                </div>
            </div>

            {/* Instructions overlay - only show initially */}
            {currentPage === 1 && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-black/70 rounded-lg px-6 py-3 text-white text-sm text-center max-w-md animate-fade-in">
                    <p className="font-semibold mb-1">Navigation Tips:</p>
                    <p className="text-xs">• Swipe left/right to change slides</p>
                    <p className="text-xs">• Tap left/right side of screen</p>
                    <p className="text-xs">• Use arrow keys or buttons below</p>
                </div>
            )}
        </div>
    );
}
