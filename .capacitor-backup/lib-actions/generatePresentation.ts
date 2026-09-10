
'use server';
// BUILD_ID: FORCE_REFRESH_002

import { z } from 'zod';
import { adminFirestore } from '@/lib/firebaseAdmin';
import { allSlides } from '@/lib/slides';
import { Timestamp } from 'firebase-admin/firestore';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Define the input schema for the generation action
const PdfGenerationInputSchema = z.object({
    doctorId: z.string(),
    doctorName: z.string(),
    city: z.string(),
    selectedSlides: z.array(z.number()),
    adminUid: z.string(),
});

type PdfGenerationInput = z.infer<typeof PdfGenerationInputSchema>;

// Define the success and error return types
type SuccessResponse = { presentationId: string; pdfUrl: string };
type ErrorResponse = { error: string };

/**
 * Server Action to generate a presentation PDF, upload it, and update Firestore.
 */
export const generateAndUpsertPresentation = async (input: PdfGenerationInput): Promise<SuccessResponse | ErrorResponse> => {
    // --- START: Robust Environment Variable Validation ---
    const requiredEnvVars = [
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET',
        'R2_PUBLIC_URL'
    ];

    const missingVars = requiredEnvVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
        const errorMessage = `Missing required server environment variables for PDF upload: ${missingVars.join(', ')}. Please configure them in your hosting environment.`;
        console.error('[generateAndUpsertPresentation] Validation Error:', errorMessage);
        // Directly return an object, not a stringified one
        return { error: errorMessage };
    }
    // --- END: Robust Environment Variable Validation ---

    const validation = PdfGenerationInputSchema.safeParse(input);
    if (!validation.success) {
        const flatErrors = validation.error.flatten();
        const errorMessages = Object.entries(flatErrors.fieldErrors).map(([field, messages]) => `${field}: ${messages.join(', ')}`).join('; ');
        console.error("Invalid input for PDF generation:", flatErrors);
        return { error: `Invalid input: ${errorMessages}` };
    }

    const { doctorId, doctorName, city, selectedSlides, adminUid } = validation.data;

    // Initialize S3 client only after validation
    const s3 = new S3Client({
        forcePathStyle: true,
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
    });

    const uploadToR2 = async (fileBuffer: Buffer, fileName: string): Promise<string> => {
        const bucket = process.env.R2_BUCKET!;
        const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const key = `${safeFileName}.pdf`;

        await s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: fileBuffer,
                ContentType: "application/pdf",
                ContentDisposition: `inline; filename="${safeFileName}.pdf"`
            })
        );

        return `${process.env.R2_PUBLIC_URL}/${key}`;
    }

    const deleteOldFileIfPresent = async (oldPdfUrl: string | null | undefined) => {
        const publicUrlBase = process.env.R2_PUBLIC_URL!;
        if (!oldPdfUrl || !oldPdfUrl.startsWith(publicUrlBase)) return; // legacy/foreign URL (e.g. old Supabase link) — nothing to clean up
        const oldKey = oldPdfUrl.slice(publicUrlBase.length).replace(/^\//, '');
        if (!oldKey) return;
        try {
            await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: oldKey }));
        } catch (delErr) {
            console.error('[generateAndUpsertPresentation] Failed to delete superseded file from R2:', delErr);
        }
    };

    try {
        if (selectedSlides.length === 0) {
            throw new Error('No slides were selected for the presentation.');
        }

        // 0. Look up any existing presentation for this doctor, to know which file (if any) gets replaced
        const presentationsRef = adminFirestore.collection('presentations');
        const existingQuery = presentationsRef.where('doctorId', '==', doctorId);
        const existingSnapshot = await existingQuery.get();
        const previousPdfUrl: string | null = existingSnapshot.empty ? null : (existingSnapshot.docs[0].data().pdfUrl ?? null);

        // 1. Create a new PDF document
        const pdfDoc = await PDFDocument.create();
        // Serif bold, to match the "THANK YOU DOCTOR" title styling on the last slide
        const titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

        // 2. Add selected slides to the presentation
        const slidesToAdd = allSlides.filter(slide => selectedSlides.includes(slide.number)).sort((a, b) => a.number - b.number);

        for (const slide of slidesToAdd) {
            let imgBytes;
            let response = null;
            let lastFetchError = null;

            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    response = await fetch(slide.url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                        }
                    });
                    
                    if (response.ok) {
                        break; // Success, exit retry loop
                    }
                } catch (fetchError: any) {
                    lastFetchError = fetchError;
                }
                
                // If not successful, wait 500ms before retrying
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            try {
                if (!response || !response.ok) {
                    throw lastFetchError || new Error(`Status ${response?.status}`);
                }
                imgBytes = await response.arrayBuffer();
            } catch (finalError: any) {
                console.error(`Failed to fetch image for slide ${slide.number} from ${slide.url}`, finalError);
                throw new Error(`Could not download image for slide number ${slide.number}. URL may be invalid or blocked. Original error: ${finalError.message}`);
            }

            let img;
            try {
                if (slide.url.toLowerCase().endsWith('.png')) {
                    img = await pdfDoc.embedPng(imgBytes);
                } else {
                    img = await pdfDoc.embedJpg(imgBytes);
                }
            } catch (embedError: any) {
                console.error(`Failed to embed image for slide ${slide.number}. It might be corrupted or in an unsupported format.`, embedError);
                throw new Error(`Could not process image for slide number ${slide.number}. Check if the file is a valid JPG/PNG. Original error: ${embedError.message}`);
            }

            // Use a standard 16:9 aspect ratio, e.g., 1280x720
            const page = pdfDoc.addPage([1280, 720]);
            page.drawImage(img, {
                x: 0,
                y: 0,
                width: 1280,
                height: 720,
            });

            // If this is the last slide (Thank You slide), add the doctor's name inside the
            // blue branding bar under the SPICA SG logo, matching the title's serif/dark
            // styling. Bar coordinates measured directly from the artwork (spans roughly
            // y 45-120 in PDF space, full width) so this tracks the actual image, not a guess.
            if (slide.number === 34) {
                const NAME_BOX_LEFT = 70;
                const NAME_BOX_RIGHT = 1150;
                const NAME_BOX_WIDTH = NAME_BOX_RIGHT - NAME_BOX_LEFT;
                const NAME_BASELINE_Y = 68;
                const NAME_MAX_FONT_SIZE = 34;
                const NAME_MIN_FONT_SIZE = 16;

                const personalizedText = doctorName.toUpperCase();

                let fontSize = NAME_MAX_FONT_SIZE;
                let textWidth = titleFont.widthOfTextAtSize(personalizedText, fontSize);
                while (textWidth > NAME_BOX_WIDTH && fontSize > NAME_MIN_FONT_SIZE) {
                    fontSize -= 1;
                    textWidth = titleFont.widthOfTextAtSize(personalizedText, fontSize);
                }

                // Center within the safe box; if it's still too wide even at the smallest
                // size, left-align from the box edge rather than centering off the image.
                const x = textWidth <= NAME_BOX_WIDTH
                    ? NAME_BOX_LEFT + (NAME_BOX_WIDTH - textWidth) / 2
                    : NAME_BOX_LEFT;

                page.drawText(personalizedText, {
                    x,
                    y: NAME_BASELINE_Y,
                    font: titleFont,
                    size: fontSize,
                    color: rgb(0.16, 0.16, 0.16), // matches the title's dark charcoal
                });
            }
        }

        // 3. Generate the PDF file as a buffer
        const pdfBytes = await pdfDoc.save();

        // 4. Upload the buffer to Cloudflare R2 (S3-compatible)
        const safeDoctorName = doctorName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const fileName = `${city.toUpperCase()}_${safeDoctorName}_${Date.now()}`;
        const downloadUrl = await uploadToR2(Buffer.from(pdfBytes), fileName);

        // 5. Upsert the presentation record in Firestore
        const presentationData = {
            doctorId,
            city,
            pdfUrl: downloadUrl,
            updatedAt: Timestamp.now(),
            updatedBy: adminUid,
            dirty: false,
            error: null
        };

        let presentationId: string;
        if (existingSnapshot.empty) {
            // Create new presentation document
            const docRef = await presentationsRef.add(presentationData);
            presentationId = docRef.id;
        } else {
            // Update existing presentation document
            const docRef = existingSnapshot.docs[0].ref;
            await docRef.update(presentationData);
            presentationId = docRef.id;
        }

        // 6. New file is live and Firestore points to it — safe to remove the superseded one
        await deleteOldFileIfPresent(previousPdfUrl);

        // Return a direct JSON object on success
        return { presentationId, pdfUrl: downloadUrl };

    } catch (err: any) {
        console.error('[generateAndUpsertPresentation] Critical Action Error:', err);
        // Also update the firestore doc with the error if possible, so UI can reflect it.
        try {
            const presentationsRef = adminFirestore.collection('presentations');
            const q = presentationsRef.where('doctorId', '==', doctorId);
            const snapshot = await q.get();
            if (!snapshot.empty) {
                const presentationDocRef = snapshot.docs[0].ref;
                await presentationDocRef.update({
                    error: err.message || 'An unknown server error occurred.',
                    dirty: false, // Set dirty to false as the generation attempt has completed (even if failed)
                    updatedAt: Timestamp.now(),
                    updatedBy: adminUid
                });
            } else {
                // If no presentation document exists, create one with the error state.
                await presentationsRef.add({
                    doctorId,
                    city,
                    pdfUrl: null,
                    updatedAt: Timestamp.now(),
                    updatedBy: adminUid,
                    dirty: false,
                    error: err.message || 'An unknown server error occurred.'
                });
            }
        } catch (firestoreError) {
            console.error("[generateAndUpsertPresentation] Failed to write error state to Firestore:", firestoreError);
        }

        // Return a structured error object to the client
        return { error: err.message || 'An unknown error occurred during PDF generation.' };
    }
};

