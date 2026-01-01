import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface PDFRecord {
    doctorId: string;
    fileBlob: Blob;
    doctorName: string;
    fileSize: number;
    downloadedAt: number;
}

interface PDFStorageDB extends DBSchema {
    pdfs: {
        key: string;
        value: PDFRecord;
    };
}

const DB_NAME = 'pdfStorageDB';
const STORE = 'pdfs';

/**
 * 1. Create a dedicated IndexedDB storage
 */
export async function initPDFDB(): Promise<IDBPDatabase<PDFStorageDB>> {
    return openDB<PDFStorageDB>(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "doctorId" });
            }
        },
    });
}

/**
 * 2. Save PDF Offline (Cloud -> Local)
 * Adapted to use fetch as we are using Firebase/S3 URLs
 */
export async function savePDFOffline(doctorId: string, pdfUrl: string, doctorName: string) {
    if (!pdfUrl) throw new Error("No PDF URL provided");

    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error(`Failed to download PDF: ${response.statusText}`);

    const blob = await response.blob();

    const db = await initPDFDB();
    await db.put(STORE, {
        doctorId,
        fileBlob: blob,
        doctorName,
        fileSize: blob.size,
        downloadedAt: Date.now()
    });

    // Mark in localStorage for quick synchronous check
    localStorage.setItem(`offline-${doctorId}`, 'true');
    localStorage.setItem(`offline-name-${doctorId}`, doctorName);

    return true;
}

/**
 * 3. Check If Stored Offline
 */
export async function hasOfflinePDF(doctorId: string) {
    // Try localStorage first for synchronous-like speed in UI
    if (typeof window !== 'undefined' && localStorage.getItem(`offline-${doctorId}`) === 'true') {
        return true;
    }

    const db = await initPDFDB();
    const record = await db.get(STORE, doctorId);
    return !!record;
}

/**
 * 4. Retrieve PDF for Offline Use
 */
export async function getOfflinePDF(doctorId: string) {
    const db = await initPDFDB();
    return await db.get(STORE, doctorId);
}

/**
 * Remove PDF from Offline storage
 */
export async function removePDFOffline(doctorId: string) {
    const db = await initPDFDB();
    await db.delete(STORE, doctorId);

    localStorage.removeItem(`offline-${doctorId}`);
    localStorage.removeItem(`offline-name-${doctorId}`);

    return true;
}
