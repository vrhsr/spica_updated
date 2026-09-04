
'use client';

import React, { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader, Expand, Minimize, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

// PDF.js - Use standard import for compatibility
import * as pdfjsLib from "pdfjs-dist";

// Local worker file (bundled in /public, same one used by the offline
// presentation viewer) — avoids depending on a third-party CDN being
// reachable, and keeps the version always in lockstep with pdfjs-dist.
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

function PDFError({ message }: { message: string }) {
    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-white">
            <div className="rounded-2xl bg-destructive/15 p-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div>
                <h1 className="font-headline text-xl font-bold">Couldn't open presentation</h1>
                <p className="mt-1.5 max-w-sm text-sm text-slate-400">{message}</p>
            </div>
            <Button asChild size="lg" className="mt-2 rounded-full px-6">
                <Link href="/rep/doctors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Doctors
                </Link>
            </Button>
        </div>
    )
}

function PDFViewer() {
    const searchParams = useSearchParams();
    const pdfUrlFromParams = searchParams.get('url');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPresenting, setIsPresenting] = useState(false);

    const renderPage = useCallback(async (pageNumber: number) => {
        if (!pdfDoc) return;
        try {
            const page = await pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 2.0 }); // Render at higher scale
            const canvas = canvasRef.current;
            if (canvas) {
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                if (context) {
                    await page.render({ canvasContext: context, viewport }).promise;
                }
            }
        } catch (e: any) {
            console.error("Error rendering page:", e);
            setError(`Failed to render page ${pageNumber}.`);
        }
    }, [pdfDoc]);

    const startPresentation = useCallback(() => {
        const elem = containerRef.current;
        if (elem?.requestFullscreen) {
            elem.requestFullscreen().catch(err => {
                console.warn("Could not enter fullscreen automatically:", err.message);
            }).then(() => setIsPresenting(true));
        }
    }, []);

    const exitPresentation = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().then(() => setIsPresenting(false));
        }
    }

    useEffect(() => {
        if (!pdfUrlFromParams) {
            setError("No PDF URL provided.");
            setIsLoading(false);
            return;
        }

        // The viewer now receives the raw Supabase URL and calls the proxy route itself.
        const actualPdfSrc = `/api/view-pdf?url=${encodeURIComponent(pdfUrlFromParams)}`;

        const loadingTask = pdfjsLib.getDocument({ url: actualPdfSrc, withCredentials: false });

        loadingTask.promise.then(
            (doc: pdfjsLib.PDFDocumentProxy) => {
                setPdfDoc(doc);
                setTotalPages(doc.numPages);
                setIsLoading(false);
            },
            (reason: any) => {
                // Log the detailed error to the console for visibility
                console.error("PDF load error:", reason);
                setError("Failed to load the PDF file. Check the console for details. It might be corrupted or inaccessible.");
                setIsLoading(false);
            }
        );
    }, [pdfUrlFromParams]);


    useEffect(() => {
        if (pdfDoc) {
            renderPage(currentPage);
        }
    }, [pdfDoc, currentPage, renderPage]);

    const goToPrevPage = () => setCurrentPage(p => Math.max(1, p - 1));
    const goToNextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") goToNextPage();
            if (e.key === "ArrowLeft") goToPrevPage();
            if (e.key === "Escape") exitPresentation();
        };

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setIsPresenting(false);
            } else {
                setIsPresenting(true);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };

    }, [totalPages, currentPage, goToNextPage, goToPrevPage, exitPresentation]);


    if (isLoading) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-950">
                <div className="relative flex h-16 w-16 items-center justify-center">
                    <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
                    <Loader className="h-9 w-9 animate-spin text-primary" />
                </div>
                <p className="text-sm font-medium text-slate-400">Loading presentation…</p>
            </div>
        );
    }

    if (error) return <PDFError message={error} />;

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-4"
            style={{
                paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)',
            }}
        >
            {/* Top Controls - only visible if NOT in presentation mode */}
            {!isPresenting && (
                <div className="absolute top-4 left-4 z-10" style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}>
                    <Button asChild variant="secondary" size="sm" className="rounded-full bg-white/10 text-white shadow-lg backdrop-blur-md hover:bg-white/20">
                        <Link href="/rep/doctors">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Link>
                    </Button>
                </div>
            )}

            {/* Main Canvas */}
            <div className="flex-grow flex items-center justify-center w-full h-full max-h-[calc(100vh-8rem)]">
                <canvas ref={canvasRef} className="max-w-full max-h-full rounded-lg object-contain shadow-2xl shadow-black/50" />
            </div>

            {/* Bottom Controls */}
            <div
                className="absolute left-0 right-0 z-10 flex items-center justify-center gap-4"
                style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
            >
                {isPresenting ? (
                    <div className="flex items-center gap-4 rounded-full bg-black/60 p-2 shadow-lg backdrop-blur-md border border-white/10 text-white">
                        <Button variant="ghost" size="icon" onClick={goToPrevPage} disabled={currentPage <= 1} className="rounded-full text-white hover:bg-white/20 hover:text-white">
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <span className="text-sm font-semibold tabular-nums">
                            {currentPage} / {totalPages}
                        </span>
                        <Button variant="ghost" size="icon" onClick={goToNextPage} disabled={currentPage >= totalPages} className="rounded-full text-white hover:bg-white/20 hover:text-white">
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                        <div className="h-6 w-px bg-white/20" />
                        <Button variant="ghost" size="icon" onClick={exitPresentation} className="rounded-full text-white hover:bg-white/20 hover:text-white">
                            <Minimize className="h-5 w-5" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <Button size="lg" onClick={startPresentation} className="rounded-full px-6 shadow-lg shadow-primary/30">
                            <Expand className="mr-2 h-4 w-4" />
                            Start Presentation
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}


export default function PDFViewerPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-slate-950"><Loader className="h-9 w-9 animate-spin text-primary" /></div>}>
            <PDFViewer />
        </Suspense>
    )
}
