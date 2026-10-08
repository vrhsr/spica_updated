import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { PDFDocument } from 'pdf-lib';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';
import { allSlides, CUSTOM_SLIDE_START } from '@/lib/slides';

/**
 * Slides Library management (admin only): add a slide (image + name) and
 * delete a slide that was added this way. Built-in slides can't be removed.
 *
 * A route handler rather than a server action: server actions have a ~1MB
 * request-body cap, which a slide image can exceed. The page downsizes images
 * to 1280x720 JPEG before upload, but this validates everything again —
 * nothing the client says is trusted.
 */
export const runtime = 'nodejs';

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is 4.5MB
const MAX_NAME_LENGTH = 60;
// Presentation pages are drawn at 1280x720 (16:9); anything far off would be visibly stretched.
const MIN_RATIO = 1.6;
const MAX_RATIO = 1.95;

const json = (body: object, status = 200) => NextResponse.json(body, { status });

async function requireAdmin(request: NextRequest): Promise<string | NextResponse> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in.' }, 401);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.role !== 'admin') return json({ error: 'Only the admin can manage the Slides Library.' }, 403);
    return decoded.uid;
  } catch {
    return json({ error: 'Your session has expired. Please sign in again.' }, 401);
  }
}

function r2Client() {
  const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'].filter(
    (v) => !process.env[v]
  );
  if (missing.length) throw new Error(`Server storage is not configured (missing ${missing.join(', ')}).`);
  return new S3Client({
    forcePathStyle: true,
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

const normalizeName = (n: string) => n.trim().replace(/\s+/g, ' ').toLowerCase();

export async function POST(request: NextRequest) {
  const adminUid = await requireAdmin(request);
  if (adminUid instanceof NextResponse) return adminUid;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Could not read the upload.' }, 400);
  }

  const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ');
  const file = form.get('file');
  if (!name) return json({ error: 'Give the slide a name.' }, 400);
  if (name.length > MAX_NAME_LENGTH) return json({ error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }, 400);
  if (!(file instanceof File) || file.size === 0) return json({ error: 'Choose an image file.' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'Image is too large (max 4MB).' }, 400);

  // Validate the actual bytes, not the filename/MIME type the client claims.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isPng && !isJpg) return json({ error: 'Only JPG or PNG images are supported.' }, 400);

  try {
    const probe = await PDFDocument.create();
    const img = isPng ? await probe.embedPng(bytes) : await probe.embedJpg(bytes);
    const ratio = img.width / img.height;
    if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
      return json(
        { error: `Slides must be 16:9 (landscape). This image is ${img.width}x${img.height}, which would look stretched.` },
        400
      );
    }
  } catch {
    return json({ error: 'That image file looks corrupted or is in an unsupported format.' }, 400);
  }

  const slidesRef = adminFirestore.collection('slides');
  const existing = await slidesRef.get();
  const taken = new Set([
    ...allSlides.map((s) => normalizeName(s.medicineName)),
    ...existing.docs.map((d) => normalizeName(String(d.data().medicineName ?? ''))),
  ]);
  if (taken.has(normalizeName(name))) {
    return json({ error: `A slide named "${name}" already exists.` }, 409);
  }

  let s3: S3Client;
  try {
    s3 = r2Client();
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }

  const ext = isPng ? 'png' : 'jpg';
  const safe = name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'slide';
  const key = `slides/${Date.now()}_${safe}.${ext}`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: Buffer.from(bytes),
        ContentType: isPng ? 'image/png' : 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
  } catch (e) {
    console.error('[api/slides] R2 upload failed:', e);
    return json({ error: 'Could not store the image. Please try again.' }, 502);
  }
  const url = `${process.env.R2_PUBLIC_URL}/${key}`;

  try {
    // Number allocation in a transaction so two simultaneous adds can't get the same number.
    const created = await adminFirestore.runTransaction(async (tx) => {
      const top = await tx.get(slidesRef.orderBy('number', 'desc').limit(1));
      const highest = top.empty ? 0 : Number(top.docs[0].data().number) || 0;
      const number = Math.max(CUSTOM_SLIDE_START, Math.floor(highest) + 1);
      const ref = slidesRef.doc(`slide-${number}`);
      tx.create(ref, {
        number,
        url,
        medicineName: name,
        storageKey: key,
        createdAt: Timestamp.now(),
        createdBy: adminUid,
      });
      return { id: ref.id, number };
    });
    return json({ id: created.id, number: created.number, url, medicineName: name });
  } catch (e) {
    console.error('[api/slides] Firestore write failed:', e);
    // Don't leave an orphaned file behind.
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key })).catch(() => {});
    return json({ error: 'Could not save the slide. Please try again.' }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  const adminUid = await requireAdmin(request);
  if (adminUid instanceof NextResponse) return adminUid;

  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!/^slide-\d+$/.test(id)) return json({ error: 'Invalid slide.' }, 400);

  const ref = adminFirestore.collection('slides').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return json({ ok: true }); // already gone

  const { storageKey, url } = snap.data()!;
  await ref.delete();

  // Best-effort file cleanup: only objects this feature created, under slides/.
  try {
    const base = process.env.R2_PUBLIC_URL;
    const key: string | undefined =
      typeof storageKey === 'string' && storageKey.startsWith('slides/')
        ? storageKey
        : base && typeof url === 'string' && url.startsWith(`${base}/slides/`)
        ? url.slice(base.length + 1)
        : undefined;
    if (key) await r2Client().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  } catch (e) {
    console.warn('[api/slides] Could not delete slide file from R2:', e);
  }
  return json({ ok: true });
}
