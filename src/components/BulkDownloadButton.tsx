'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader, CheckCircle2, XCircle } from 'lucide-react';
import { savePresentationOffline } from '@/lib/offline-storage';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

interface Presentation {
    id: string;
    doctorId: string;
    pdfUrl?: string;
    dirty: boolean;
    error?: string;
}

interface Doctor {
    id: string;
    name: string;
}

interface BulkDownloadButtonProps {
    presentations: Presentation[];
    doctors: Doctor[];
}

export function BulkDownloadButton({ presentations, doctors }: BulkDownloadButtonProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [successCount, setSuccessCount] = useState(0);
    const [failCount, setFailCount] = useState(0);
    const { toast } = useToast();

    const doctorMap = new Map(doctors.map(d => [d.id, d.name]));

    const handleBulkDownload = async () => {
        // Filter presentations that are ready and have PDF URLs
        const readyPresentations = presentations.filter(
            p => p.pdfUrl && !p.dirty && !p.error
        );

        if (readyPresentations.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No Presentations Available',
                description: 'There are no ready presentations to download.',
            });
            return;
        }

        setIsDownloading(true);
        setProgress(0);
        setTotal(readyPresentations.length);
        setSuccessCount(0);
        setFailCount(0);

        let success = 0;
        let failed = 0;

        for (let i = 0; i < readyPresentations.length; i++) {
            const presentation = readyPresentations[i];
            const doctorName = doctorMap.get(presentation.doctorId) || 'Unknown Doctor';

            try {
                const result = await savePresentationOffline(
                    presentation.doctorId,
                    presentation.pdfUrl!,
                    doctorName
                );

                if (result.success) {
                    success++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`Error downloading ${doctorName}:`, error);
                failed++;
            }

            setProgress(i + 1);
            setSuccessCount(success);
            setFailCount(failed);
        }

        // Show completion toast
        toast({
            title: '✓ Bulk Download Complete',
            description: `Downloaded ${success} presentations. ${failed > 0 ? `${failed} failed.` : ''}`,
        });

        // Close modal after a brief delay
        setTimeout(() => {
            setIsDownloading(false);
            window.dispatchEvent(new Event('offline-updated'));
        }, 1500);
    };

    const progressPercentage = total > 0 ? (progress / total) * 100 : 0;

    return (
        <>
            <Button onClick={handleBulkDownload} disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" />
                Download All Offline
            </Button>

            <Dialog open={isDownloading} onOpenChange={() => { }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Downloading Presentations</DialogTitle>
                        <DialogDescription>
                            Saving all presentations for offline viewing...
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <Progress value={progressPercentage} className="h-2" />

                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Progress: {progress} / {total}</span>
                            <span>{Math.round(progressPercentage)}%</span>
                        </div>

                        <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>{successCount} success</span>
                            </div>
                            {failCount > 0 && (
                                <div className="flex items-center gap-1 text-red-600">
                                    <XCircle className="h-4 w-4" />
                                    <span>{failCount} failed</span>
                                </div>
                            )}
                        </div>

                        {progress === total && total > 0 && (
                            <div className="text-center text-sm font-medium text-green-600">
                                ✓ Download complete!
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
