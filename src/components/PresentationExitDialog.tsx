'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { saveVisitLog } from '@/lib/visit-logs-store';
import { useToast } from '@/hooks/use-toast';

interface PresentationExitDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    doctorId: string;
    doctorName?: string;
    onExitConfirmed: () => void; // Callback to actually exit/redirect
}

export function PresentationExitDialog({
    open,
    onOpenChange,
    doctorId,
    doctorName,
    onExitConfirmed
}: PresentationExitDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleFeedback = async (visited: boolean) => {
        setIsLoading(true);
        try {
            // Save log (location capture happens inside this function)
            await saveVisitLog(
                doctorId,
                visited ? 'VISITED' : 'NOT_VISITED',
                doctorName
            );

            if (visited) {
                toast({
                    title: "Visit Recorded",
                    description: "Location captured successfully.",
                    className: "bg-green-50 border-green-200 text-green-900"
                });
            }

            // Proceed to exit
            onExitConfirmed();
        } catch (error) {
            console.error("Failed to save visit log", error);
            // Exit anyway to not trap user
            onExitConfirmed();
        } finally {
            setIsLoading(false);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <CheckCircle className="h-6 w-6 text-primary" />
                        Presentation Completed
                    </DialogTitle>
                    <DialogDescription className="text-base text-slate-600 pt-2">
                        Did you successfully meet {doctorName || 'this doctor'}?
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 py-4">
                    <Button
                        size="lg"
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-14 text-lg shadow-md"
                        onClick={() => handleFeedback(true)}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <MapPin className="mr-2 h-5 w-5" />
                        )}
                        Yes, Visit Completed
                    </Button>
                    <p className="text-xs text-center text-muted-foreground -mt-1 mb-1">
                        * Captures your current location securely
                    </p>

                    <Button
                        size="lg"
                        variant="outline"
                        className="w-full border-2 h-12 text-slate-600"
                        onClick={() => handleFeedback(false)}
                        disabled={isLoading}
                    >
                        <XCircle className="mr-2 h-5 w-5" />
                        No, Just Viewing
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
