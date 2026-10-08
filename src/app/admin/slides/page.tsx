'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAllSlides } from '@/hooks/useAllSlides';
import { allSlides as builtInSlides, CUSTOM_SLIDE_START, type Slide } from '@/lib/slides';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ImagePlus, Loader, ShieldQuestion, Trash2 } from 'lucide-react';

const MAX_NAME_LENGTH = 60;
const OUT_WIDTH = 1280;
const OUT_HEIGHT = 720;
const MIN_RATIO = 1.6;
const MAX_RATIO = 1.95;
const MAX_INPUT_BYTES = 25 * 1024 * 1024; // the browser downsizes it; just guard against absurd files

const builtInNumbers = new Set(builtInSlides.map((s) => s.number));

/** Loads the picked file, checks it is a ~16:9 image, and re-encodes it as a 1280x720 JPEG (small, and exactly what the PDF uses). */
async function prepareImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) throw new Error('Only JPG or PNG images are supported.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('That file is too large.');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That image could not be read.'));
      i.src = url;
    });
    const ratio = img.naturalWidth / img.naturalHeight;
    if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
      throw new Error(
        `Slides must be 16:9 (landscape). This image is ${img.naturalWidth}x${img.naturalHeight}, which would look stretched.`
      );
    }
    const canvas = document.createElement('canvas');
    canvas.width = OUT_WIDTH;
    canvas.height = OUT_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not process the image.');
    ctx.fillStyle = '#ffffff'; // flatten transparency (JPEG has none)
    ctx.fillRect(0, 0, OUT_WIDTH, OUT_HEIGHT);
    ctx.drawImage(img, 0, 0, OUT_WIDTH, OUT_HEIGHT);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Could not process the image.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SlidesPage() {
  const { user, role } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { slides, isLoading } = useAllSlides();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [processed, setProcessed] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [toDelete, setToDelete] = useState<Slide | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sortedSlides = useMemo(() => slides, [slides]);

  const resetAdd = () => {
    setName('');
    setProcessed(null);
    setFileError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInput.current) fileInput.current.value = '';
  };

  const handleAddOpenChange = (open: boolean) => {
    if (isSaving) return; // don't close mid-upload
    if (!open) resetAdd();
    setAddOpen(open);
  };

  const handleFile = async (file: File | undefined) => {
    setFileError(null);
    setProcessed(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (!file) return;
    try {
      const blob = await prepareImage(file);
      setProcessed(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setFileError(e.message || 'That image could not be used.');
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const trimmedName = name.trim().replace(/\s+/g, ' ');
  const duplicateName = slides.some((s) => s.medicineName.trim().toLowerCase() === trimmedName.toLowerCase());
  const nameError =
    trimmedName.length > MAX_NAME_LENGTH
      ? `Keep the name to ${MAX_NAME_LENGTH} characters or fewer.`
      : duplicateName
      ? `A slide named "${trimmedName}" already exists.`
      : null;
  const canSave = !!trimmedName && !nameError && !!processed && !isSaving;

  const handleSave = async () => {
    if (!user || !processed || !canSave) return;
    setIsSaving(true);
    try {
      const body = new FormData();
      body.append('name', trimmedName);
      body.append('file', new File([processed], 'slide.jpg', { type: 'image/jpeg' }));
      const res = await fetch('/api/slides', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not add the slide.');
      toast({
        title: 'Slide added',
        description: `"${trimmedName}" is now available when choosing slides (slide #${data.number}). Existing presentations aren't changed until they're regenerated.`,
      });
      resetAdd();
      setAddOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not add slide', description: e.message || 'Something went wrong.' });
    } finally {
      setIsSaving(false);
    }
  };

  const askDelete = async (slide: Slide) => {
    setToDelete(slide);
    setDeleteUsage(null);
    if (!firestore) return;
    try {
      const snap = await getDocs(query(collection(firestore, 'doctors'), where('selectedSlides', 'array-contains', slide.number)));
      setDeleteUsage(snap.size);
    } catch {
      setDeleteUsage(null); // unknown — the dialog still warns generally
    }
  };

  const handleDelete = async () => {
    if (!user || !toDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/slides?id=${encodeURIComponent(toDelete.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete the slide.');
      toast({ title: 'Slide deleted', description: `"${toDelete.medicineName}" was removed from the library.` });
      setToDelete(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not delete slide', description: e.message || 'Something went wrong.' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (role !== 'admin') {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline"><ShieldQuestion /> Permission Denied</CardTitle>
          <CardContent className="pt-4 px-0">
            <p>You do not have the necessary permissions to view this page. Please contact the system administrator.</p>
          </CardContent>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Slides Library
        </h1>
        <Button onClick={() => setAddOpen(true)} className="w-full md:w-auto">
          <ImagePlus className="mr-2 h-4 w-4" /> Add Slide
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Master Slide Templates</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading && (
            <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader className="h-3 w-3 animate-spin" /> Checking for added slides…
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {sortedSlides.map((slide) => {
              const isCustom = !builtInNumbers.has(slide.number);
              return (
                <div
                  key={slide.id}
                  className="group relative aspect-[16/9] w-full overflow-hidden rounded-lg border bg-card text-center transition-all"
                >
                  <img
                    src={slide.url}
                    alt={`Slide ${slide.number}`}
                    className="h-full w-full object-cover"
                    data-ai-hint="presentation slide"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                  <div className="absolute bottom-2 left-2 right-2 text-left text-white">
                    <p className="truncate text-sm font-bold">{slide.medicineName}</p>
                  </div>

                  <div className="absolute right-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-background/70 px-1 text-xs font-bold text-foreground">
                    {slide.number}
                  </div>

                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => askDelete(slide)}
                      className="absolute left-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-destructive opacity-100 shadow transition hover:bg-destructive hover:text-destructive-foreground sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                      title="Delete this slide"
                      aria-label={`Delete ${slide.medicineName}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Slides you add are numbered from {CUSTOM_SLIDE_START} and appear just before the Thank You slide, which always stays last.
            Slide 1 and the Thank You slide are included in every presentation.
          </p>
        </CardContent>
      </Card>

      {/* Add slide */}
      <Dialog open={addOpen} onOpenChange={handleAddOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a slide</DialogTitle>
            <DialogDescription>
              Upload a 16:9 JPG or PNG. It is resized to 1280×720 and becomes available to everyone choosing slides, including reps.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="slide-name">Slide name</Label>
              <Input
                id="slide-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. NEWMEDICINE-500"
                maxLength={MAX_NAME_LENGTH + 20}
                disabled={isSaving}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slide-file">Slide image</Label>
              <Input
                id="slide-file"
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => handleFile(e.target.files?.[0])}
                disabled={isSaving}
              />
              {fileError && <p className="text-xs text-destructive">{fileError}</p>}
            </div>

            {previewUrl && (
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border bg-muted">
                <img src={previewUrl} alt="Slide preview" className="h-full w-full object-cover" />
                {trimmedName && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="truncate text-sm font-bold text-white">{trimmedName}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleAddOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSaving ? 'Uploading…' : 'Add slide'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete slide */}
      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && !isDeleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{toDelete?.medicineName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUsage && deleteUsage > 0
                ? `${deleteUsage} doctor${deleteUsage === 1 ? ' uses' : 's use'} this slide. It will be left out the next time their presentation is generated; PDFs that already exist are not changed.`
                : 'It is removed from the library and from the slide picker. PDFs that already include it are not changed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
