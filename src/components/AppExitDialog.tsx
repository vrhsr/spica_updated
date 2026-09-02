'use client';

import Image from 'next/image';
import { LogOut, ShieldQuestion } from 'lucide-react';
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

type AppExitDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void | Promise<void>;
};

export function AppExitDialog({
    open,
    onOpenChange,
    onConfirm,
}: AppExitDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-sm overflow-hidden rounded-3xl border border-sky-100 bg-white p-0 shadow-2xl">
                <div className="bg-gradient-to-br from-sky-50 via-white to-orange-50 px-6 pt-6">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/80 bg-white shadow-lg">
                        <Image
                            src="/spicasg-logo.png"
                            alt="SPICA SG"
                            width={56}
                            height={56}
                            className="h-14 w-14 object-contain"
                            priority
                        />
                    </div>
                    <AlertDialogHeader className="pb-6 pt-5 text-center sm:text-center">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                            <ShieldQuestion className="h-5 w-5" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-semibold text-slate-900">
                            Exit SPICA SG?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="mx-auto max-w-xs pt-1 text-sm leading-6 text-slate-600">
                            Are you sure you want to exit the app?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                </div>
                <AlertDialogFooter className="gap-3 px-6 pb-6 pt-2 sm:flex-row sm:justify-center sm:space-x-0">
                    <AlertDialogCancel className="mt-0 h-11 min-w-[130px] rounded-xl border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                        Stay Here
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className="h-11 min-w-[130px] rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Exit App
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
