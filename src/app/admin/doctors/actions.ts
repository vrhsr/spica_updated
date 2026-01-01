
'use server';

import { z } from 'zod';
import { adminFirestore } from '@/lib/firebaseAdmin';
import { allSlides } from '@/lib/slides';
import { Timestamp } from 'firebase-admin/firestore';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
    'SUPABASE_S3_REGION',
    'SUPABASE_S3_ENDPOINT',
    'SUPABASE_S3_ACCESS_KEY_ID',
    'SUPABASE_S3_SECRET_ACCESS_KEY',
    'SUPABASE_S3_BUCKET',
    'SUPABASE_STORAGE_URL'
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
    region: process.env.SUPABASE_S3_REGION!,
    endpoint: process.env.SUPABASE_S3_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
    },
  });

  const uploadToSupabase = async (fileBuffer: Buffer, fileName: string): Promise<string> => {
    const bucket = process.env.SUPABASE_S3_BUCKET!;
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

    return `${process.env.SUPABASE_STORAGE_URL}/storage/v1/object/public/${bucket}/${key}`;
  }


  try {
    if (selectedSlides.length === 0) {
      throw new Error('No slides were selected for the presentation.');
    }

    // 1. Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // 2. Add selected slides to the presentation
    const slidesToAdd = allSlides.filter(slide => selectedSlides.includes(slide.number)).sort((a, b) => a.number - b.number);

    for (const slide of slidesToAdd) {
      let imgBytes;
      try {
        const response = await fetch(slide.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch image for slide ${slide.number} with status ${response.status}`);
        }
        imgBytes = await response.arrayBuffer();
      } catch (fetchError: any) {
        console.error(`Failed to fetch image for slide ${slide.number} from ${slide.url}`, fetchError);
        throw new Error(`Could not download image for slide number ${slide.number}. URL may be invalid or blocked. Original error: ${fetchError.message}`);
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

      // If this is the last slide (Thank You slide), add the doctor's name
      if (slide.number === 34) {
        const personalizedText = doctorName;
        const fontSize = 42;
        const textWidth = helveticaBoldFont.widthOfTextAtSize(personalizedText, fontSize);

        // Draw a white shadow for better visibility
        page.drawText(personalizedText, {
          x: ((page.getWidth() - textWidth) / 2) + 1.5,
          y: 280 - 1.5,
          font: helveticaBoldFont,
          size: fontSize,
          color: rgb(1, 1, 1), // White shadow
        });

        // Draw the blue fill on top
        page.drawText(personalizedText, {
          x: (page.getWidth() - textWidth) / 2,
          y: 280,
          font: helveticaBoldFont,
          size: fontSize,
          color: rgb(0, 102 / 255, 204 / 255), // Royal Blue: #0066CC
        });
      }
    }

    // 3. Generate the PDF file as a buffer
    const pdfBytes = await pdfDoc.save();

    // 4. Upload the buffer to Supabase S3-compatible storage
    const safeDoctorName = doctorName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const fileName = `${city.toUpperCase()}_${safeDoctorName}_${Date.now()}`;
    const downloadUrl = await uploadToSupabase(Buffer.from(pdfBytes), fileName);

    // 5. Upsert the presentation record in Firestore
    const presentationsRef = adminFirestore.collection('presentations');
    const q = presentationsRef.where('doctorId', '==', doctorId);
    const snapshot = await q.get();

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
    if (snapshot.empty) {
      // Create new presentation document
      const docRef = await presentationsRef.add(presentationData);
      presentationId = docRef.id;
    } else {
      // Update existing presentation document
      const docRef = snapshot.docs[0].ref;
      await docRef.update(presentationData);
      presentationId = docRef.id;
    }

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

