
'use client';

import React, { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader, Expand, Minimize, ChevronLeft, ChevronRight } from 'lucide-react';

// PDF.js - Use standard import for compatibility
import * as pdfjsLib from "pdfjs-dist";

// Worker setup - Force version to prevent caching issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;


function PDFError({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
            <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>
            <p className="mb-6">{message}</p>
            <Button asChild>
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

    // Automatically start presentation when PDF is loaded
    useEffect(() => {
        if (pdfDoc && !isLoading) {
            startPresentation();
        }
    }, [pdfDoc, isLoading, startPresentation]);

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
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-4 text-lg text-muted-foreground">Loading PDF...</p>
            </div>
        );
    }

    if (error) return <PDFError message={error} />;

    return (
        <div ref={containerRef} className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-4">
            {/* Top Controls - only visible if NOT in presentation mode */}
            {!isPresenting && (
                <div className="absolute top-4 left-4 z-10">
                    <Button asChild variant="secondary" size="sm">
                        <Link href="/rep/doctors">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Link>
                    </Button>
                </div>
            )}

            {/* Main Canvas */}
            <div className="flex-grow flex items-center justify-center w-full h-full max-h-[calc(100vh-8rem)]">
                <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-4 left-0 right-0 z-10 flex items-center justify-center gap-4">
                {isPresenting ? (
                    <div className="flex items-center gap-4 rounded-full bg-black/50 p-2 shadow-lg backdrop-blur-sm border border-white/20 text-white">
                        <Button variant="ghost" size="icon" onClick={goToPrevPage} disabled={currentPage <= 1} className="text-white hover:bg-white/20 hover:text-white">
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <span className="text-sm font-medium tabular-nums">
                            {currentPage} / {totalPages}
                        </span>
                        <Button variant="ghost" size="icon" onClick={goToNextPage} disabled={currentPage >= totalPages} className="text-white hover:bg-white/20 hover:text-white">
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={exitPresentation} className="text-white hover:bg-white/20 hover:text-white">
                            <Minimize className="h-5 w-5" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <Button variant="secondary" onClick={startPresentation}>
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
        <Suspense fallback={<div>Loading...</div>}>
            <PDFViewer />
        </Suspense>
    )
}
