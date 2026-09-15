
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader, FileQuestion } from 'lucide-react';

// Local worker file (same one used by the rep-side PDF viewers) — keeps the
// version in lockstep with pdfjs-dist without depending on a CDN.
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

function PdfPageCanvas({ page, containerWidth, pageNumber }: { page: pdfjsLib.PDFPageProxy; containerWidth: number; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (containerWidth <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const baseViewport = page.getViewport({ scale: 1 });
    const displayScale = containerWidth / baseViewport.width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const renderViewport = page.getViewport({ scale: displayScale * dpr });

    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${baseViewport.height * displayScale}px`;

    const renderTask = page.render({ canvasContext: context, viewport: renderViewport });
    renderTask.promise.catch((err) => {
      if (err?.name !== 'RenderingCancelledException') {
        console.error(`Error rendering page ${pageNumber}:`, err);
      }
    });

    return () => {
      renderTask.cancel();
    };
  }, [page, containerWidth, pageNumber]);

  return <canvas ref={canvasRef} className="block w-full rounded-md shadow-sm ring-1 ring-black/5" />;
}

/**
 * Renders a PDF by URL using pdf.js onto <canvas> elements instead of an
 * <iframe>. Chrome's built-in PDF viewer renders solid black when the
 * iframe sits inside an ancestor with a CSS `transform` (a known Chromium
 * bug) — which is exactly how Radix's <DialogContent> centers itself
 * (`translate-x-[-50%] translate-y-[-50%]`), so an <iframe src={pdfUrl}>
 * inside any of this app's dialogs shows a blank/black box instead of the
 * PDF. Rendering via canvas sidesteps the native plugin entirely.
 */
export function AdminPdfViewer({ pdfUrl }: { pdfUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<pdfjsLib.PDFPageProxy[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setPages([]);

    async function load() {
      try {
        // Fetch through our own proxy, not the R2 URL directly: pdf.js
        // needs CORS-friendly range requests, and this route (already used
        // by the rep-side viewers) adds the right headers for that.
        const proxySrc = `/api/view-pdf?url=${encodeURIComponent(pdfUrl)}`;
        const doc = await pdfjsLib.getDocument({ url: proxySrc }).promise;
        if (cancelled) return;

        const loadedPages = await Promise.all(
          Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1))
        );
        if (cancelled) return;
        setPages(loadedPages);
        setIsLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        console.error('PDF load error:', e);
        setError(e?.message || 'Failed to load the PDF file.');
        setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

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
      <div className="flex h-full w-full items-center justify-center rounded-md border bg-muted/20">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-md border bg-muted/20 text-muted-foreground">
        <FileQuestion className="mb-2 h-10 w-10 opacity-50" />
        <p className="max-w-sm text-center text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full overflow-y-auto rounded-md border bg-muted/20 p-2 sm:p-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {containerWidth > 0 && pages.map((page, i) => (
          <PdfPageCanvas key={i} page={page} pageNumber={i + 1} containerWidth={containerWidth} />
        ))}
      </div>
    </div>
  );
}
