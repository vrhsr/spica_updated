
'use client';

import React, { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader, AlertTriangle, FileText } from 'lucide-react';

// PDF.js - Use standard import for compatibility
import * as pdfjsLib from "pdfjs-dist";
import { getOfflinePDF } from '@/lib/offline-pdf-store';

// Local worker file (bundled in /public, same one used by the offline
// presentation viewer) — avoids depending on a third-party CDN being
// reachable, and keeps the version always in lockstep with pdfjs-dist.
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

function PDFError({ message }: { message: string }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
            <div className="rounded-2xl bg-destructive/10 p-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div>
                <h1 className="font-headline text-xl font-bold text-foreground">Couldn't open presentation</h1>
                <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{message}</p>
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

// One rendered slide, sized to the width of its scroll container. Rendered
// at devicePixelRatio (capped at 2x) for crisp text on high-density phone
// screens without blowing up canvas memory unnecessarily.
function PDFPage({ page, containerWidth, pageNumber }: { page: pdfjsLib.PDFPageProxy; containerWidth: number; pageNumber: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isRendered, setIsRendered] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const baseViewport = page.getViewport({ scale: 1 });
        const displayScale = containerWidth / baseViewport.width;
        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        const renderViewport = page.getViewport({ scale: displayScale * dpr });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;
        canvas.style.width = `${containerWidth}px`;
        canvas.style.height = `${baseViewport.height * displayScale}px`;

        const renderTask = page.render({ canvasContext: context, viewport: renderViewport });
        renderTask.promise
            .then(() => {
                if (!cancelled) setIsRendered(true);
            })
            .catch((err) => {
                if (!cancelled) console.error(`Error rendering page ${pageNumber}:`, err);
            });

        return () => {
            cancelled = true;
            renderTask.cancel();
        };
    }, [page, containerWidth, pageNumber]);

    const baseViewport = page.getViewport({ scale: 1 });
    const displayHeight = containerWidth * (baseViewport.height / baseViewport.width);

    return (
        <div className="relative overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-black/5">
            {!isRendered && (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-slate-100"
                    style={{ height: displayHeight }}
                >
                    <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}
            <canvas ref={canvasRef} className="block w-full" />
            <span className="absolute bottom-2 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                {pageNumber}
            </span>
        </div>
    );
}

function PDFViewer() {
    const searchParams = useSearchParams();
    const pdfUrlFromParams = searchParams.get('url');
    const doctorIdFromParams = searchParams.get('doctorId');
    const doctorName = searchParams.get('name');

    const containerRef = useRef<HTMLDivElement>(null);

    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [pages, setPages] = useState<pdfjsLib.PDFPageProxy[]>([]);
    const [containerWidth, setContainerWidth] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!pdfUrlFromParams && !doctorIdFromParams) {
                setError("No presentation was specified.");
                setIsLoading(false);
                return;
            }

            try {
                let doc: pdfjsLib.PDFDocumentProxy;

                if (doctorIdFromParams) {
                    // Offline path: read the previously-downloaded PDF straight
                    // out of IndexedDB — no network involved at all.
                    const record = await getOfflinePDF(doctorIdFromParams);
                    if (!record) {
                        throw new Error('This presentation has not been saved offline on this device.');
                    }
                    const data = await record.fileBlob.arrayBuffer();
                    doc = await pdfjsLib.getDocument({ data }).promise;
                } else {
                    // Online path: through our same-origin proxy — the PDF
                    // lives on Cloudflare R2, a different origin than
                    // spicasg.in, so pdf.js can't fetch it directly.
                    const actualPdfSrc = `/api/view-pdf?url=${encodeURIComponent(pdfUrlFromParams!)}`;
                    doc = await pdfjsLib.getDocument({ url: actualPdfSrc, withCredentials: false }).promise;
                }

                if (cancelled) return;
                setPdfDoc(doc);

                const loadedPages = await Promise.all(
                    Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1))
                );
                if (cancelled) return;
                setPages(loadedPages);
                setIsLoading(false);
            } catch (e: any) {
                if (cancelled) return;
                console.error("PDF load error:", e);
                setError(e?.message || "Failed to load the PDF file. It might be corrupted or inaccessible.");
                setIsLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [pdfUrlFromParams, doctorIdFromParams]);

    // Track the scroll container's width so pages can be sized to fit it.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateWidth = () => setContainerWidth(el.clientWidth);
        updateWidth();

        const observer = new ResizeObserver(updateWidth);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    if (isLoading) {
        return (
            <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-slate-50">
                <div className="relative flex h-16 w-16 items-center justify-center">
                    <div className="absolute inset-0 animate-pulse rounded-full bg-primary/15 blur-xl" />
                    <Loader className="h-9 w-9 animate-spin text-primary" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Loading presentation…</p>
            </div>
        );
    }

    if (error) return <PDFError message={error} />;

    return (
        <div className="flex min-h-screen flex-col bg-slate-100">
            <header
                className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white/90 px-3 py-2.5 backdrop-blur-md"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)' }}
            >
                <Button asChild variant="ghost" size="icon" className="shrink-0 rounded-full">
                    <Link href="/rep/doctors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-headline text-sm font-bold text-foreground sm:text-base">
                        {doctorName || 'Presentation'}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        {pdfDoc?.numPages ?? 0} {pdfDoc?.numPages === 1 ? 'slide' : 'slides'}
                    </p>
                </div>
            </header>

            <div
                ref={containerRef}
                className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-3 py-4 sm:px-6"
            >
                {containerWidth > 0 && pages.map((page, i) => (
                    <PDFPage key={i} page={page} pageNumber={i + 1} containerWidth={containerWidth} />
                ))}
            </div>
        </div>
    );
}


export default function PDFViewerPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center bg-slate-50"><Loader className="h-9 w-9 animate-spin text-primary" /></div>}>
            <PDFViewer />
        </Suspense>
    )
}
